import express from 'express';
import InstallMaster from '../models/InstallMaster.js';
import { requireAuth } from '../middleware/auth.js';
import ActivityEvent from '../models/ActivityEvent.js';

const router = express.Router();
router.use(requireAuth);

// Obtener todos los registros
router.get('/', async (req, res) => {
  try {
    const installs = await InstallMaster.find();
    res.json(installs);
  } catch (error) {
    console.error('Error obteniendo installs:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener conteo
router.get('/count', async (req, res) => {
  try {
    const count = await InstallMaster.countDocuments();
    res.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear o actualizar múltiples registros
router.post('/bulk', async (req, res) => {
  try {
    const { data, updateExisting = true } = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Se espera un array de datos' });
    }

    // Normalizar número de orden desde varias columnas posibles
    const extractOrden = (item) => {
      const candidates = [
        item?.['Nº de orden'],
        item?.['N° de orden'],
        item?.['No. de orden'],
        item?.['No de orden'],
        item?.['Numero de orden'],
        item?.['Número de orden'],
        item?.Orden,
        item?.ORDEN,
        item?.['Orden'],
        item?.['ORDEN'],
      ];
      for (const v of candidates) {
        const s = String(v ?? '').trim();
        if (s) return s;
      }
      return '';
    };

    const normalizeOrdenKey = (orden) => String(orden || '').trim().replace(/\s+/g, '');

    // Deduplicar por ordenKey (último gana)
    const byOrden = new Map();
    for (const item of data) {
      const orden = extractOrden(item);
      const ordenKey = normalizeOrdenKey(orden);
      if (!ordenKey) continue;
      byOrden.set(ordenKey, {
        ...item,
        ordenKey,
        Orden: item?.Orden || item?.['Orden'] || orden,
        'Nº de orden': item?.['Nº de orden'] || item?.['N° de orden'] || item?.['No. de orden'] || orden,
      });
    }

    const docs = Array.from(byOrden.values());
    if (docs.length === 0) {
      return res.json({ success: true, created: 0, updated: 0, skipped: data.length, total: data.length });
    }

    let created = 0;
    let updated = 0;
    let skipped = data.length - docs.length;

    const BATCH_SIZE = 500;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      const keys = batch.map(d => d.ordenKey);
      const rawOrders = batch.map(d => extractOrden(d) || d?.Orden || d?.['Nº de orden'] || '').filter(Boolean);

      // Buscar existentes 1 vez por lote
      const existingDocs = await InstallMaster.find(
        {
          $or: [
            { ordenKey: { $in: keys } },
            { 'Nº de orden': { $in: rawOrders } },
            { Orden: { $in: rawOrders } },
          ],
        },
        { _id: 1, ordenKey: 1, 'Nº de orden': 1, Orden: 1, VendedorAsignado: 1, createdAt: 1 }
      ).lean();
      const existingByKey = new Map(
        existingDocs
          .map(d => {
            const k = normalizeOrdenKey(d?.ordenKey || d?.['Nº de orden'] || d?.Orden || '');
            return k ? [k, d] : null;
          })
          .filter(Boolean)
      );

      const ops = [];
      for (const doc of batch) {
        const existing = existingByKey.get(String(doc.ordenKey));
        if (existing) {
          if (!updateExisting) {
            skipped++;
            continue;
          }
          const updateData = {
            ...doc,
            ordenKey: doc.ordenKey,
            // Preservar asignación si ya existía
            VendedorAsignado: existing.VendedorAsignado || doc.VendedorAsignado || doc['VendedorAsignado'] || '',
            updatedAt: new Date(),
          };
          ops.push({
            updateOne: {
              filter: { _id: existing._id },
              update: { $set: updateData },
              upsert: false,
            },
          });
        } else {
          const createData = {
            ...doc,
            ordenKey: doc.ordenKey,
            createdAt: new Date(),
          };
          ops.push({
            insertOne: { document: createData },
          });
        }
      }

      if (ops.length > 0) {
        const result = await InstallMaster.bulkWrite(ops, { ordered: false });
        created += result.insertedCount || 0;
        updated += result.modifiedCount || 0;
      }
    }

    // Auditoría (opcional)
    try {
      await ActivityEvent.create({
        type: 'upload',
        module: 'install',
        userId: req.user?.id,
        username: req.user?.username || '',
        role: req.user?.role || '',
        region: req.user?.region || '',
        meta: { created, updated, total: data.length, processed: docs.length },
      });
    } catch (e) {
      // ignore
    }

    res.json({ success: true, created, updated, skipped, total: data.length, processed: docs.length });
  } catch (error) {
    console.error('Error en bulk installs:', error);
    res.status(500).json({
      error: 'Error del servidor',
      message: error.message || 'Error desconocido',
      type: error.name || 'Error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Eliminar todos
router.delete('/all', async (req, res) => {
  try {
    await InstallMaster.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando installs:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar registro específico
router.put('/:id', async (req, res) => {
  try {
    const updated = await InstallMaster.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando install:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

