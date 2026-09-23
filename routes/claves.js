import express from 'express';
import crypto from 'crypto';
import ClaveAsignacion from '../models/ClaveAsignacion.js';
import M0Master from '../models/M0Master.js';
import M1Master from '../models/M1Master.js';
import M2Master from '../models/M2Master.js';
import M3Master from '../models/M3Master.js';
import M4Master from '../models/M4Master.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

function normHeader(k) {
  return String(k || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function valorEmpleado(v) {
  if (v === undefined || v === null || typeof v === 'object') return '';
  const s = String(v).trim();
  return (!s || s === '-') ? '' : s;
}

function getNoEmpleado(row) {
  if (!row || typeof row !== 'object') return '';
  // Mongo interpreta "No. EMPLEADO" como { No: { EMPLEADO: "..." } }
  const anidado = row.No && typeof row.No === 'object'
    ? (row.No.EMPLEADO || row.No.Empleado || row.No.empleado)
    : null;
  const directo = valorEmpleado(anidado)
    || valorEmpleado(row['No EMPLEADO'])
    || valorEmpleado(row['NO EMPLEADO'])
    || valorEmpleado(row['No. EMPLEADO']);
  if (directo) return directo;

  for (const [key, v] of Object.entries(row)) {
    if (typeof v === 'object') continue;
    const n = normHeader(key);
    const esNumEmpleado = n.includes('empleado') && (n.includes('no') || n.includes('num') || n === 'empleado');
    const val = valorEmpleado(v);
    if (esNumEmpleado && val) return val;
  }
  return '';
}

function sanitizeRowForMongo(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (k.includes('.')) {
      const safe = k.replace(/\./g, '').replace(/\s+/g, ' ').trim();
      if (out[safe] === undefined) out[safe] = v;
      continue;
    }
    if (k === 'No' && v && typeof v === 'object' && !Array.isArray(v)) {
      if (v.EMPLEADO != null || v.Empleado != null || v.empleado != null) {
        out['No EMPLEADO'] = v.EMPLEADO || v.Empleado || v.empleado;
      }
      continue;
    }
    out[k] = v;
  }
  const n = getNoEmpleado({ ...row, ...out });
  if (n) out['No EMPLEADO'] = n;
  return out;
}

function withNoEmpleado(doc) {
  const n = getNoEmpleado(doc);
  if (n) {
    doc['No EMPLEADO'] = n;
    doc['No. EMPLEADO'] = n;
  }
  return doc;
}

const router = express.Router();
router.use(requireAuth);

// Solo el/la coordinador(a) de claves y los directores/admin pueden ver o subir esta información.
const CAN_ACCESS = ['admin', 'admin_general', 'director', 'coordinador_claves'];
router.use(requireRoles(CAN_ACCESS));

// Valores distintos ya usados por campo, para autocompletar el formulario de alta manual
// (evita retipear REGION, DISTRIBUIDOR, HUB, etc. cada vez)
const CAMPOS_REPETITIVOS = [
  'REGION', 'SUBREGION', 'HUB', 'PLAZA', 'DISTRIBUIDOR', 'RAZON SOCIAL',
  'KAM', 'ESTATUS', 'JORNADA', 'SUPERVISOR INTERNO (IZZI)', 'GERENTE INTERNO (IZZI)',
  'CANAL DE DISTRIBUCION', 'TIPO DE VENDEDOR', 'TIPO DE USUARIO', 'CLASIFICACION DE CLAVE',
  'SUPERVISOR', 'GERENTE DISTRIBUIDOR', 'SUBDISTRIBUIDOR'
];

router.get('/valores-distintos', async (req, res) => {
  try {
    const resultado = {};
    await Promise.all(CAMPOS_REPETITIVOS.map(async (campo) => {
      const valores = await ClaveAsignacion.distinct(campo);
      resultado[campo] = (valores || []).filter(Boolean).sort();
    }));
    res.json(resultado);
  } catch (error) {
    console.error('Error obteniendo valores distintos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Alta manual de un solo registro (usuario nuevo), sin necesidad de subir un Excel completo
router.post('/', async (req, res) => {
  try {
    const row = req.body?.row;
    if (!row || typeof row !== 'object') {
      return res.status(400).json({ error: 'Se espera un objeto "row" con los datos del vendedor' });
    }
    if (!row['NOMBRE DEL VENDEDOR'] || !row['CLAVES']) {
      return res.status(400).json({ error: 'Nombre del vendedor y Clave son obligatorios' });
    }

    const now = new Date();
    const doc = await ClaveAsignacion.create({
      ...sanitizeRowForMongo(row),
      claveId: row['CLAVES'],
      hojaOrigen: row.__hojaOrigen || row.hojaOrigen || 'Alta manual',
      batchId: `manual-${now.getTime()}`,
      subidoPorId: req.user?.id || '',
      subidoPorUsername: req.user?.username || '',
      subidoPorNombre: req.user?.name || req.user?.username || '',
    });

    res.json({ success: true, doc });
  } catch (error) {
    console.error('Error creando registro manual de clave:', error);
    res.status(500).json({ error: 'Error del servidor', message: error.message });
  }
});

// Lista de vendedores de cobranza (M0-M4), para el dropdown de asignación de clave
router.get('/vendedores-cobranza', async (req, res) => {
  try {
    const modelos = [M0Master, M1Master, M2Master, M3Master, M4Master];
    const camposVendedor = ['Vendedor', 'VendedorAsignado'];
    const set = new Set();

    for (const Modelo of modelos) {
      for (const campo of camposVendedor) {
        try {
          const valores = await Modelo.distinct(campo);
          (valores || []).forEach(v => {
            const nombre = String(v || '').trim();
            if (nombre) set.add(nombre);
          });
        } catch (e) { /* el campo puede no existir en algún módulo, se ignora */ }
      }
    }

    res.json(Array.from(set).sort());
  } catch (error) {
    console.error('Error obteniendo vendedores de cobranza:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Asignar (o reasignar) quién usa realmente esta clave — con huella digital: quién lo
// asignó y cuándo. Se guarda separado de quién subió el registro originalmente.
router.put('/:id/asignar', async (req, res) => {
  try {
    const { subdistribuidorVendedor } = req.body;
    if (!subdistribuidorVendedor || !String(subdistribuidorVendedor).trim()) {
      return res.status(400).json({ error: 'Falta el nombre del vendedor a asignar' });
    }

    const ahora = new Date();
    const doc = await ClaveAsignacion.findByIdAndUpdate(
      req.params.id,
      {
        SubdistribuidorVendedor: String(subdistribuidorVendedor).trim(),
        SubdistribuidorVendedorAsignadoPorId: req.user?.id || '',
        SubdistribuidorVendedorAsignadoPorUsername: req.user?.username || '',
        SubdistribuidorVendedorAsignadoPorNombre: req.user?.name || req.user?.username || '',
        SubdistribuidorVendedorAsignadoFecha: ahora,
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  } catch (error) {
    console.error('Error asignando clave a vendedor:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Listar registros actuales (la "foto" más reciente por clave)
router.get('/', async (req, res) => {
  try {
    const { search, hoja, distribuidor } = req.query;
    const query = {};
    if (hoja) query.hojaOrigen = hoja;
    if (distribuidor) query['DISTRIBUIDOR'] = new RegExp(distribuidor, 'i');
    if (search) {
      const rx = new RegExp(search, 'i');
      query.$or = [
        { 'NOMBRE DEL VENDEDOR': rx },
        { 'CLAVES': rx },
        { 'DISTRIBUIDOR': rx },
        { 'PLAZA': rx },
        { 'USUARIO DE RED': rx },
        { 'No. EMPLEADO': rx },
        { 'No EMPLEADO': rx },
        { 'No.EMPLEADO': rx },
      ];
    }

    const docs = await ClaveAsignacion.find(query).sort({ createdAt: -1 }).lean();
    res.json(docs.map(withNoEmpleado));
  } catch (error) {
    console.error('Error obteniendo claves:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Subir un nuevo lote (una o varias hojas combinadas del Excel de Izzi)
router.post('/bulk', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Se espera un array de filas' });
    }

    const batchId = crypto.randomUUID();
    const now = new Date();

    const docs = rows.map((row) => ({
      ...sanitizeRowForMongo(row),
      claveId: row['CLAVES'] || row['USUARIO DE RED'] || row['ID'] || undefined,
      hojaOrigen: row.__hojaOrigen || row.hojaOrigen || '',
      batchId,
      subidoPorId: req.user?.id || '',
      subidoPorUsername: req.user?.username || '',
      subidoPorNombre: req.user?.name || req.user?.username || '',
      createdAt: now,
      updatedAt: now,
    }));

    await ClaveAsignacion.insertMany(docs, { ordered: false });

    res.json({
      success: true,
      batchId,
      total: docs.length,
      subidoPor: req.user?.name || req.user?.username,
      fecha: now,
    });
  } catch (error) {
    console.error('Error subiendo lote de claves:', error);
    res.status(500).json({ error: 'Error del servidor', message: error.message });
  }
});

// Historial de cargas: quién subió qué y cuándo (agrupado por lote)
router.get('/historial', async (req, res) => {
  try {
    const historial = await ClaveAsignacion.aggregate([
      {
        $group: {
          _id: '$batchId',
          total: { $sum: 1 },
          subidoPorNombre: { $first: '$subidoPorNombre' },
          subidoPorUsername: { $first: '$subidoPorUsername' },
          fecha: { $first: '$createdAt' },
          hojas: { $addToSet: '$hojaOrigen' },
        },
      },
      { $sort: { fecha: -1 } },
    ]);

    res.json(historial.map(h => ({
      batchId: h._id,
      total: h.total,
      subidoPorNombre: h.subidoPorNombre,
      subidoPorUsername: h.subidoPorUsername,
      fecha: h.fecha,
      hojas: h.hojas.filter(Boolean),
    })));
  } catch (error) {
    console.error('Error obteniendo historial de claves:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Detalle de un lote específico
router.get('/historial/:batchId', async (req, res) => {
  try {
    const docs = await ClaveAsignacion.find({ batchId: req.params.batchId }).lean();
    res.json(docs.map(withNoEmpleado));
  } catch (error) {
    console.error('Error obteniendo detalle de lote:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Borrar todo (solo admin/admin_general/director; el coordinador puede subir pero no borrar todo)
router.delete('/all', requireRoles(['admin', 'admin_general', 'director']), async (req, res) => {
  try {
    const result = await ClaveAsignacion.deleteMany({});
    res.json({ success: true, message: `Se eliminaron ${result.deletedCount} registros de claves` });
  } catch (error) {
    console.error('Error eliminando claves:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
