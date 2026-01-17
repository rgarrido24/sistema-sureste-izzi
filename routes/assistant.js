import express from 'express';
import IzziPackage from '../models/IzziPackage.js';
import IzziPromocion from '../models/IzziPromocion.js';
import KnowledgePDF from '../models/KnowledgePDF.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const KNOWLEDGE_TTL_MS = 5 * 60 * 1000; // 5 min
let knowledgeCache = {
  updatedAt: 0,
  packagesCount: 0,
  promosCount: 0,
  text: '',
  pdfCount: 0,
  pdfChunks: [] // { pdfName, text }
};

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '').trim();
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

function normalizeRegionName(r) {
  return String(r || '').trim();
}

function buildKnowledgeText(packages, promos) {
  const lines = [];
  lines.push('OFERTA COMERCIAL (Base de Conocimiento Interna)');
  lines.push('Reglas: No inventes precios/beneficios. Si falta un dato, dilo y pide la info.');
  lines.push('');

  lines.push('PAQUETES DISPONIBLES:');
  if (!packages || packages.length === 0) {
    lines.push('- (sin paquetes cargados en el sistema)');
  } else {
    packages.slice(0, 120).forEach(p => {
      const codigo = p.codigo ? `[${p.codigo}] ` : '';
      const tipo = p.tipo ? ` (${p.tipo})` : '';
      const price = formatMoney(p.price);
      const desc = p.description ? ` - ${String(p.description)}` : '';
      lines.push(`- ${codigo}${p.name}${tipo}: ${price}${desc}`);
    });
    if (packages.length > 120) lines.push(`- ... (${packages.length - 120} más)`);
  }
  lines.push('');

  lines.push('PROMOCIONES:');
  if (!promos || promos.length === 0) {
    lines.push('- (sin promociones cargadas en el sistema)');
  } else {
    promos.slice(0, 80).forEach(p => {
      const title = p.title || 'Promoción';
      const range =
        (p.validFrom || p.validTo)
          ? ` (${[p.validFrom ? new Date(p.validFrom).toISOString().slice(0, 10) : '', p.validTo ? new Date(p.validTo).toISOString().slice(0, 10) : ''].filter(Boolean).join(' → ')})`
          : '';
      const desc = p.description ? `: ${String(p.description)}` : '';
      lines.push(`- ${title}${range}${desc}`);
    });
    if (promos.length > 80) lines.push(`- ... (${promos.length - 80} más)`);
  }
  lines.push('');

  lines.push('OBJETIVO: recomendar paquetes/promos, manejar objeciones, y generar mensajes listos para WhatsApp.');
  return lines.join('\n');
}

async function getKnowledge({ force = false } = {}) {
  const now = Date.now();
  if (!force && knowledgeCache.text && now - knowledgeCache.updatedAt < KNOWLEDGE_TTL_MS) {
    return knowledgeCache;
  }

  const [packages, promos] = await Promise.all([
    IzziPackage.find({}).sort({ createdAt: -1 }).lean(),
    IzziPromocion.find({}).sort({ createdAt: -1 }).lean()
  ]);

  const pdfs = await KnowledgePDF.find({ isActive: true }, { name: 1, chunks: 1 }).sort({ createdAt: -1 }).lean();
  const pdfChunks = [];
  for (const pdf of pdfs) {
    const pdfName = pdf?.name || 'PDF';
    const chunks = Array.isArray(pdf?.chunks) ? pdf.chunks : [];
    chunks.slice(0, 200).forEach(c => {
      if (c?.text) pdfChunks.push({ pdfName, text: String(c.text) });
    });
  }

  knowledgeCache = {
    updatedAt: now,
    packagesCount: packages.length,
    promosCount: promos.length,
    text: buildKnowledgeText(packages, promos),
    pdfCount: pdfs.length,
    pdfChunks
  };
  return knowledgeCache;
}

function tokenizeQuery(q) {
  const s = String(q || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const raw = s.split(/[^A-Z0-9]+/g).filter(Boolean);
  const stop = new Set(['DE', 'LA', 'EL', 'Y', 'EN', 'PARA', 'CON', 'DEL', 'LAS', 'LOS', 'QUE', 'POR', 'UN', 'UNA', 'A']);
  return raw.filter(t => t.length >= 3 && !stop.has(t)).slice(0, 25);
}

function scoreTextByTokens(text, tokens) {
  if (!text || tokens.length === 0) return 0;
  const s = String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  let score = 0;
  for (const t of tokens) {
    // contar ocurrencias simples
    const idx = s.indexOf(t);
    if (idx >= 0) score += 1;
  }
  return score;
}

function retrievePdfSnippets(userMessage, pdfChunks) {
  const tokens = tokenizeQuery(userMessage);
  if (!tokens.length || !Array.isArray(pdfChunks) || pdfChunks.length === 0) return [];

  const scored = [];
  for (const c of pdfChunks) {
    const sc = scoreTextByTokens(c.text, tokens);
    if (sc > 0) scored.push({ ...c, score: sc });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map(s => ({
    pdfName: s.pdfName,
    text: String(s.text).slice(0, 1400)
  }));
}

function buildGemPrompt({ user, history, message, knowledgeText }) {
  const role = user?.role || 'usuario';
  const name = user?.name || user?.username || 'Usuario';
  const region = normalizeRegionName(user?.region || '');

  const system = [
    'Eres un asesor comercial experto de Izzi dentro del sistema interno "Sistema Sureste".',
    'Responde SIEMPRE en español.',
    'Tu especialidad es: oferta comercial, recomendación de paquete, promociones, scripts de WhatsApp, objeciones, y próximos pasos.',
    'No inventes precios, promociones o políticas. Usa SOLO el bloque de conocimiento provisto.',
    'Si el usuario pide algo fuera del conocimiento, haz preguntas de aclaración o indica que falta el dato y qué necesitas.',
    'Sé directo y accionable: usa bullets, opciones (A/B/C) y un mensaje listo para copiar a WhatsApp cuando aplique.'
  ].join('\n');

  const context = [
    `CONTEXTO DEL USUARIO: nombre="${name}", rol="${role}"${region ? `, región="${region}"` : ''}.`,
    'NOTA: El usuario está dentro del sistema (no es un cliente final).'
  ].join('\n');

  const transcript = (history || [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'USUARIO' : 'ASISTENTE'}: ${m.text}`)
    .join('\n');

  return [
    '=== INSTRUCCIONES (GEMA) ===',
    system,
    '',
    context,
    '',
    '=== CONOCIMIENTO (SISTEMA) ===',
    knowledgeText || '(sin conocimiento)',
    '',
    '=== CONOCIMIENTO (PDFs - fragmentos relevantes) ===',
    // Se insertan fragmentos PDF antes de la conversación para guiar respuestas.
    // (se llena en /chat)
    '__PDF_SNIPPETS__',
    '',
    '=== CONVERSACIÓN RECIENTE ===',
    transcript || '(sin historial)',
    '',
    '=== PREGUNTA ACTUAL ===',
    `USUARIO: ${message}`,
    '',
    'Responde ahora.'
  ].join('\n');
}

async function callGeminiServer(prompt) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
    throw new Error('Falta GEMINI_API_KEY en el backend (Render).');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048
      }
    })
  });
  const data = await response.json();
  if (!response.ok || data?.error) {
    const msg = data?.error?.message || `Error Gemini (${response.status})`;
    throw new Error(msg);
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Error IA: No se recibió respuesta';
}

// Resumen de conocimiento (para UI)
router.get('/knowledge/summary', async (req, res) => {
  try {
    const k = await getKnowledge({ force: false });
    res.json({
      updatedAt: k.updatedAt,
      packagesCount: k.packagesCount,
      promosCount: k.promosCount,
      pdfCount: k.pdfCount
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error del servidor' });
  }
});

// Forzar refresh de conocimiento (botón "Actualizar")
router.post('/knowledge/refresh', async (req, res) => {
  try {
    const k = await getKnowledge({ force: true });
    res.json({
      success: true,
      updatedAt: k.updatedAt,
      packagesCount: k.packagesCount,
      promosCount: k.promosCount,
      pdfCount: k.pdfCount
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error del servidor' });
  }
});

// Chat central (gema)
router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body || {};
    const msg = String(message || '').trim();
    if (!msg) return res.status(400).json({ error: 'Mensaje vacío' });
    if (msg.length > 5000) return res.status(400).json({ error: 'Mensaje demasiado largo' });

    const k = await getKnowledge({ force: false });
    const snippets = retrievePdfSnippets(msg, k.pdfChunks);
    const snippetsText = snippets.length
      ? snippets.map((s, i) => `(${i + 1}) [${s.pdfName}]\n${s.text}`).join('\n\n')
      : '(sin PDFs activos o sin coincidencias)';

    const prompt = buildGemPrompt({
      user: req.user,
      history: Array.isArray(history) ? history : [],
      message: msg,
      knowledgeText: k.text
    }).replace('__PDF_SNIPPETS__', snippetsText);

    const text = await callGeminiServer(prompt);
    res.json({ text });
  } catch (e) {
    console.error('Error assistant/chat:', e);
    res.status(500).json({ error: e.message || 'Error del servidor' });
  }
});

export default router;

