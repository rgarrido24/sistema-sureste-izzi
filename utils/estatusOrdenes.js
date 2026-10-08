// Lógica pura del sistema de estatus (sin base de datos): normaliza lo capturado del portal de Izzi,
// decide qué cambió y redacta la respuesta de texto para el chatbot.

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const claveEncabezado = (k) => sinAcentos(k).toUpperCase().replace(/[^A-Z0-9]/g, '');

// Solo estos encabezados se guardan. Todo lo demás (nombre, teléfono, dirección…) se descarta.
const MAPA = {
  NUMORDEN: 'numOrden', NUMERODEORDEN: 'numOrden', ORDEN: 'numOrden', NOORDEN: 'numOrden',
  CUENTA: 'cuenta', NUMCUENTA: 'cuenta',
  HUB: 'hub', RPT: 'rpt',
  TIPOORDEN: 'tipoOrden', REFERIDO: 'referido',
  FECHAORDEN: 'fechaOrden',
  ESTADO: 'estado', ESTATUS: 'estado', ESTADOORDEN: 'estado',
  VENDEDOR: 'vendedorCodigo',
  FECHASOLICITADA: 'fechaSolicitada',
  TOTAL: 'total',
  MOTIVOORDEN: 'motivoOrden',
  MOTIVODECANCELACION: 'motivoCancelacion', MOTIVOCANCELACION: 'motivoCancelacion',
  MEDIOVERIFICACION: 'medioVerificacion', MEDIODEVERIFICACION: 'medioVerificacion',
  ESTADOADMISION: 'estadoAdmision',
  HORARIO: 'horario',
  POSICIONENRUTA: 'posicionEnRuta', POSICION: 'posicionEnRuta',
};

const texto = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);

export function normalizarFila(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    const campo = MAPA[claveEncabezado(k)];
    if (campo && v !== null && v !== undefined && texto(v) !== '') out[campo] = texto(v);
  }
  if (typeof raw.pendienteEnRuta === 'boolean') out.pendienteEnRuta = raw.pendienteEnRuta;
  if (out.numOrden) out.numOrden = out.numOrden.replace(/\s/g, '');
  if (out.cuenta) out.cuenta = out.cuenta.replace(/\D/g, '') || out.cuenta;
  return out;
}

const CAMPOS_ESTADO = ['estado', 'estadoAdmision', 'motivoCancelacion', 'fechaSolicitada', 'horario', 'posicionEnRuta', 'pendienteEnRuta'];

// Mezcla lo nuevo sobre lo guardado (lo vacío no borra lo anterior). Devuelve { doc, cambio }.
export function mezclarCaptura(actual, nueva, { fuente = '', capturadoPor = '', ahora = new Date() } = {}) {
  const base = actual ? { ...actual } : {};
  let cambio = !actual;
  for (const [k, v] of Object.entries(nueva)) {
    if (CAMPOS_ESTADO.includes(k) && base[k] !== v) cambio = true;
    base[k] = v;
  }
  base.actualizadoEn = ahora;
  base.capturadoPor = capturadoPor;
  const historial = Array.isArray(base.historial) ? [...base.historial] : [];
  if (cambio) {
    historial.push({
      en: ahora, fuente,
      estado: base.estado || '', estadoAdmision: base.estadoAdmision || '', motivoCancelacion: base.motivoCancelacion || '',
      fechaSolicitada: base.fechaSolicitada || '', horario: base.horario || '', posicionEnRuta: base.posicionEnRuta || '',
      pendienteEnRuta: typeof base.pendienteEnRuta === 'boolean' ? base.pendienteEnRuta : null,
    });
  }
  base.historial = historial.slice(-30);
  return { doc: base, cambio };
}

// ---------- Mensajes del chat ----------
const RE_ORDEN = /\b\d{1,2}-\d{6,}\b/g;
const RE_CUENTA = /(?<![\d-])\d{6,12}(?![\d-])/g;

export function extraerConsultas(mensaje, maximo = 5) {
  const t = String(mensaje ?? '');
  const ordenes = (t.match(RE_ORDEN) || []).map((x) => ({ tipo: 'orden', valor: x }));
  const cuentas = (t.replace(RE_ORDEN, ' ').match(RE_CUENTA) || []).map((x) => ({ tipo: 'cuenta', valor: x }));
  const vistos = new Set();
  return [...ordenes, ...cuentas].filter((c) => (vistos.has(c.valor) ? false : vistos.add(c.valor))).slice(0, maximo);
}

export const ultimosDiez = (tel) => String(tel ?? '').replace(/\D/g, '').slice(-10);

export function diaMerida(fecha = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Merida' }).format(fecha); // YYYY-MM-DD
}
function horaMerida(fecha) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Merida', hour: '2-digit', minute: '2-digit', hour12: false }).format(fecha);
}
function haceCuanto(fecha, ahora) {
  const min = Math.max(0, Math.round((ahora - new Date(fecha)) / 60000));
  if (min < 2) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function redactarOrden(o, ahora = new Date()) {
  const l = [`Orden ${o.numOrden}${o.cuenta ? ` (cuenta ${o.cuenta})` : ''}`];
  if (o.tipoOrden) l.push(`Tipo: ${o.tipoOrden}`);
  l.push(`Estado: ${o.estado || 'sin dato'}${o.estadoAdmision ? ` · Admisión: ${o.estadoAdmision}` : ''}`);
  if (o.motivoCancelacion) l.push(`Motivo de cancelación: ${o.motivoCancelacion}`);
  if (o.fechaSolicitada) l.push(`Fecha solicitada: ${o.fechaSolicitada}`);
  if (o.horario) l.push(`Horario: ${o.horario}`);
  if (o.posicionEnRuta) l.push(`Posición en ruta: ${o.posicionEnRuta}`);
  if (o.pendienteEnRuta === false) l.push('Ya no está pendiente en la ruta del técnico');
  else if (o.pendienteEnRuta === true) l.push('Aún pendiente en la ruta del técnico');
  const f = new Date(o.actualizadoEn);
  l.push(`Actualizado a las ${horaMerida(f)} (${haceCuanto(f, ahora)})`);
  return l.join('\n');
}

export function redactarRespuesta(resultados, { ahora = new Date() } = {}) {
  return resultados.map((r) => {
    if (r.ordenes?.length) return r.ordenes.map((o) => redactarOrden(o, ahora)).join('\n\n');
    return `No tengo estatus de ${r.valor} todavía. Ya avisé para que lo revisen y vuelve a preguntar en un rato.`;
  }).join('\n\n———\n\n');
}
