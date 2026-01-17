import express from 'express';
import IzziPackage from '../models/IzziPackage.js';
import IzziPromocion from '../models/IzziPromocion.js';
import KnowledgePDF from '../models/KnowledgePDF.js';
import AiUsage from '../models/AiUsage.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Puedes fijar un modelo con GEMINI_MODEL o una lista con GEMINI_MODELS (separada por comas).
// Render/Google a veces no habilitan todos los modelos en todos los proyectos; usamos fallback.
const GEMINI_MODEL = process.env.GEMINI_MODEL || '';
const GEMINI_MODELS = (process.env.GEMINI_MODELS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const DEFAULT_MODELS = [
  // Nuevos (si están disponibles en tu proyecto)
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest',
  // 2.x (según disponibilidad por proyecto/región)
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-pro',
  // Legacy (suele estar disponible)
  'gemini-pro'
];

function getModelFallbackList() {
  const list = [];
  if (GEMINI_MODEL) list.push(GEMINI_MODEL);
  for (const m of GEMINI_MODELS) list.push(m);
  for (const m of DEFAULT_MODELS) list.push(m);
  // quitar duplicados
  return Array.from(new Set(list));
}

// Cache de modelos disponibles por API key (ListModels)
const MODEL_LIST_TTL_MS = 30 * 60 * 1000; // 30 min
let modelListCache = { updatedAt: 0, models: [] };

async function listAvailableModels() {
  const now = Date.now();
  if (modelListCache.models.length > 0 && now - modelListCache.updatedAt < MODEL_LIST_TTL_MS) {
    return modelListCache.models;
  }

  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') return [];

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    // Si no podemos listar, no bloqueamos: seguimos con fallback fijo.
    return [];
  }

  const models = Array.isArray(data?.models) ? data.models : [];
  const usable = models
    .filter(m => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => String(m.name || '').replace(/^models\//, '').trim())
    .filter(Boolean);

  modelListCache = { updatedAt: now, models: Array.from(new Set(usable)) };
  return modelListCache.models;
}

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
  let lastErr = null;
  const dynamicModels = await listAvailableModels();
  const models = Array.from(new Set([...getModelFallbackList(), ...dynamicModels]));

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
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

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) {
        const msg = data?.error?.message || `Error Gemini (${response.status})`;
        // Si el modelo no existe/no soporta generateContent, intentar el siguiente.
        if (
          /not found/i.test(msg) ||
          /not supported/i.test(msg) ||
          /does not exist/i.test(msg)
        ) {
          lastErr = new Error(`${model}: ${msg}`);
          continue;
        }
        throw new Error(msg);
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Error IA: No se recibió respuesta';
      const usage = data?.usageMetadata || {};
      return {
        text,
        model,
        usage: {
          promptTokenCount: Number(usage.promptTokenCount || 0),
          candidatesTokenCount: Number(usage.candidatesTokenCount || 0),
          totalTokenCount: Number(usage.totalTokenCount || 0)
        }
      };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  // Mejor mensaje de diagnóstico: mostrar algunos modelos detectados
  const detected = await listAvailableModels();
  const hint = detected.length ? `Modelos detectados: ${detected.slice(0, 12).join(', ')}${detected.length > 12 ? ', …' : ''}` : 'No se pudieron listar modelos (ListModels falló).';
  throw lastErr || new Error(`No se pudo usar ningún modelo de Gemini con esta API key. ${hint}`);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function enforceDailyLimit() {
  const raw = process.env.ASSISTANT_DAILY_REQUEST_LIMIT;
  if (!raw) return;
  const limit = Number(raw);
  if (!Number.isFinite(limit) || limit <= 0) return;

  const since = startOfToday();
  const used = await AiUsage.countDocuments({ endpoint: 'assistant/chat', createdAt: { $gte: since }, success: true });
  if (used >= limit) {
    const err = new Error(`Límite diario de IA alcanzado (${used}/${limit}). Intenta mañana o aumenta el límite.`);
    err.statusCode = 429;
    throw err;
  }
}

// Resumen de consumo (para monitorear plan gratuito)
router.get('/usage/summary', async (req, res) => {
  try {
    // Solo roles de administración
    const role = req.user?.role;
    if (!['admin', 'admin_general', 'mesa_control'].includes(role)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    const now = new Date();
    const sinceToday = startOfToday();
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [today, last7d, last30d] = await Promise.all([
      AiUsage.aggregate([
        { $match: { createdAt: { $gte: sinceToday }, endpoint: 'assistant/chat', success: true } },
        { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: '$totalTokenCount' } } }
      ]),
      AiUsage.aggregate([
        { $match: { createdAt: { $gte: since7d }, endpoint: 'assistant/chat', success: true } },
        { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: '$totalTokenCount' } } }
      ]),
      AiUsage.aggregate([
        { $match: { createdAt: { $gte: since30d }, endpoint: 'assistant/chat', success: true } },
        { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: '$totalTokenCount' } } }
      ])
    ]);

    const dailyLimitRaw = process.env.ASSISTANT_DAILY_REQUEST_LIMIT || '';
    res.json({
      today: today?.[0] || { requests: 0, tokens: 0 },
      last7d: last7d?.[0] || { requests: 0, tokens: 0 },
      last30d: last30d?.[0] || { requests: 0, tokens: 0 },
      dailyLimit: dailyLimitRaw ? Number(dailyLimitRaw) : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error del servidor' });
  }
});

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

    await enforceDailyLimit();

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

    const userMeta = req.user || {};
    const usageDoc = {
      userId: userMeta.id || '',
      username: userMeta.username || '',
      role: userMeta.role || '',
      endpoint: 'assistant/chat',
      model: '',
      promptChars: prompt.length,
      responseChars: 0,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
      success: false,
      errorMessage: ''
    };

    try {
      const result = await callGeminiServer(prompt);
      usageDoc.model = result.model || '';
      usageDoc.responseChars = (result.text || '').length;
      usageDoc.promptTokenCount = result.usage?.promptTokenCount || 0;
      usageDoc.candidatesTokenCount = result.usage?.candidatesTokenCount || 0;
      usageDoc.totalTokenCount = result.usage?.totalTokenCount || 0;
      usageDoc.success = true;
      await AiUsage.create(usageDoc);
      return res.json({ text: result.text });
    } catch (err) {
      usageDoc.errorMessage = err?.message ? String(err.message) : 'Error';
      usageDoc.success = false;
      await AiUsage.create(usageDoc);
      const status = err?.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
      return res.status(status).json({ error: usageDoc.errorMessage });
    }
  } catch (e) {
    console.error('Error assistant/chat:', e);
    res.status(500).json({ error: e.message || 'Error del servidor' });
  }
});

export default router;

