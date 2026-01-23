import express from 'express';
import M3Master from '../models/M3Master.js';
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
    if (req.user?.role === 'regionales') {
      const userRegion = normalizeRegion(req.user.region || '');
      if (!userRegion) {
        return res.status(403).json({ error: 'Usuario regional sin región asignada. Pide a Admin que la configure.' });
      }
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
    const m3 = await M3Master.find(query).sort({ createdAt: -1 }).lean();

    if (req.user?.role === 'regionales') {
      const userRegion = normalizeRegion(req.user.region || '');
      // Filtro robusto: si el registro no trae región, inferir por cuenta cruzando con OperacionDia (Hub/Plaza)
      const regionByCuenta = new Map();
      const missingCuentas = [];

      for (const doc of m3) {
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

      const filtered = m3.filter(doc => {
        const obj = doc?.toObject ? doc.toObject() : doc;
        const cuenta = normalizeCuenta(obj) || obj?.cuenta;
        const reg = (cuenta && regionByCuenta.get(cuenta)) ? regionByCuenta.get(cuenta) : extractRegionFromRecord(obj);
        return normalizeRegion(reg) === userRegion;
      });

      return res.json(filtered);
    }

    res.json(m3);
  } catch (error) {
    console.error('Error obteniendo M3:', error);
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
    
    // Para M3, el campo M3: 0 = FPD CORRIENTE (no debe), 1 = M3 (debe)
    if (estatusFPD === 'M3') {
      // Contar SOLO los que tienen M3 = 1 (que deben)
      query.$or = [
        { 'M3': 1 },
        { 'm3': 1 },
        { 'Estatus FPD': 'M3' },
        { 'EstatusFPD': 'M3' }
      ];
      // Excluir explícitamente los que tienen M3 = 0 o FPD CORRIENTE
      query.$and = [
        { $or: query.$or },
        {
          $nor: [
            { 'M3': 0 },
            { 'm3': 0 },
            { 'Estatus FPD': 'FPD CORRIENTE' },
            { 'EstatusFPD': 'FPD CORRIENTE' }
          ]
        }
      ];
      delete query.$or; // Ya está dentro de $and
    } else if (estatusFPD === 'FPD CORRIENTE') {
      // Contar los que tienen M3 = 0 (FPD CORRIENTE)
      query.$or = [
        { 'M3': 0 },
        { 'm3': 0 },
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
    
    console.log('🔍 M3 Count Query:', JSON.stringify(query, null, 2));
    const count = await M3Master.countDocuments(query);
    console.log(`📊 M3 Count Result: ${count} (estatusFPD: ${estatusFPD || 'todos'})`);
    res.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo M3:', error);
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
      console.log('🔄 Modo reemplazo mensual: Eliminando todos los registros M3 existentes...');
      const M3Master = (await import('../models/M3Master.js')).default;
      const deleteResult = await M3Master.deleteMany({});
      console.log(`✅ Eliminados ${deleteResult.deletedCount} registros M3 anteriores`);
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
      
      const existingM3 = await M3Master.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      
      // Buscar en colecciones anteriores (flujo: operacion -> m1 -> m2 -> m3)
      const existingM2 = await M2Master.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      const existingM1 = await M1Master.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      const existingOperacion = await OperacionDia.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      
      const preparedData = prepareDataForUpsert(item, 'm3');
      
      // Procesar campo M3: 0 = FPD CORRIENTE (no debe), 1 = M3 (debe)
      // IMPORTANTE: En el archivo de M3, la columna L se llama "M2" pero contiene los valores 0/1 para M3
      // Buscar primero "M3", luego "M2" (porque el archivo puede tener "M2" en lugar de "M3")
      let campoM3 = item['M3'] || 
                    item['m3'] || 
                    item['M3 '] ||
                    item['m3 '] ||
                    null;
      
      // Si no se encuentra M3, buscar M2 (porque en el archivo de M3 la columna L se llama "M2")
      if (campoM3 === null || campoM3 === undefined || campoM3 === '') {
        campoM3 = item['M2'] || item['m2'] || item['M2 '] || item['m2 '] || null;
        if (campoM3 !== null && campoM3 !== undefined && campoM3 !== '') {
          // Log solo para los primeros
          if (created + updated < 5) {
            console.log(`   - ⚠️ Campo M3 no encontrado, usando columna "M2" (columna L del archivo) con valor:`, campoM3);
          }
        }
      }
      
      // Si aún no se encuentra, buscar en todas las keys que contengan "M3"
      if (campoM3 === null || campoM3 === undefined || campoM3 === '') {
        const allKeys = Object.keys(item);
        const m3Key = allKeys.find(key => {
          const keyUpper = key.toUpperCase().trim();
          return keyUpper === 'M3' || keyUpper.includes('M3');
        });
        if (m3Key) {
          campoM3 = item[m3Key];
          // Log solo para los primeros
          if (created + updated < 5) {
            console.log(`   - ✅ Campo M3 encontrado en key: "${m3Key}" con valor:`, campoM3);
          }
        }
      }
      
      // Log para debugging (solo los primeros 5)
      if (created + updated < 5) {
        console.log(`🔍 M3 - Item ${created + updated + 1}:`);
        console.log(`   - Campo M3 encontrado:`, campoM3);
        console.log(`   - Tipo:`, typeof campoM3);
        console.log(`   - TODAS las keys del item:`, Object.keys(item));
        
        // Buscar cualquier columna que pueda contener valores 0/1
        const allKeys = Object.keys(item);
        const numericKeys = allKeys.filter(key => {
          const val = item[key];
          if (val === null || val === undefined || val === '') return false;
          const num = typeof val === 'number' ? val : parseInt(String(val).trim(), 10);
          return !isNaN(num) && (num === 0 || num === 1);
        });
        
        if (numericKeys.length > 0) {
          console.log(`   - ⚠️ Columnas con valores 0 o 1 encontradas:`, numericKeys);
          numericKeys.forEach(key => {
            console.log(`     - ${key}:`, item[key], `(tipo: ${typeof item[key]})`);
          });
        }
        
        // Buscar keys que contengan "M3" o "m3" en cualquier parte
        const m3Keys = allKeys.filter(key => key.toUpperCase().includes('M3'));
        if (m3Keys.length > 0) {
          console.log(`   - Keys que contienen "M3":`, m3Keys);
          m3Keys.forEach(key => {
            console.log(`     - ${key}:`, item[key], `(tipo: ${typeof item[key]})`);
          });
        }
      }
      
      // Convertir a número si es string
      let campoM3Num = null;
      if (campoM3 !== null && campoM3 !== undefined && campoM3 !== '') {
        if (typeof campoM3 === 'number') {
          campoM3Num = campoM3;
        } else {
          const str = String(campoM3).trim();
          if (str === '0' || str === '1') {
            campoM3Num = parseInt(str, 10);
          }
        }
      }
      
      if (campoM3Num !== null) {
        if (campoM3Num === 0) {
          // 0 = No debe = FPD CORRIENTE
          preparedData['Estatus FPD'] = 'FPD CORRIENTE';
          preparedData['EstatusFPD'] = 'FPD CORRIENTE';
          preparedData['M3'] = 0;
          preparedData.estado = 'Completa';
        } else if (campoM3Num === 1) {
          // 1 = Debe = M3
          preparedData['Estatus FPD'] = 'M3';
          preparedData['EstatusFPD'] = 'M3';
          preparedData['M3'] = 1;
          preparedData.estado = 'Abierta';
        }
      } else {
        // Si no se encuentra el campo M3, asumir M3 por defecto
        preparedData['Estatus FPD'] = 'M3';
        preparedData['EstatusFPD'] = 'M3';
        preparedData.estado = 'Abierta';
      }
      
      // OPTIMIZAR DATOS: Eliminar campos vacíos y normalizar antes de guardar
      const optimizedData = optimizeDocument(preparedData, 'm3');
      
      if (existingM3) {
        if (updateExisting) {
          // Preservar teléfono y notas del registro existente
          const updateData = {
            ...optimizedData,
            Telefono1: existingM3.Telefono1 || preparedData.Telefono1 || item.Telefono1 || '',
            Telefono2: existingM3.Telefono2 || preparedData.Telefono2 || item.Telefono2 || '',
            'Telefono1': existingM3['Telefono1'] || preparedData['Telefono1'] || item['Telefono1'] || '',
            'Telefono2': existingM3['Telefono2'] || preparedData['Telefono2'] || item['Telefono2'] || '',
            notaContacto: existingM3.notaContacto || preparedData.notaContacto || '',
            fechaPromesaPago: existingM3.fechaPromesaPago || preparedData.fechaPromesaPago || '',
            'Nota Contacto': existingM3['Nota Contacto'] || preparedData['Nota Contacto'] || '',
            'Fecha Promesa Pago': existingM3['Fecha Promesa Pago'] || preparedData['Fecha Promesa Pago'] || '',
            fechaCreacion: existingM3.fechaCreacion || new Date(),
            updatedAt: new Date()
          };
          await M3Master.findByIdAndUpdate(existingM3._id, optimizeDocument(updateData, 'm3'));
          updated++;
        } else {
          skipped++;
        }
      } else if (existingM2 || existingM1 || existingOperacion) {
        // Preservar teléfono y notas del registro anterior (M2, M1 o Operación)
        const sourceRecord = existingM2 || existingM1 || existingOperacion;
        const origen = existingM2 ? 'm2' : existingM1 ? 'm1' : 'operacion';
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
          origen,
          fechaCreacion: sourceRecord?.fechaCreacion || new Date()
        };
        await M3Master.create(optimizeDocument(createData, 'm3'));
        created++;
      } else {
        await M3Master.create(optimizedData);
        created++;
      }
    }
    
    // Auditoría: registrar upload
    try {
      await ActivityEvent.create({
        type: 'upload',
        module: 'm3',
        userId: req.user?.id,
        username: req.user?.username || '',
        role: req.user?.role || '',
        region: req.user?.region || '',
        meta: { created, updated, skipped, total: data.length, replaceAll: false },
      });
    } catch (e) {
      console.warn('⚠️ No se pudo registrar ActivityEvent upload (m3):', e?.message || e);
    }

    res.json({ success: true, created, updated, skipped, total: data.length });
  } catch (error) {
    console.error('Error en bulk M3:', error);
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
    const m3 = await M3Master.findByIdAndUpdate(
      id,
      { estado, fechaActualizacion: new Date() },
      { new: true }
    );
    if (!m3) return res.status(404).json({ error: 'No encontrado' });
    res.json(m3);
  } catch (error) {
    console.error('Error actualizando estado M3:', error);
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
    
    const m3 = await M3Master.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!m3) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    
    res.json(m3);
  } catch (error) {
    console.error('Error actualizando contacto M3:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar todos
router.delete('/all', async (req, res) => {
  try {
    await M3Master.deleteMany({});
    res.json({ success: true, message: 'Todos los registros M3 eliminados' });
  } catch (error) {
    console.error('Error eliminando M3:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

