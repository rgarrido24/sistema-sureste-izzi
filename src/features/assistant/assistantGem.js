import * as api from '../../api.js';

function safeStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return safeStr(value);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

export async function loadCommercialKnowledge() {
  // Intentar cargar paquetes + promociones. Si falla, devolvemos conocimiento parcial.
  const [packagesRes, promosRes] = await Promise.allSettled([
    api.getPackages(),
    api.getPromociones()
  ]);

  const packages = packagesRes.status === 'fulfilled' ? packagesRes.value : [];
  const promos = promosRes.status === 'fulfilled' ? promosRes.value : [];

  // Normalizar forma esperada
  const pkgs = (packages || []).map(p => ({
    codigo: safeStr(p.codigo || p.Codigo || p.code),
    name: safeStr(p.name || p.nombre),
    price: p.price ?? p.precio ?? '',
    tipo: safeStr(p.tipo),
    description: safeStr(p.description || p.descripcion || '')
  }));

  const prms = (promos || []).map(p => ({
    title: safeStr(p.title || p.titulo),
    description: safeStr(p.description || p.descripcion),
    validFrom: safeStr(p.validFrom),
    validTo: safeStr(p.validTo)
  }));

  return { packages: pkgs, promos: prms };
}

export function buildCommercialKnowledgeText({ packages = [], promos = [] } = {}) {
  const lines = [];
  lines.push('OFERTA COMERCIAL (Base de Conocimiento Interna)');
  lines.push('Reglas: No inventes precios/beneficios. Si falta un dato, pregunta o dilo explícitamente.');
  lines.push('');

  if (packages.length > 0) {
    lines.push('PAQUETES DISPONIBLES:');
    packages.slice(0, 80).forEach(p => {
      const parts = [];
      if (p.codigo) parts.push(`[${p.codigo}]`);
      parts.push(p.name || 'Paquete');
      if (p.tipo) parts.push(`(${p.tipo})`);
      const price = p.price !== '' ? formatMoney(p.price) : '';
      const desc = p.description ? ` - ${p.description}` : '';
      lines.push(`- ${parts.join(' ')}${price ? `: ${price}` : ''}${desc}`);
    });
    if (packages.length > 80) lines.push(`- ... (${packages.length - 80} más)`);
    lines.push('');
  } else {
    lines.push('PAQUETES DISPONIBLES: (sin datos cargados en el sistema)');
    lines.push('');
  }

  if (promos.length > 0) {
    lines.push('PROMOCIONES ACTIVAS / CAPTURADAS:');
    promos.slice(0, 50).forEach(p => {
      const range =
        (p.validFrom || p.validTo)
          ? ` (${[p.validFrom || '', p.validTo || ''].filter(Boolean).join(' → ')})`
          : '';
      lines.push(`- ${p.title || 'Promoción'}${range}${p.description ? `: ${p.description}` : ''}`);
    });
    if (promos.length > 50) lines.push(`- ... (${promos.length - 50} más)`);
    lines.push('');
  } else {
    lines.push('PROMOCIONES: (sin datos cargados en el sistema)');
    lines.push('');
  }

  lines.push('OBJETIVO: ayudar a generar una oferta comercial clara, guiones de WhatsApp, manejo de objeciones y recomendación de paquete.');
  return lines.join('\n');
}

export function buildGemPrompt({ userContext, history = [], userMessage, knowledgeText }) {
  const role = userContext?.role || 'usuario';
  const name = userContext?.name || userContext?.username || 'Usuario';

  const system = [
    'Eres un asesor comercial experto de Izzi dentro del sistema interno "Sistema Sureste".',
    'Responde SIEMPRE en español.',
    'Tu especialidad es: oferta comercial, recomendación de paquete, promociones, scripts de WhatsApp, objeciones, y próximos pasos.',
    'No inventes precios, promociones o políticas. Usa SOLO el bloque de conocimiento provisto.',
    'Si el usuario pide algo fuera del conocimiento, haz preguntas de aclaración o indica que falta el dato y qué necesitas.',
    'Sé directo y accionable: usa bullets, opciones (A/B/C) y un mensaje listo para copiar a WhatsApp cuando aplique.'
  ].join('\n');

  const context = [
    `CONTEXTO DEL USUARIO: nombre="${name}", rol="${role}".`,
    'NOTA: El usuario está dentro del sistema (no es un cliente final).',
  ].join('\n');

  const transcript = (history || [])
    .filter(m => m?.role === 'user' || m?.role === 'assistant')
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'USUARIO' : 'ASISTENTE'}: ${m.text}`)
    .join('\n');

  return [
    '=== INSTRUCCIONES (GEMA) ===',
    system,
    '',
    context,
    '',
    '=== CONOCIMIENTO ===',
    knowledgeText || '(sin conocimiento)',
    '',
    '=== CONVERSACIÓN RECIENTE ===',
    transcript || '(sin historial)',
    '',
    '=== PREGUNTA ACTUAL ===',
    `USUARIO: ${userMessage}`,
    '',
    'Responde ahora.'
  ].join('\n');
}

