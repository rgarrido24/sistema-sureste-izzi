import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { requerirLlave, generarLlave, hashLlave } from '../middleware/integracionEstatus.js';
import OrdenEstatus from '../models/OrdenEstatus.js';
import IntegracionEstatus from '../models/IntegracionEstatus.js';
import ConsultaEstatus from '../models/ConsultaEstatus.js';
import SolicitudEstatus from '../models/SolicitudEstatus.js';
import VendedorFactor from '../models/VendedorFactor.js';
import { normalizarFila, mezclarCaptura, extraerConsultas, redactarRespuesta, ultimosDiez, diaMerida } from '../utils/estatusOrdenes.js';

const LIMITE_DIARIO = Number(process.env.ESTATUS_LIMITE_DIARIO) || 30;
const limitar = (limit) => rateLimit({ windowMs: 60 * 1000, limit, standardHeaders: 'draft-7', legacyHeaders: false, handler: (req, res) => res.status(429).json({ error: 'Demasiadas peticiones' }) });

// ---------- Captura (marcador del celular / extensión) ----------
// Se monta SIN sesión de usuario: entra con su propia llave.
export const ingestaRouter = express.Router();
ingestaRouter.use(limitar(60), express.json({ limit: '2mb' }), requerirLlave('captura'));

ingestaRouter.post('/captura', async (req, res) => {
  try {
    const { fuente = '', filas } = req.body || {};
    if (!Array.isArray(filas) || filas.length === 0) return res.status(400).json({ error: 'Sin filas' });
    if (filas.length > 500) return res.status(400).json({ error: 'Demasiadas filas (máximo 500)' });
    const ahora = new Date();
    let nuevas = 0, actualizadas = 0, conCambio = 0, descartadas = 0;
    const cuentasVistas = new Set();
    for (const raw of filas) {
      const n = normalizarFila(raw);
      if (!n.numOrden) { descartadas++; continue; }
      const actual = await OrdenEstatus.findOne({ numOrden: n.numOrden }).lean();
      const { doc, cambio } = mezclarCaptura(actual, n, { fuente: String(fuente).slice(0, 20), capturadoPor: req.integracion.nombre, ahora });
      if (actual) { await OrdenEstatus.updateOne({ numOrden: n.numOrden }, { $set: doc }); actualizadas++; }
      else { await OrdenEstatus.create(doc); nuevas++; }
      if (cambio) conCambio++;
      if (doc.cuenta) cuentasVistas.add(doc.cuenta);
    }
    // Lo que alguien pidió y ya quedó capturado deja de estar pendiente
    if (cuentasVistas.size) {
      await SolicitudEstatus.updateMany({ atendida: false, consulta: { $in: [...cuentasVistas] } }, { atendida: true, atendidaEn: ahora });
    }
    res.json({ success: true, nuevas, actualizadas, conCambio, descartadas });
  } catch (e) {
    console.error('estatus captura:', e?.message || e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cuentas que alguien pidió actualizar (para que quien tiene acceso al portal las busque)
ingestaRouter.get('/pendientes', async (req, res) => {
  const lista = await SolicitudEstatus.find({ atendida: false }).sort({ createdAt: 1 }).limit(50).lean();
  res.json({ success: true, pendientes: lista.map((s) => ({ consulta: s.consulta, tipo: s.tipo, desde: s.createdAt })) });
});

// ---------- Chatbot (WhatsApp / Agentia) ----------
export const botRouter = express.Router();
botRouter.use(limitar(120), express.json({ limit: '20kb' }), requerirLlave('bot'));

let cacheTelefonos = { en: 0, mapa: new Map() };
async function vendedorPorTelefono(tel) {
  if (Date.now() - cacheTelefonos.en > 60_000) {
    const docs = await VendedorFactor.find({ telefono: { $ne: '' } }, 'vendedor telefono').lean();
    const mapa = new Map();
    for (const d of docs) { const t = ultimosDiez(d.telefono); if (t.length === 10) mapa.set(t, d.vendedor); }
    cacheTelefonos = { en: Date.now(), mapa };
  }
  return cacheTelefonos.mapa.get(tel) || null;
}

// Body: { telefono: "5219991234567", mensaje: "123456789 1-280913284125" } → { respuesta: "texto" }
botRouter.post('/consulta', async (req, res) => {
  try {
    const tel = ultimosDiez(req.body?.telefono);
    const mensaje = String(req.body?.mensaje ?? '').slice(0, 1000);
    if (tel.length !== 10) return res.status(400).json({ error: 'Teléfono no válido' });

    const vendedor = await vendedorPorTelefono(tel);
    if (!vendedor) {
      return res.json({ success: true, autorizado: false, respuesta: 'Este número no está registrado en RGO. Pide a tu supervisor que lo dé de alta.' });
    }

    const consultas = extraerConsultas(mensaje);
    if (consultas.length === 0) {
      return res.json({ success: true, autorizado: true, respuesta: 'Mándame el número de cuenta (o de orden, ej. 1-280913284125). Puedes mandar hasta 5 en un mensaje.' });
    }

    const dia = diaMerida();
    const usadas = await ConsultaEstatus.countDocuments({ telefono: tel, dia });
    if (usadas + consultas.length > LIMITE_DIARIO) {
      return res.json({ success: true, autorizado: true, respuesta: `Llegaste al límite de ${LIMITE_DIARIO} consultas por día. Mañana puedes seguir, o pide apoyo a Mesa de Control.` });
    }

    const resultados = [];
    for (const c of consultas) {
      const filtro = c.tipo === 'orden' ? { numOrden: c.valor } : { cuenta: c.valor };
      const ordenes = await OrdenEstatus.find(filtro).sort({ actualizadoEn: -1 }).limit(3).lean();
      if (!ordenes.length) {
        await SolicitudEstatus.updateOne({ consulta: c.valor, atendida: false }, { $setOnInsert: { tipo: c.tipo, solicitadoPor: vendedor } }, { upsert: true });
      }
      resultados.push({ ...c, ordenes });
    }
    await ConsultaEstatus.insertMany(resultados.map((r) => ({ telefono: tel, vendedor, consulta: r.valor, encontrada: r.ordenes.length > 0, dia })));
    res.json({ success: true, autorizado: true, respuesta: redactarRespuesta(resultados) });
  } catch (e) {
    console.error('estatus bot:', e?.message || e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ---------- Administración (sesión normal) ----------
export const adminRouter = express.Router();
adminRouter.use(requireAuth, requireRoles(['admin', 'director', 'mesa_control']));

adminRouter.get('/integraciones', async (req, res) => {
  const lista = await IntegracionEstatus.find({}, '-hash').sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: lista });
});
adminRouter.post('/integraciones', requireRoles(['admin', 'director']), async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim().slice(0, 80);
  const tipo = req.body?.tipo;
  if (!nombre || !['captura', 'bot'].includes(tipo)) return res.status(400).json({ error: 'Nombre y tipo (captura | bot) requeridos' });
  const llave = generarLlave();
  const reg = await IntegracionEstatus.create({ nombre, tipo, hash: hashLlave(llave), prefijo: llave.slice(0, 8), creadaPor: req.user.username });
  res.json({ success: true, id: reg._id, llave, aviso: 'Guarda esta llave ahora: no se vuelve a mostrar.' });
});
adminRouter.post('/integraciones/:id/revocar', requireRoles(['admin', 'director']), async (req, res) => {
  await IntegracionEstatus.updateOne({ _id: req.params.id }, { activa: false });
  res.json({ success: true });
});
adminRouter.get('/resumen', async (req, res) => {
  const [ordenes, pendientes, consultasHoy] = await Promise.all([
    OrdenEstatus.countDocuments(), SolicitudEstatus.countDocuments({ atendida: false }), ConsultaEstatus.countDocuments({ dia: diaMerida() }),
  ]);
  res.json({ success: true, ordenes, pendientes, consultasHoy });
});
