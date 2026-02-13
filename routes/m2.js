import express from 'express';
import M2Master from '../models/M2Master.js';
import M1Master from '../models/M1Master.js';
import OperacionDia from '../models/OperacionDia.js';
import { normalizeCuenta, prepareDataForUpsert } from '../utils/cuentaHelper.js';
import { optimizeDocument } from '../utils/dataOptimizer.js';
import { requireAuth } from '../middleware/auth.js';
import { extractRegionFromRecord, normalizeRegion } from '../utils/regionAccess.js';
import ActivityEvent from '../models/ActivityEvent.js';

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
    const m2 = await M2Master.find(query).sort({ createdAt: -1 }).lean();

    if (isScopedByRegion) {
      // Filtro robusto: si el registro no trae región, inferir por cuenta cruzando con OperacionDia (Hub/Plaza)
      const regionByCuenta = new Map();
      const missingCuentas = [];

      for (const doc of m2) {
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

      const filtered = m2.filter(doc => {
        const obj = doc?.toObject ? doc.toObject() : doc;
        const cuenta = normalizeCuenta(obj) || obj?.cuenta;
        const reg = (cuenta && regionByCuenta.get(cuenta)) ? regionByCuenta.get(cuenta) : extractRegionFromRecord(obj);
        return normalizeRegion(reg) === userRegion;
      });

      return res.json(filtered);
    }

    res.json(m2);
  } catch (error) {
    console.error('Error obteniendo M2:', error);
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
    
    // Para M2, el campo M2: 0 = FPD CORRIENTE (no debe), 1 = M2 (debe)
    if (estatusFPD === 'M2') {
      // Contar SOLO los que tienen M2 = 1 (que deben)
      // Consulta SIMPLE: solo contar donde M2 = 1 explícitamente
      // O donde Estatus FPD = M2 (pero asegurarse de que NO sea FPD CORRIENTE)
      query.$or = [
        { 'M2': 1 },
        { 'm2': 1 },
        { 
          $and: [
            { $or: [{ 'Estatus FPD': 'M2' }, { 'EstatusFPD': 'M2' }] },
            { 'Estatus FPD': { $ne: 'FPD CORRIENTE' } },
            { 'EstatusFPD': { $ne: 'FPD CORRIENTE' } }
          ]
        }
      ];
    } else if (estatusFPD === 'FPD CORRIENTE') {
      // Contar los que tienen M2 = 0 (FPD CORRIENTE)
      query.$or = [
        { 'M2': 0 },
        { 'm2': 0 },
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
      
      // Si ya hay $and, agregarlo al array, si no crear uno nuevo
      if (query.$and) {
        query.$and.push(vendorCondition);
      } else if (query.$or) {
        // Si hay $or, necesitamos combinar con $and
        query.$and = [query.$or, vendorCondition];
        delete query.$or;
      } else {
        query.$and = [vendorCondition];
      }
    }
    
    // Cobranza (METROPOLITANA): conteo filtrado por región
    if (req.user?.role === 'cobranza_mx') {
      const userRegion = normalizeRegion('METROPOLITANA');
      const docs = await M2Master.find(query).lean();

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

    console.log('🔍 M2 Count Query:', JSON.stringify(query, null, 2));
    console.log('🔍 M2 Count Query Params:', { estado, estatusFPD, vendedor });
    
    // Verificar primero cuántos documentos hay en total
    const totalCount = await M2Master.countDocuments({});
    console.log(`📊 Total documentos en M2Master: ${totalCount}`);
    
    // Verificar cuántos tienen M2 = 1
    const m2_1_count = await M2Master.countDocuments({ $or: [{ 'M2': 1 }, { 'm2': 1 }] });
    console.log(`📊 Documentos con M2 = 1: ${m2_1_count}`);
    
    // Verificar cuántos tienen M2 = 0
    const m2_0_count = await M2Master.countDocuments({ $or: [{ 'M2': 0 }, { 'm2': 0 }] });
    console.log(`📊 Documentos con M2 = 0: ${m2_0_count}`);
    
    // Verificar cuántos tienen Estatus FPD = M2
    const estatusM2_count = await M2Master.countDocuments({ $or: [{ 'Estatus FPD': 'M2' }, { 'EstatusFPD': 'M2' }] });
    console.log(`📊 Documentos con Estatus FPD = M2: ${estatusM2_count}`);
    
    const count = await M2Master.countDocuments(query);
    console.log(`📊 M2 Count Result: ${count} (estatusFPD: ${estatusFPD || 'todos'})`);
    res.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo M2:', error);
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
      console.log('🔄 Modo reemplazo mensual: Eliminando todos los registros M2 existentes...');
      const M2Master = (await import('../models/M2Master.js')).default;
      const deleteResult = await M2Master.deleteMany({});
      console.log(`✅ Eliminados ${deleteResult.deletedCount} registros M2 anteriores`);
    }
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const item of data) {
      const cuenta = normalizeCuenta(item);
      if (!cuenta) {
        skipped++;
        continue;
      }
      
      const existingM2 = await M2Master.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      
      const existingM1 = await M1Master.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      
      const existingOperacion = await OperacionDia.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      
      const preparedData = prepareDataForUpsert(item, 'm2');
      
      // Procesar campo M2: 0 = FPD CORRIENTE, 1 = M2 (debe)
      // Buscar en todas las variaciones posibles del nombre del campo
      const campoM2 = item['M2'] || 
                      item['m2'] || 
                      item['M2 '] ||
                      item['m2 '] ||
                      null;
      
      // Log para debugging (solo los primeros 5)
      if (created + updated < 5) {
        console.log(`🔍 M2 - Item ${created + updated + 1}:`);
        console.log(`   - Campo M2 encontrado:`, campoM2);
        console.log(`   - Tipo:`, typeof campoM2);
        console.log(`   - Keys del item:`, Object.keys(item).slice(0, 20));
      }
      
      // Convertir a número si es string
      let campoM2Num = null;
      if (campoM2 !== null && campoM2 !== undefined && campoM2 !== '') {
        if (typeof campoM2 === 'number') {
          campoM2Num = campoM2;
        } else {
          const str = String(campoM2).trim();
          if (str === '0' || str === '1') {
            campoM2Num = parseInt(str, 10);
          }
        }
      }
      
      if (campoM2Num !== null) {
        if (campoM2Num === 0) {
          // 0 = No debe = FPD CORRIENTE
          preparedData['Estatus FPD'] = 'FPD CORRIENTE';
          preparedData['EstatusFPD'] = 'FPD CORRIENTE';
          preparedData['M2'] = 0;
          preparedData.estado = 'Completa';
        } else if (campoM2Num === 1) {
          // 1 = Debe = M2
          preparedData['Estatus FPD'] = 'M2';
          preparedData['EstatusFPD'] = 'M2';
          preparedData['M2'] = 1;
          preparedData.estado = 'Abierta';
        }
      } else {
        // Si no se encuentra el campo M2, asumir M2 por defecto
        preparedData['Estatus FPD'] = 'M2';
        preparedData['EstatusFPD'] = 'M2';
        preparedData.estado = 'Abierta';
      }
      
      // OPTIMIZAR DATOS: Eliminar campos vacíos y normalizar antes de guardar
      const optimizedData = optimizeDocument(preparedData, 'm2');
      
      if (existingM2) {
        if (updateExisting) {
          // Preservar teléfono y notas del registro existente
          const updateData = {
            ...optimizedData,
            Telefono1: existingM2.Telefono1 || preparedData.Telefono1 || item.Telefono1 || '',
            Telefono2: existingM2.Telefono2 || preparedData.Telefono2 || item.Telefono2 || '',
            'Telefono1': existingM2['Telefono1'] || preparedData['Telefono1'] || item['Telefono1'] || '',
            'Telefono2': existingM2['Telefono2'] || preparedData['Telefono2'] || item['Telefono2'] || '',
            notaContacto: existingM2.notaContacto || preparedData.notaContacto || '',
            fechaPromesaPago: existingM2.fechaPromesaPago || preparedData.fechaPromesaPago || '',
            'Nota Contacto': existingM2['Nota Contacto'] || preparedData['Nota Contacto'] || '',
            'Fecha Promesa Pago': existingM2['Fecha Promesa Pago'] || preparedData['Fecha Promesa Pago'] || '',
            fechaCreacion: existingM2.fechaCreacion || new Date(),
            updatedAt: new Date()
          };
          await M2Master.findByIdAndUpdate(existingM2._id, optimizeDocument(updateData, 'm2'));
          updated++;
        } else {
          skipped++;
        }
      } else if (existingM1 || existingOperacion) {
        // Preservar teléfono y notas del M1 o Operación anterior
        const sourceRecord = existingM1 || existingOperacion;
        const createData = {
          ...optimizedData,
          Telefono1: sourceRecord.Telefono1 || optimizedData.Telefono1 || item.Telefono1 || '',
          Telefono2: sourceRecord.Telefono2 || optimizedData.Telefono2 || item.Telefono2 || '',
          'Telefono1': sourceRecord['Telefono1'] || optimizedData['Telefono1'] || item['Telefono1'] || '',
          'Telefono2': sourceRecord['Telefono2'] || optimizedData['Telefono2'] || item['Telefono2'] || '',
          notaContacto: sourceRecord.notaContacto || optimizedData.notaContacto || '',
          fechaPromesaPago: sourceRecord.fechaPromesaPago || optimizedData.fechaPromesaPago || '',
          'Nota Contacto': sourceRecord['Nota Contacto'] || optimizedData['Nota Contacto'] || '',
          'Fecha Promesa Pago': sourceRecord['Fecha Promesa Pago'] || optimizedData['Fecha Promesa Pago'] || '',
          origen: existingM1 ? 'm1' : 'operacion',
          fechaCreacion: sourceRecord?.fechaCreacion || new Date()
        };
        await M2Master.create(optimizeDocument(createData, 'm2'));
        created++;
      } else {
        await M2Master.create(optimizedData);
        created++;
      }
    }
    
    // Auditoría: registrar upload
    try {
      await ActivityEvent.create({
        type: 'upload',
        module: 'm2',
        userId: req.user?.id,
        username: req.user?.username || '',
        role: req.user?.role || '',
        region: req.user?.region || '',
        meta: { created, updated, skipped, total: data.length, replaceAll: false },
      });
    } catch (e) {
      console.warn('⚠️ No se pudo registrar ActivityEvent upload (m2):', e?.message || e);
    }

    res.json({ success: true, created, updated, skipped, total: data.length });
  } catch (error) {
    console.error('Error en bulk M2:', error);
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
    const m2 = await M2Master.findByIdAndUpdate(
      id,
      { estado, fechaActualizacion: new Date() },
      { new: true }
    );
    if (!m2) return res.status(404).json({ error: 'No encontrado' });
    res.json(m2);
  } catch (error) {
    console.error('Error actualizando estado M2:', error);
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
    
    const m2 = await M2Master.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!m2) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    
    res.json(m2);
  } catch (error) {
    console.error('Error actualizando contacto M2:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar todos
router.delete('/all', async (req, res) => {
  try {
    await M2Master.deleteMany({});
    res.json({ success: true, message: 'Todos los registros M2 eliminados' });
  } catch (error) {
    console.error('Error eliminando M2:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

