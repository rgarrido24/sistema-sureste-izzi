import express from 'express';
import M0Master from '../models/M0Master.js';
import OperacionDia from '../models/OperacionDia.js';
import { normalizeCuenta, prepareDataForUpsert } from '../utils/cuentaHelper.js';
import { optimizeDocument } from '../utils/dataOptimizer.js';
import { requireAuth } from '../middleware/auth.js';
import { extractRegionFromRecord, normalizeRegion } from '../utils/regionAccess.js';
import ActivityEvent from '../models/ActivityEvent.js';

const router = express.Router();
router.use(requireAuth);

// Obtener todos los registros M0
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role;
    const isScopedByRegion = role === 'regionales' || role === 'cobranza_mx';
    const userRegion = role === 'regionales'
      ? normalizeRegion(req.user.region || '')
      : role === 'cobranza_mx'
        ? normalizeRegion('METROPOLITANA')
        : '';

    if (isScopedByRegion && !userRegion) {
      return res.status(403).json({ error: 'Usuario regional sin región asignada. Pide a Admin que la configure.' });
    }
    const { estado, fecha } = req.query;
    const query = {};

    if (estado) query.estado = estado;
    if (fecha) {
      const fechaObj = new Date(fecha);
      query.createdAt = { $gte: fechaObj };
    }

    const m0 = await M0Master.find(query).sort({ createdAt: -1 }).lean();

    if (isScopedByRegion) {
      const regionByCuenta = new Map();
      const missingCuentas = [];

      for (const doc of m0) {
        const cuenta = doc?.cuenta;
        const reg = extractRegionFromRecord(doc);
        if (cuenta && reg) regionByCuenta.set(cuenta, reg);
        else if (cuenta) missingCuentas.push(cuenta);
      }

      if (missingCuentas.length > 0) {
        const uniqueMissing = Array.from(new Set(missingCuentas)).slice(0, 50000);
        const opDocs = await OperacionDia.find(
          { cuenta: { $in: uniqueMissing } },
          { cuenta: 1, Hub: 1, HUB: 1, Plaza: 1, PLAZA: 1, REGION: 1, Region: 1, 'Región': 1, 'REGIÓN': 1, SUBREGION: 1, 'SUBREGION': 1 }
        ).lean();

        for (const od of opDocs) {
          const cuenta = od?.cuenta;
          if (!cuenta) continue;
          if (regionByCuenta.has(cuenta)) continue;
          const reg = extractRegionFromRecord(od);
          if (reg) regionByCuenta.set(cuenta, reg);
        }
      }

      const filtered = m0.filter(doc => {
        const cuenta = doc?.cuenta;
        const reg = (cuenta && regionByCuenta.get(cuenta)) ? regionByCuenta.get(cuenta) : extractRegionFromRecord(doc);
        return normalizeRegion(reg) === userRegion;
      });

      return res.json(filtered);
    }

    res.json(m0);
  } catch (error) {
    console.error('Error obteniendo M0:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener conteo (M0 no tiene sub-estatus FPD resuelto: es la cosecha más nueva, aún sin resolver)
router.get('/count', async (req, res) => {
  try {
    const { estado } = req.query;
    const query = {};
    if (estado) query.estado = estado;

    const isCobranzaMetro = req.user?.role === 'cobranza_mx';
    const metroRegion = normalizeRegion('METROPOLITANA');

    if (isCobranzaMetro) {
      const docs = await M0Master.find(query).lean();

      const regionByCuenta = new Map();
      const missingCuentas = [];
      for (const doc of docs) {
        const cuenta = doc?.cuenta;
        if (!cuenta) continue;
        const reg = extractRegionFromRecord(doc);
        if (reg) regionByCuenta.set(cuenta, reg);
        else missingCuentas.push(cuenta);
      }
      if (missingCuentas.length > 0) {
        const uniqueMissing = Array.from(new Set(missingCuentas)).slice(0, 50000);
        const opDocs = await OperacionDia.find(
          { cuenta: { $in: uniqueMissing } },
          { cuenta: 1, Hub: 1, HUB: 1, Plaza: 1, PLAZA: 1, REGION: 1, Region: 1, 'Región': 1, 'REGIÓN': 1, SUBREGION: 1, 'SUBREGION': 1 }
        ).lean();
        for (const od of opDocs) {
          const cuenta = od?.cuenta;
          if (!cuenta) continue;
          if (regionByCuenta.has(cuenta)) continue;
          const reg = extractRegionFromRecord(od);
          if (reg) regionByCuenta.set(cuenta, reg);
        }
      }

      let count = 0;
      for (const doc of docs) {
        const cuenta = doc?.cuenta;
        if (!cuenta) continue;
        const reg = regionByCuenta.get(cuenta) || extractRegionFromRecord(doc);
        if (normalizeRegion(reg) === metroRegion) count++;
      }
      return res.json({ count });
    }

    const count = await M0Master.countDocuments(query);
    res.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo M0:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear o actualizar múltiples registros M0 (evita duplicados por cuenta)
router.post('/bulk', async (req, res) => {
  try {
    const { data, updateExisting = true, replaceAll = false } = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Se espera un array de datos' });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    console.log(`📦 Recibidos ${data.length} registros para M0. Preparando importación...`);

    const byCuenta = new Map();
    for (const item of data) {
      try {
        const preparedData = prepareDataForUpsert(item, 'm0');
        if (!preparedData) {
          skipped++;
          continue;
        }
        const optimizedData = optimizeDocument(preparedData, 'm0');
        const cuenta = optimizedData?.cuenta || preparedData?.cuenta || normalizeCuenta(item);
        if (!cuenta) {
          skipped++;
          continue;
        }
        byCuenta.set(cuenta, { ...optimizedData, cuenta });
      } catch (itemError) {
        errors.push({
          item: { cuenta: normalizeCuenta(item) || 'N/A' },
          error: itemError.message
        });
      }
    }

    const docs = Array.from(byCuenta.values());
    console.log(`🧾 Listos para procesar: ${docs.length} (deduplicados por cuenta). Omitidos: ${skipped}.`);

    if (replaceAll) {
      console.log('🔄 Modo reemplazo mensual: Eliminando todos los registros M0 existentes...');
      const deleteResult = await M0Master.deleteMany({});
      console.log(`✅ deleteMany: ${deleteResult.deletedCount} eliminados`);

      const INSERT_BATCH = 1000;
      for (let i = 0; i < docs.length; i += INSERT_BATCH) {
        const slice = docs.slice(i, i + INSERT_BATCH).map(d => ({
          ...d,
          fechaCreacion: d.fechaCreacion || new Date(),
          fechaActualizacion: new Date()
        }));
        await M0Master.insertMany(slice, { ordered: false });
        created += slice.length;
        console.log(`✅ Insertados ${Math.min(i + INSERT_BATCH, docs.length)}/${docs.length}`);
      }

      try {
        await ActivityEvent.create({
          type: 'upload',
          module: 'm0',
          userId: req.user?.id,
          username: req.user?.username || '',
          role: req.user?.role || '',
          region: req.user?.region || '',
          meta: { created, updated: 0, skipped, total: data.length, processed: docs.length, replaceAll: true },
        });
      } catch (e) {
        console.warn('⚠️ No se pudo registrar ActivityEvent upload (m0):', e?.message || e);
      }

      return res.json({
        success: true,
        created,
        updated: 0,
        skipped,
        total: data.length,
        processed: docs.length,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(docs.length / BATCH_SIZE);
    console.log(`📊 Importando en ${totalBatches} lotes de ${BATCH_SIZE}...`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batch = docs.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
      const cuentas = batch.map(d => d.cuenta).filter(Boolean);

      const existingDocs = await M0Master.find(
        { cuenta: { $in: cuentas } },
        {
          cuenta: 1,
          Telefono1: 1,
          Telefono2: 1,
          notaContacto: 1,
          fechaPromesaPago: 1,
          'Nota Contacto': 1,
          'Fecha Promesa Pago': 1,
          fechaCreacion: 1
        }
      ).lean();

      const existingByCuenta = new Map(existingDocs.map(d => [d.cuenta, d]));

      const ops = [];

      for (const doc of batch) {
        const cuenta = doc.cuenta;
        if (!cuenta) {
          skipped++;
          continue;
        }

        const existing = existingByCuenta.get(cuenta);

        if (existing) {
          if (!updateExisting) {
            skipped++;
            continue;
          }

          const updateDoc = {
            ...doc,
            Telefono1: existing.Telefono1 || doc.Telefono1 || '',
            Telefono2: existing.Telefono2 || doc.Telefono2 || '',
            notaContacto: existing.notaContacto || doc.notaContacto || '',
            fechaPromesaPago: existing.fechaPromesaPago || doc.fechaPromesaPago || '',
            'Nota Contacto': existing['Nota Contacto'] || doc['Nota Contacto'] || doc.notaContacto || '',
            'Fecha Promesa Pago': existing['Fecha Promesa Pago'] || doc['Fecha Promesa Pago'] || doc.fechaPromesaPago || '',
            fechaCreacion: existing.fechaCreacion || doc.fechaCreacion || new Date(),
            fechaActualizacion: new Date(),
            updatedAt: new Date()
          };

          ops.push({
            updateOne: {
              filter: { cuenta },
              update: { $set: updateDoc }
            }
          });
        } else {
          ops.push({
            insertOne: {
              document: {
                ...doc,
                fechaCreacion: doc.fechaCreacion || new Date(),
                fechaActualizacion: new Date()
              }
            }
          });
        }
      }

      if (ops.length > 0) {
        const result = await M0Master.bulkWrite(ops, { ordered: false });
        created += result.insertedCount || 0;
        updated += result.modifiedCount || 0;
      }

      console.log(`✅ Lote ${batchIndex + 1}/${totalBatches} OK. Acumulado: ${created} creados, ${updated} actualizados, ${skipped} omitidos`);
    }

    try {
      await ActivityEvent.create({
        type: 'upload',
        module: 'm0',
        userId: req.user?.id,
        username: req.user?.username || '',
        role: req.user?.role || '',
        region: req.user?.region || '',
        meta: { created, updated, skipped, total: data.length, processed: docs.length, replaceAll: false },
      });
    } catch (e) {
      console.warn('⚠️ No se pudo registrar ActivityEvent upload (m0):', e?.message || e);
    }

    return res.json({
      success: true,
      created,
      updated,
      skipped,
      total: data.length,
      processed: docs.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('❌ Error en bulk M0:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      error: 'Error del servidor',
      message: error.message || 'Error desconocido',
      type: error.name || 'Error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtener un registro por cuenta
router.get('/cuenta/:cuenta', async (req, res) => {
  try {
    const { cuenta } = req.params;
    const normalized = normalizeCuenta({ cuenta });

    const m0 = await M0Master.findOne({
      $or: [
        { cuenta: normalized },
        { 'Nº de cuenta': normalized },
        { 'Cuenta': normalized }
      ]
    });

    if (!m0) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    res.json(m0);
  } catch (error) {
    console.error('Error obteniendo M0 por cuenta:', error);
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

    const m0 = await M0Master.findByIdAndUpdate(
      id,
      { estado, fechaActualizacion: new Date() },
      { new: true }
    );

    if (!m0) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    res.json(m0);
  } catch (error) {
    console.error('Error actualizando estado M0:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar teléfono y notas de un registro
router.put('/:id/contacto', async (req, res) => {
  try {
    const { id } = req.params;
    const { telefono, notaContacto, fechaPromesaPago } = req.body;

    const updateData = { fechaActualizacion: new Date() };

    if (telefono !== undefined) {
      updateData.Telefono1 = telefono;
      updateData['Telefono1'] = telefono;
    }

    if (notaContacto !== undefined) {
      updateData.notaContacto = notaContacto;
      updateData['Nota Contacto'] = notaContacto;
    }

    if (fechaPromesaPago !== undefined) {
      updateData.fechaPromesaPago = fechaPromesaPago;
      updateData['Fecha Promesa Pago'] = fechaPromesaPago;
    }

    const m0 = await M0Master.findByIdAndUpdate(id, updateData, { new: true });

    if (!m0) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    res.json(m0);
  } catch (error) {
    console.error('Error actualizando contacto M0:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar todos
router.delete('/all', async (req, res) => {
  try {
    await M0Master.deleteMany({});
    res.json({ success: true, message: 'Todos los registros M0 eliminados' });
  } catch (error) {
    console.error('Error eliminando M0:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
