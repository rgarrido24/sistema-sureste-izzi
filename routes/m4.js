import express from 'express';
import M4Master from '../models/M4Master.js';
import M3Master from '../models/M3Master.js';
import M2Master from '../models/M2Master.js';
import M1Master from '../models/M1Master.js';
import OperacionDia from '../models/OperacionDia.js';
import { normalizeCuenta, prepareDataForUpsert } from '../utils/cuentaHelper.js';
import { optimizeDocument } from '../utils/dataOptimizer.js';
import { requireAuth } from '../middleware/auth.js';
import { applyRegionalFilterInMemory, normalizeRegion } from '../utils/regionAccess.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
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
    const m4 = await M4Master.find(query).sort({ createdAt: -1 });

    if (req.user?.role === 'regionales') {
      const userRegion = normalizeRegion(req.user.region || '');
      const filtered = applyRegionalFilterInMemory(m4, userRegion);
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
    
    for (const item of data) {
      const cuenta = normalizeCuenta(item);
      if (!cuenta) {
        skipped++;
        continue;
      }
      
      const existingM4 = await M4Master.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      
      // Buscar en todas las colecciones anteriores (flujo completo)
      const existingM3 = await M3Master.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      const existingM2 = await M2Master.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      const existingM1 = await M1Master.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      const existingOperacion = await OperacionDia.findOne({
        $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
      });
      
      const preparedData = prepareDataForUpsert(item, 'm4');
      
      // Procesar campo M4: 0 = FPD CORRIENTE (no debe), 1 = M4 (debe)
      // IMPORTANTE: En el archivo de M4, la columna L puede llamarse "M2" o "M4" pero contiene los valores 0/1 para M4
      // Buscar primero "M4", luego "M2" (porque el archivo puede tener "M2" en lugar de "M4")
      let campoM4 = item['M4'] || 
                    item['m4'] || 
                    item['M4 '] ||
                    item['m4 '] ||
                    null;
      
      // Si no se encuentra M4, buscar M2 (porque en el archivo de M4 la columna L puede llamarse "M2")
      if (campoM4 === null || campoM4 === undefined || campoM4 === '') {
        campoM4 = item['M2'] || item['m2'] || item['M2 '] || item['m2 '] || null;
        if (campoM4 !== null && campoM4 !== undefined && campoM4 !== '') {
          // Log solo para los primeros
          if (created + updated < 5) {
            console.log(`   - ⚠️ Campo M4 no encontrado, usando columna "M2" (columna L del archivo) con valor:`, campoM4);
          }
        }
      }
      
      // Log para debugging (solo los primeros 5)
      if (created + updated < 5) {
        console.log(`🔍 M4 - Item ${created + updated + 1}:`);
        console.log(`   - Campo M4 encontrado:`, campoM4);
        console.log(`   - Tipo:`, typeof campoM4);
        console.log(`   - Keys del item:`, Object.keys(item).slice(0, 20));
      }
      
      // Convertir a número si es string
      let campoM4Num = null;
      if (campoM4 !== null && campoM4 !== undefined && campoM4 !== '') {
        if (typeof campoM4 === 'number') {
          campoM4Num = campoM4;
        } else {
          const str = String(campoM4).trim();
          if (str === '0' || str === '1') {
            campoM4Num = parseInt(str, 10);
          }
        }
      }
      
      if (campoM4Num !== null) {
        if (campoM4Num === 0) {
          // 0 = No debe = FPD CORRIENTE
          preparedData['Estatus FPD'] = 'FPD CORRIENTE';
          preparedData['EstatusFPD'] = 'FPD CORRIENTE';
          preparedData['M4'] = 0;
          preparedData.estado = 'Completa';
        } else if (campoM4Num === 1) {
          // 1 = Debe = M4
          preparedData['Estatus FPD'] = 'M4';
          preparedData['EstatusFPD'] = 'M4';
          preparedData['M4'] = 1;
          preparedData.estado = 'Abierta';
        }
      } else {
        // Si no se encuentra el campo M4, asumir M4 por defecto
        preparedData['Estatus FPD'] = 'M4';
        preparedData['EstatusFPD'] = 'M4';
        preparedData.estado = 'Abierta';
      }
      
      // OPTIMIZAR DATOS: Eliminar campos vacíos y normalizar antes de guardar
      const optimizedData = optimizeDocument(preparedData, 'm4');
      
      if (existingM4) {
        if (updateExisting) {
          // Preservar teléfono y notas del registro existente
          const updateData = {
            ...optimizedData,
            Telefono1: existingM4.Telefono1 || preparedData.Telefono1 || item.Telefono1 || '',
            Telefono2: existingM4.Telefono2 || preparedData.Telefono2 || item.Telefono2 || '',
            'Telefono1': existingM4['Telefono1'] || preparedData['Telefono1'] || item['Telefono1'] || '',
            'Telefono2': existingM4['Telefono2'] || preparedData['Telefono2'] || item['Telefono2'] || '',
            notaContacto: existingM4.notaContacto || preparedData.notaContacto || '',
            fechaPromesaPago: existingM4.fechaPromesaPago || preparedData.fechaPromesaPago || '',
            'Nota Contacto': existingM4['Nota Contacto'] || preparedData['Nota Contacto'] || '',
            'Fecha Promesa Pago': existingM4['Fecha Promesa Pago'] || preparedData['Fecha Promesa Pago'] || '',
            fechaCreacion: existingM4.fechaCreacion || new Date(),
            updatedAt: new Date()
          };
          await M4Master.findByIdAndUpdate(existingM4._id, optimizeDocument(updateData, 'm4'));
          updated++;
        } else {
          skipped++;
        }
      } else if (existingM3 || existingM2 || existingM1 || existingOperacion) {
        // Preservar teléfono y notas del registro anterior (M3, M2, M1 o Operación)
        const sourceRecord = existingM3 || existingM2 || existingM1 || existingOperacion;
        const origen = existingM3 ? 'm3' : existingM2 ? 'm2' : existingM1 ? 'm1' : 'operacion';
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
        await M4Master.create(optimizeDocument(createData, 'm4'));
        created++;
      } else {
        await M4Master.create(optimizedData);
        created++;
      }
    }
    
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
    
    const m4 = await M4Master.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!m4) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    
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

