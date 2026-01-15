import express from 'express';
import M1Master from '../models/M1Master.js';
import OperacionDia from '../models/OperacionDia.js';
import { normalizeCuenta, prepareDataForUpsert } from '../utils/cuentaHelper.js';
import { optimizeDocument } from '../utils/dataOptimizer.js';

const router = express.Router();

// Obtener todos los registros M1
router.get('/', async (req, res) => {
  try {
    const { estado, fecha } = req.query;
    const query = {};
    
    if (estado) query.estado = estado;
    if (fecha) {
      const fechaObj = new Date(fecha);
      query.createdAt = { $gte: fechaObj };
    }
    
    const m1 = await M1Master.find(query).sort({ createdAt: -1 });
    res.json(m1);
  } catch (error) {
    console.error('Error obteniendo M1:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener conteo
router.get('/count', async (req, res) => {
  try {
    const { estado, estatusFPD } = req.query;
    const query = {};
    
    if (estado) query.estado = estado;
    
    // Si se pide contar solo M1 (estatus FPD = M1)
    if (estatusFPD === 'M1') {
      // Contar solo los que tienen estatus FPD = M1 (no FPD CORRIENTE ni FPD PÉRDIDA)
      const allM1 = await M1Master.find({});
      let m1Count = 0;
      allM1.forEach(item => {
        const estatusFPDValue = (item['Estatus FPD'] || item['EstatusFPD'] || '').toUpperCase().trim();
        if (!estatusFPDValue.includes('PÉRDIDA') && 
            !estatusFPDValue.includes('PERDIDA') && 
            !estatusFPDValue.includes('PERDIDO') &&
            !estatusFPDValue.includes('CORRIENTE')) {
          m1Count++;
        }
      });
      return res.json({ count: m1Count });
    }
    
    const count = await M1Master.countDocuments(query);
    res.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo M1:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear o actualizar múltiples registros M1 (evita duplicados por cuenta)
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

    console.log(`📦 Recibidos ${data.length} registros para M1. Preparando importación...`);

    // 1) Preparar + optimizar + deduplicar por cuenta (el último registro gana)
    const byCuenta = new Map();
    for (const item of data) {
      try {
        const preparedData = prepareDataForUpsert(item, 'm1');
        if (!preparedData) {
          skipped++;
          continue;
        }
        const optimizedData = optimizeDocument(preparedData, 'm1');
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

    // 2) Reemplazo mensual: borrar todo + insertMany por lotes (MUY rápido)
    if (replaceAll) {
      console.log('🔄 Modo reemplazo mensual: Eliminando todos los registros M1 existentes...');
      const deleteResult = await M1Master.deleteMany({});
      console.log(`✅ deleteMany: ${deleteResult.deletedCount} eliminados`);

      const INSERT_BATCH = 1000;
      for (let i = 0; i < docs.length; i += INSERT_BATCH) {
        const slice = docs.slice(i, i + INSERT_BATCH).map(d => ({
          ...d,
          fechaCreacion: d.fechaCreacion || new Date(),
          fechaActualizacion: new Date()
        }));
        await M1Master.insertMany(slice, { ordered: false });
        created += slice.length;
        console.log(`✅ Insertados ${Math.min(i + INSERT_BATCH, docs.length)}/${docs.length}`);
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

    // 3) Modo normal: upsert/updates masivos por lotes (1 query + 1 bulkWrite por lote)
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(docs.length / BATCH_SIZE);
    console.log(`📊 Importando en ${totalBatches} lotes de ${BATCH_SIZE}...`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batch = docs.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
      const cuentas = batch.map(d => d.cuenta).filter(Boolean);

      const existingDocs = await M1Master.find(
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

          // Preservar teléfono/notas/promesa si ya existen en DB (igual que antes)
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
        const result = await M1Master.bulkWrite(ops, { ordered: false });
        created += result.insertedCount || 0;
        updated += result.modifiedCount || 0;
      }

      console.log(`✅ Lote ${batchIndex + 1}/${totalBatches} OK. Acumulado: ${created} creados, ${updated} actualizados, ${skipped} omitidos`);
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
    console.error('❌ Error en bulk M1:', error);
    console.error('Stack trace:', error.stack);
    console.error('Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Enviar respuesta con más detalles
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
    
    const m1 = await M1Master.findOne({
      $or: [
        { cuenta: normalized },
        { 'Nº de cuenta': normalized },
        { 'Cuenta': normalized }
      ]
    });
    
    if (!m1) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    
    res.json(m1);
  } catch (error) {
    console.error('Error obteniendo M1 por cuenta:', error);
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
    
    const m1 = await M1Master.findByIdAndUpdate(
      id,
      { estado, fechaActualizacion: new Date() },
      { new: true }
    );
    
    if (!m1) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    
    res.json(m1);
  } catch (error) {
    console.error('Error actualizando estado M1:', error);
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
    
    const m1 = await M1Master.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!m1) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    
    res.json(m1);
  } catch (error) {
    console.error('Error actualizando contacto M1:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar todos
router.delete('/all', async (req, res) => {
  try {
    await M1Master.deleteMany({});
    res.json({ success: true, message: 'Todos los registros M1 eliminados' });
  } catch (error) {
    console.error('Error eliminando M1:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

