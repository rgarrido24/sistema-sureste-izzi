import express from 'express';
import OperacionDia from '../models/OperacionDia.js';
import SalesMaster from '../models/SalesMaster.js';
import InstallMaster from '../models/InstallMaster.js';
import M1Master from '../models/M1Master.js';
import M2Master from '../models/M2Master.js';
import M3Master from '../models/M3Master.js';
import M4Master from '../models/M4Master.js';
import { normalizeCuenta, prepareDataForUpsert } from '../utils/cuentaHelper.js';
import { optimizeDocument } from '../utils/dataOptimizer.js';
import { requireAuth } from '../middleware/auth.js';
import { applyRegionalFilterInMemory, normalizeRegion } from '../utils/regionAccess.js';

const router = express.Router();
router.use(requireAuth);

// Obtener todos los registros
router.get('/', async (req, res) => {
  try {
    if (req.user?.role === 'regionales') {
      const userRegion = normalizeRegion(req.user.region || '');
      if (!userRegion) {
        return res.status(403).json({ error: 'Usuario regional sin región asignada. Pide a Admin que la configure.' });
      }
    }
    const { estado, vendedor, limit } = req.query;
    const query = {};
    
    if (estado) {
      query.estado = estado;
    }
    
    // Si se especifica un vendedor, filtrar por vendedor asignado (case insensitive)
    if (vendedor) {
      const vendedorTrimmed = vendedor.trim();
      query.$or = [
        { 'Clave Vendedor': { $regex: vendedorTrimmed, $options: 'i' } },
        { 'CVVEN': { $regex: vendedorTrimmed, $options: 'i' } },
        { 'VendedorAsignado': { $regex: vendedorTrimmed, $options: 'i' } },
        { 'Vendedor': { $regex: vendedorTrimmed, $options: 'i' } },
        { 'Vendedor Asignado': { $regex: vendedorTrimmed, $options: 'i' } }
      ];
    }
    
    let q = OperacionDia.find(query).sort({ createdAt: -1 });

    // Soporte para export: limit=0 trae todo; si viene un número, cap de seguridad
    if (limit !== undefined) {
      const n = Number(limit);
      if (Number.isFinite(n) && n > 0) {
        q = q.limit(Math.min(n, 100000));
      }
    }

    const operaciones = await q;

    // Bloqueo por región (server-side) para regionales
    if (req.user?.role === 'regionales') {
      const userRegion = normalizeRegion(req.user.region || '');
      const filtered = applyRegionalFilterInMemory(operaciones, userRegion);
      return res.json(filtered);
    }

    res.json(operaciones);
  } catch (error) {
    console.error('Error obteniendo operaciones:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener conteo
router.get('/count', async (req, res) => {
  try {
    const count = await OperacionDia.countDocuments();
    // Nota: este count es total. Si luego quieres count por región, lo ajustamos con agregación.
    res.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear o actualizar múltiples registros (usa número de cuenta como clave única)
router.post('/bulk', async (req, res) => {
  try {
    const { data, updateExisting = true } = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Se espera un array de datos' });
    }
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    const stripBadKeys = (obj) => {
      if (!obj || typeof obj !== 'object') return {};
      const out = {};
      for (const [k0, v] of Object.entries(obj)) {
        const k = String(k0 || '').trim();
        if (!k) continue;
        if (k.startsWith('$')) continue;
        out[k] = v;
      }
      return out;
    };

    // 1) Preparar + deduplicar por cuenta (último gana)
    const byCuenta = new Map();
    for (const item of data) {
      try {
        const safeItem = stripBadKeys(item);
        // Reusar la lógica existente: si normalizeCuenta falla, prepareDataForUpsert suele rellenar
        // Nota: normalizeCuenta ya contempla varias variantes
        let cuenta = normalizeCuenta(safeItem) || '';
        // Si viene cuenta de facturación o Nº de cuenta en crudo, dejar que el normalizador extraiga dígitos
        if (!cuenta) {
          const direct = safeItem?.['Nº de cuenta'] || safeItem?.['N° de cuenta'] || safeItem?.['Cuenta de facturación'] || safeItem?.['Cuenta'] || safeItem?.['CUENTA'] || '';
          const numeric = String(direct || '').trim().replace(/[^\d]/g, '');
          cuenta = numeric || String(direct || '').trim().replace(/\s+/g, '');
        }
        const cuentaKey = String(cuenta || '').trim().replace(/\s+/g, '');
        if (!cuentaKey || cuentaKey.length < 3 || cuentaKey === 'undefined' || cuentaKey === 'null') {
          skipped++;
          continue;
        }

        const preparedData = prepareDataForUpsert(safeItem, 'operacion');
        if (!preparedData.estado) {
          preparedData.estado = safeItem['Estado'] || safeItem.Estado || 'Abierta';
        }

        const optimizedData = optimizeDocument(
          {
            ...preparedData,
            cuenta: cuentaKey,
            'Nº de cuenta': cuentaKey,
            'Cuenta de facturación': cuentaKey,
          },
          'operacion'
        );

        // CRÍTICO: No dejar fechaCreacion en $set, porque en upsert se define en $setOnInsert
        // Si va en ambos, Mongo lanza: "would create a conflict at 'fechaCreacion'"
        if ('fechaCreacion' in optimizedData) {
          delete optimizedData.fechaCreacion;
        }

        byCuenta.set(cuentaKey, optimizedData);
      } catch (itemError) {
        errors.push({ item, error: itemError.message });
      }
    }

    const docs = Array.from(byCuenta.values());
    if (docs.length === 0) {
      return res.json({ success: true, created: 0, updated: 0, skipped: data.length, total: data.length, errors: errors.length ? errors : undefined });
    }

    // 2) Procesar en lotes con bulkWrite
    const BATCH_SIZE = 500;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      const cuentas = batch.map(d => d.cuenta).filter(Boolean);

      const existingDocs = await OperacionDia.find(
        { cuenta: { $in: cuentas } },
        { _id: 1, cuenta: 1, VendedorAsignado: 1, Vendedor: 1, fechaCreacion: 1, createdAt: 1 }
      ).lean();
      const existingByCuenta = new Map(existingDocs.map(d => [String(d.cuenta), d]));

      const ops = [];
      for (const doc of batch) {
        const cuenta = doc.cuenta;
        if (!cuenta) continue;
        const existing = existingByCuenta.get(String(cuenta));
        if (existing && !updateExisting) {
          skipped++;
          continue;
        }

        const vendorKeep = existing?.VendedorAsignado || existing?.Vendedor || '';
        const docVendor = doc?.VendedorAsignado || doc?.Vendedor || '';

        const toSet = {
          ...doc,
          // Preservar vendedor si ya estaba asignado y el nuevo viene vacío
          ...(vendorKeep && !docVendor ? { VendedorAsignado: existing.VendedorAsignado || existing.Vendedor } : {}),
          updatedAt: new Date(),
        };
        // Evitar conflictos de upsert: fechaCreacion solo en $setOnInsert
        if ('fechaCreacion' in toSet) delete toSet.fechaCreacion;
        if ('createdAt' in toSet) delete toSet.createdAt;

        ops.push({
          updateOne: {
            filter: { cuenta },
            update: {
              $set: toSet,
              $setOnInsert: { fechaCreacion: new Date() },
            },
            upsert: true,
          },
        });
      }

      if (ops.length > 0) {
        const result = await OperacionDia.bulkWrite(ops, { ordered: false });
        created += result.upsertedCount || 0;
        updated += result.modifiedCount || 0;
      }
    }

    res.json({
      success: true,
      created,
      updated,
      skipped: skipped + (data.length - docs.length),
      total: data.length,
      processed: docs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error en bulk operaciones:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: error.message || 'Error desconocido',
      type: error.name || 'Error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Eliminar todos los registros de operación
router.delete('/all', async (req, res) => {
  try {
    const count = await OperacionDia.countDocuments();
    const result = await OperacionDia.deleteMany({});
    res.json({ 
      success: true,
      message: `Se eliminaron ${result.deletedCount} registros de operación`,
      deletedCount: result.deletedCount,
      previousCount: count
    });
    console.log(`🗑️ Eliminados ${result.deletedCount} registros de operación (anteriormente había ${count})`);
  } catch (error) {
    console.error('Error eliminando operaciones:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener conteo de registros (útil para verificar antes de limpiar)
router.get('/stats', async (req, res) => {
  try {
    const total = await OperacionDia.countDocuments();
    const byEstado = await OperacionDia.aggregate([
      {
        $group: {
          _id: '$Estado',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      total,
      byEstado: byEstado.reduce((acc, item) => {
        acc[item._id || 'Sin estado'] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar vendedor asignado
router.put('/update-vendor/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendedor } = req.body;
    
    if (!vendedor) {
      return res.status(400).json({ error: 'Se requiere el nombre del vendedor' });
    }
    
    const updated = await OperacionDia.findByIdAndUpdate(
      id,
      {
        'Clave Vendedor': vendedor,
        'CVVEN': vendedor,
        'VendedorAsignado': vendedor,
        'Vendedor': vendedor,
        'Vendedor Asignado': vendedor,
        fechaActualizacion: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando vendedor:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar registro específico
router.put('/:id', async (req, res) => {
  try {
    const updated = await OperacionDia.findByIdAndUpdate(
      req.params.id,
      { ...req.body, fechaActualizacion: new Date(), updatedAt: new Date() },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando operacion:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar estado de un registro
router.put('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    if (!['Abierta', 'Completa', 'Cancelada', 'Not done'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    
    const operacion = await OperacionDia.findByIdAndUpdate(
      id,
      { estado, fechaActualizacion: new Date() },
      { new: true }
    );
    
    if (!operacion) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    
    res.json(operacion);
  } catch (error) {
    console.error('Error actualizando estado operacion:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar vendedor asignado a una operación
router.put('/:id/vendedor', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendedor } = req.body;
    
    if (!vendedor || vendedor.trim() === '') {
      return res.status(400).json({ error: 'El nombre del vendedor es requerido' });
    }
    
    const operacion = await OperacionDia.findByIdAndUpdate(
      id,
      { 
        'Clave Vendedor': vendedor.trim(),
        'CVVEN': vendedor.trim(),
        'VendedorAsignado': vendedor.trim(),
        'Vendedor': vendedor.trim(),
        'Vendedor Asignado': vendedor.trim(),
        fechaActualizacion: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!operacion) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    
    console.log(`✅ Vendedor asignado: ${vendedor.trim()} a operación ${id}`);
    res.json(operacion);
  } catch (error) {
    console.error('Error actualizando vendedor operacion:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cache simple en memoria para evitar re-calcular en cada request (Render free)
let vendorsCache = { at: 0, vendors: [] };
const VENDORS_CACHE_MS = 10 * 60 * 1000;

function normalizeVendorKey(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function isValidVendorValue(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  const low = v.toLowerCase();
  if (low === 'sin dato' || low === 'sin datos' || low === 'n/a' || low === 'na') return false;
  if (v.length < 3) return false;
  return true;
}

async function collectDistinct(model, fields = []) {
  const out = [];
  for (const field of fields) {
    try {
      const vals = await model.distinct(field);
      if (Array.isArray(vals)) out.push(...vals);
    } catch (e) {
      // algunos campos pueden no existir en colecciones → ignorar
    }
  }
  return out;
}

// Obtener lista de vendedores únicos (rápido) para asignación en Operación
router.get('/vendors', async (req, res) => {
  try {
    const now = Date.now();
    if (vendorsCache.vendors.length > 0 && now - vendorsCache.at < VENDORS_CACHE_MS) {
      return res.json({ vendors: vendorsCache.vendors, cached: true });
    }

    // Campos relevantes: conservar tal cual (sin "capitalizar") para que salgan claves tipo CVVEN...
    const vendorFields = [
      'Vendedor',
      'VendedorAsignado',
      'Vendedor Asignado',
      'Clave Vendedor',
      'CVVEN',
      'VENDEDOR',
      'VENDEDORASIGNADO',
      'Clave vendedor',
      'Cvven',
    ];

    const allValues = [];
    // Para que coincida con Cobranza, priorizamos M1-M4 + SalesMaster y luego OperacionDia
    allValues.push(...await collectDistinct(M1Master, vendorFields));
    allValues.push(...await collectDistinct(M2Master, vendorFields));
    allValues.push(...await collectDistinct(M3Master, vendorFields));
    allValues.push(...await collectDistinct(M4Master, vendorFields));
    allValues.push(...await collectDistinct(SalesMaster, vendorFields));
    allValues.push(...await collectDistinct(OperacionDia, vendorFields));

    const byKey = new Map();
    for (const v of allValues) {
      if (!isValidVendorValue(v)) continue;
      const key = normalizeVendorKey(v);
      if (!byKey.has(key)) byKey.set(key, String(v).trim());
    }

    const vendors = Array.from(byKey.values()).sort((a, b) => normalizeVendorKey(a).localeCompare(normalizeVendorKey(b)));
    vendorsCache = { at: now, vendors };
    res.json({ vendors, cached: false });
  } catch (error) {
    console.error('Error obteniendo vendedores:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

