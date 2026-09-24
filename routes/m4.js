import express from 'express';
import M4Master from '../models/M4Master.js';
import M3Master from '../models/M3Master.js';
import M2Master from '../models/M2Master.js';
import M1Master from '../models/M1Master.js';
import OperacionDia from '../models/OperacionDia.js';
import { normalizeCuenta, prepareDataForUpsert } from '../utils/cuentaHelper.js';
import { optimizeDocument } from '../utils/dataOptimizer.js';
import { requireAuth } from '../middleware/auth.js';
import { extractRegionFromRecord, normalizeRegion } from '../utils/regionAccess.js';
import { notifyAll } from '../utils/pushSender.js';
import ActivityEvent from '../models/ActivityEvent.js';
import { updateContactoInModel } from '../utils/contactoSync.js';

const router = express.Router();
router.use(requireAuth);

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
    const { estado, fecha, vendedor } = req.query;
    const query = {};
    if (estado) query.estado = estado;
    if (fecha) {
      const fechaObj = new Date(fecha);
      query.createdAt = { $gte: fechaObj };
    }
    if (vendedor) {
      query.$or = [
        { Vendedor: vendedor },
        { 'Vendedor': vendedor }
      ];
    }
    // lean() para acelerar (no necesitamos métodos de Mongoose en lectura)
    const m4 = await M4Master.find(query).sort({ createdAt: -1 }).lean();

    if (isScopedByRegion) {
      // Filtro robusto: si el registro no trae región, inferir por cuenta cruzando con OperacionDia (Hub/Plaza)
      const regionByCuenta = new Map();
      const missingCuentas = [];

      for (const doc of m4) {
        const obj = doc?.toObject ? doc.toObject() : doc;
        const cuenta = normalizeCuenta(obj) || obj?.cuenta;
        const reg = extractRegionFromRecord(obj);
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

      const filtered = m4.filter(doc => {
        const obj = doc?.toObject ? doc.toObject() : doc;
        const cuenta = normalizeCuenta(obj) || obj?.cuenta;
        const reg = (cuenta && regionByCuenta.get(cuenta)) ? regionByCuenta.get(cuenta) : extractRegionFromRecord(obj);
        return normalizeRegion(reg) === userRegion;
      });

      return res.json(filtered);
    }

    res.json(m4);
  } catch (error) {
    console.error('Error obteniendo M4:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/count', async (req, res) => {
  try {
    const { estado, estatusFPD, vendedor } = req.query;
    const query = {};
    
    // Construir condiciones base
    if (estado) {
      query.estado = estado;
    }
    
    // Para M4, el campo M4: 0 = FPD CORRIENTE (no debe), 1 = M4 (debe)
    if (estatusFPD === 'M4') {
      // Contar SOLO los que tienen M4 = 1 (que deben)
      query.$or = [
        { 'M4': 1 },
        { 'm4': 1 },
        { 'Estatus FPD': 'M4' },
        { 'EstatusFPD': 'M4' }
      ];
      // Excluir explícitamente los que tienen M4 = 0 o FPD CORRIENTE
      query.$and = [
        { $or: query.$or },
        {
          $nor: [
            { 'M4': 0 },
            { 'm4': 0 },
            { 'Estatus FPD': 'FPD CORRIENTE' },
            { 'EstatusFPD': 'FPD CORRIENTE' }
          ]
        }
      ];
      delete query.$or; // Ya está dentro de $and
    } else if (estatusFPD === 'FPD CORRIENTE') {
      // Contar los que tienen M4 = 0 (FPD CORRIENTE)
      query.$or = [
        { 'M4': 0 },
        { 'm4': 0 },
        { 'Estatus FPD': 'FPD CORRIENTE' },
        { 'EstatusFPD': 'FPD CORRIENTE' }
      ];
    }
    
    // Agregar filtro de vendedor si existe
    if (vendedor) {
      const vendorCondition = {
        $or: [
          { Vendedor: vendedor },
          { 'Vendedor': vendedor }
        ]
      };
      
      if (query.$and) {
        query.$and.push(vendorCondition);
      } else if (query.$or) {
        query.$and = [query.$or, vendorCondition];
        delete query.$or;
      } else {
        query.$and = [vendorCondition];
      }
    }
    
    // Cobranza (METROPOLITANA): conteo filtrado por región
    if (req.user?.role === 'cobranza_mx') {
      const userRegion = normalizeRegion('METROPOLITANA');
      const docs = await M4Master.find(query).lean();

      const regionByCuenta = new Map();
      const missingCuentas = [];

      for (const doc of docs) {
        const obj = doc?.toObject ? doc.toObject() : doc;
        const cuenta = normalizeCuenta(obj) || obj?.cuenta;
        const reg = extractRegionFromRecord(obj);
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

      let count = 0;
      for (const doc of docs) {
        const obj = doc?.toObject ? doc.toObject() : doc;
        const cuenta = normalizeCuenta(obj) || obj?.cuenta;
        if (!cuenta) continue;
        const reg = (cuenta && regionByCuenta.get(cuenta)) ? regionByCuenta.get(cuenta) : extractRegionFromRecord(obj);
        if (normalizeRegion(reg) === userRegion) count++;
      }

      return res.json({ count });
    }

    console.log('🔍 M4 Count Query:', JSON.stringify(query, null, 2));
    const count = await M4Master.countDocuments(query);
    console.log(`📊 M4 Count Result: ${count} (estatusFPD: ${estatusFPD || 'todos'})`);
    res.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo M4:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const { data, updateExisting = true, replaceAll = false } = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Se espera un array de datos' });
    }
    
    // Si es reemplazo mensual, eliminar todos los registros existentes primero
    if (replaceAll) {
      console.log('🔄 Modo reemplazo mensual: Eliminando todos los registros M4 existentes...');
      const deleteResult = await M4Master.deleteMany({});
      console.log(`✅ Eliminados ${deleteResult.deletedCount} registros M4 anteriores`);
    }
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // 1) Preparar cada fila (sin tocar la base de datos todavía) y calcular Estatus FPD
    const prepared = [];
    for (const item of data) {
      const cuenta = normalizeCuenta(item);
      if (!cuenta) { skipped++; continue; }

      const preparedData = prepareDataForUpsert(item, 'm4');

      // Procesar campo M4: 0 = FPD CORRIENTE (no debe), 1 = M4 (debe)
      let campoM4 = item['M4'] || item['m4'] || item['M4 '] || item['m4 '] || null;
      if (campoM4 === null || campoM4 === undefined || campoM4 === '') {
        campoM4 = item['Permanencia'] || item['permanencia'] || item['M2'] || item['m2'] || item['M2 '] || item['m2 '] || null;
      }

      let campoM4Num = null;
      if (campoM4 !== null && campoM4 !== undefined && campoM4 !== '') {
        if (typeof campoM4 === 'number') {
          campoM4Num = campoM4;
        } else {
          const str = String(campoM4).trim();
          if (str === '0' || str === '1') campoM4Num = parseInt(str, 10);
        }
      }

      if (campoM4Num === 0) {
        preparedData['Estatus FPD'] = 'FPD CORRIENTE';
        preparedData['EstatusFPD'] = 'FPD CORRIENTE';
        preparedData['M4'] = 0;
        preparedData.estado = 'Completa';
      } else if (campoM4Num === 1) {
        preparedData['Estatus FPD'] = 'M4';
        preparedData['EstatusFPD'] = 'M4';
        preparedData['M4'] = 1;
        preparedData.estado = 'Abierta';
      } else {
        preparedData['Estatus FPD'] = 'M4';
        preparedData['EstatusFPD'] = 'M4';
        preparedData.estado = 'Abierta';
      }

      prepared.push({ cuenta, item, optimizedData: optimizeDocument(preparedData, 'm4') });
    }

    console.log(`📊 [M4] ${prepared.length} filas listas (de ${data.length}), procesando en lotes...`);

    // 2) Procesar en lotes: por cada lote, UNA consulta $in a cada colección (no una por fila)
    const BATCH_SIZE = 500;
    for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
      const batch = prepared.slice(i, i + BATCH_SIZE);
      const cuentas = batch.map(b => b.cuenta);

      const [existingM4Docs, existingM3Docs, existingM2Docs, existingM1Docs, existingOperacionDocs] = await Promise.all([
        M4Master.find({ $or: [{ cuenta: { $in: cuentas } }, { 'Nº de cuenta': { $in: cuentas } }, { 'Cuenta': { $in: cuentas } }] }).lean(),
        M3Master.find({ $or: [{ cuenta: { $in: cuentas } }, { 'Nº de cuenta': { $in: cuentas } }, { 'Cuenta': { $in: cuentas } }] }).lean(),
        M2Master.find({ $or: [{ cuenta: { $in: cuentas } }, { 'Nº de cuenta': { $in: cuentas } }, { 'Cuenta': { $in: cuentas } }] }).lean(),
        M1Master.find({ $or: [{ cuenta: { $in: cuentas } }, { 'Nº de cuenta': { $in: cuentas } }, { 'Cuenta': { $in: cuentas } }] }).lean(),
        OperacionDia.find({ $or: [{ cuenta: { $in: cuentas } }, { 'Nº de cuenta': { $in: cuentas } }, { 'Cuenta': { $in: cuentas } }] }).lean(),
      ]);

      const byCuenta = (docs) => {
        const m = new Map();
        for (const d of docs) {
          const key = d.cuenta || d['Nº de cuenta'] || d['Cuenta'];
          if (key && !m.has(key)) m.set(key, d);
        }
        return m;
      };
      const mapM4 = byCuenta(existingM4Docs);
      const mapM3 = byCuenta(existingM3Docs);
      const mapM2 = byCuenta(existingM2Docs);
      const mapM1 = byCuenta(existingM1Docs);
      const mapOperacion = byCuenta(existingOperacionDocs);

      const ops = [];
      for (const { cuenta, item, optimizedData } of batch) {
        const existingM4 = mapM4.get(cuenta);

        if (existingM4) {
          if (!updateExisting) { skipped++; continue; }
          const updateData = {
            ...optimizedData,
            Telefono1: existingM4.Telefono1 || optimizedData.Telefono1 || item.Telefono1 || '',
            Telefono2: existingM4.Telefono2 || optimizedData.Telefono2 || item.Telefono2 || '',
            notaContacto: existingM4.notaContacto || optimizedData.notaContacto || '',
            fechaPromesaPago: existingM4.fechaPromesaPago || optimizedData.fechaPromesaPago || '',
            'Nota Contacto': existingM4['Nota Contacto'] || optimizedData['Nota Contacto'] || '',
            'Fecha Promesa Pago': existingM4['Fecha Promesa Pago'] || optimizedData['Fecha Promesa Pago'] || '',
            fechaCreacion: existingM4.fechaCreacion || new Date(),
            updatedAt: new Date(),
          };
          ops.push({ updateOne: { filter: { _id: existingM4._id }, update: { $set: optimizeDocument(updateData, 'm4') } } });
          updated++;
        } else {
          const existingM3 = mapM3.get(cuenta);
          const existingM2 = mapM2.get(cuenta);
          const existingM1 = mapM1.get(cuenta);
          const existingOperacion = mapOperacion.get(cuenta);
          const sourceRecord = existingM3 || existingM2 || existingM1 || existingOperacion;
          const origen = existingM3 ? 'm3' : existingM2 ? 'm2' : existingM1 ? 'm1' : 'operacion';

          if (sourceRecord) {
            const createData = {
              ...optimizedData,
              Telefono1: sourceRecord.Telefono1 || optimizedData.Telefono1 || item.Telefono1 || '',
              Telefono2: sourceRecord.Telefono2 || optimizedData.Telefono2 || item.Telefono2 || '',
              notaContacto: sourceRecord.notaContacto || optimizedData.notaContacto || '',
              fechaPromesaPago: sourceRecord.fechaPromesaPago || optimizedData.fechaPromesaPago || '',
              'Nota Contacto': sourceRecord['Nota Contacto'] || optimizedData['Nota Contacto'] || '',
              'Fecha Promesa Pago': sourceRecord['Fecha Promesa Pago'] || optimizedData['Fecha Promesa Pago'] || '',
              origen,
              fechaCreacion: sourceRecord?.fechaCreacion || new Date(),
            };
            ops.push({ insertOne: { document: optimizeDocument(createData, 'm4') } });
          } else {
            ops.push({ insertOne: { document: optimizedData } });
          }
          created++;
        }
      }

      if (ops.length > 0) {
        await M4Master.bulkWrite(ops, { ordered: false });
      }
      console.log(`✅ [M4] Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(prepared.length / BATCH_SIZE)} OK. Acumulado: ${created} creados, ${updated} actualizados`);
    }
    
    // Auditoría: registrar upload
    try {
      await ActivityEvent.create({
        type: 'upload',
        module: 'm4',
        userId: req.user?.id,
        username: req.user?.username || '',
        role: req.user?.role || '',
        region: req.user?.region || '',
        meta: { created, updated, skipped, total: data.length, replaceAll: false },
      });
    } catch (e) {
      console.warn('⚠️ No se pudo registrar ActivityEvent upload (m4):', e?.message || e);
    }

    if (created > 0 || updated > 0) { notifyAll('Sistema actualizado', `M4: ${created} creados, ${updated} actualizados`, '/').catch(() => {}); }
    res.json({ success: true, created, updated, skipped, total: data.length });
  } catch (error) {
    console.error('Error en bulk M4:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!['Abierta', 'Completa', 'Cancelada', 'Not done'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const m4 = await M4Master.findByIdAndUpdate(
      id,
      { estado, fechaActualizacion: new Date() },
      { new: true }
    );
    if (!m4) return res.status(404).json({ error: 'No encontrado' });
    res.json(m4);
  } catch (error) {
    console.error('Error actualizando estado M4:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar teléfono y notas (misma cuenta en M0-M6 para todos los roles)
router.put('/:id/contacto', async (req, res) => {
  try {
    const m4 = await updateContactoInModel(M4Master, req.params.id, req.body);
    if (!m4) return res.status(404).json({ error: 'No encontrado' });
    res.json(m4);
  } catch (error) {
    console.error('Error actualizando contacto M4:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar todos
router.delete('/all', async (req, res) => {
  try {
    await M4Master.deleteMany({});
    res.json({ success: true, message: 'Todos los registros M4 eliminados' });
  } catch (error) {
    console.error('Error eliminando M4:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

