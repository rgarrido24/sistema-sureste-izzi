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
    
    // Si es reemplazo mensual, eliminar todos los registros existentes primero
    if (replaceAll) {
      console.log('🔄 Modo reemplazo mensual: Eliminando todos los registros M1 existentes...');
      console.log('📋 Parámetro replaceAll recibido:', replaceAll);
      
      const countBefore = await M1Master.countDocuments({});
      console.log(`📊 Registros existentes antes de eliminar: ${countBefore}`);
      
      // Eliminar todos los registros
      const deleteResult = await M1Master.deleteMany({});
      console.log(`✅ Resultado deleteMany: ${deleteResult.deletedCount} eliminados, acknowledged: ${deleteResult.acknowledged}`);
      
      // Verificar inmediatamente después
      const countAfter = await M1Master.countDocuments({});
      console.log(`📊 Registros existentes después de eliminar: ${countAfter}`);
      
      // Si aún quedan registros, intentar nuevamente con diferentes métodos
      if (countAfter > 0) {
        console.log('⚠️ ADVERTENCIA: Aún quedan registros después de deleteMany. Intentando métodos alternativos...');
        
        // Intentar eliminar por lotes
        let remaining = await M1Master.countDocuments({});
        let attempts = 0;
        while (remaining > 0 && attempts < 5) {
          attempts++;
          console.log(`🔄 Intento ${attempts}: Eliminando ${remaining} registros restantes...`);
          await M1Master.deleteMany({});
          remaining = await M1Master.countDocuments({});
          console.log(`📊 Registros restantes después del intento ${attempts}: ${remaining}`);
        }
        
        if (remaining > 0) {
          console.log(`❌ ERROR: Aún quedan ${remaining} registros después de ${attempts} intentos`);
        } else {
          console.log(`✅ Todos los registros eliminados después de ${attempts} intentos`);
        }
      } else {
        console.log('✅ Todos los registros eliminados correctamente');
      }
    } else {
      console.log('📋 Modo normal (no reemplazo mensual) - replaceAll:', replaceAll);
    }
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    
    console.log(`📦 Procesando ${data.length} registros para M1...`);
    
    // DEBUG: Mostrar el primer registro para ver su estructura
    if (data.length > 0) {
      console.log('🔍 DEBUG - Primer registro recibido:');
      console.log('Campos disponibles:', Object.keys(data[0]));
      console.log('Primer registro (muestra):', JSON.stringify(data[0], null, 2).substring(0, 500));
      
      // Intentar detectar el campo cuenta en el primer registro
      const firstItem = data[0];
      const cuentaTest = normalizeCuenta(firstItem);
      console.log(`🔍 DEBUG - Campo "cuenta" detectado: "${cuentaTest}"`);
      if (!cuentaTest) {
        console.log('⚠️ ADVERTENCIA: No se pudo detectar el campo cuenta en el primer registro');
        console.log('Buscando campo "cuenta" manualmente...');
        for (const key in firstItem) {
          if (key.toLowerCase().includes('cuenta')) {
            console.log(`   - Encontrado campo similar: "${key}" = "${firstItem[key]}"`);
          }
        }
      }
    }
    
    // Procesar en lotes para evitar sobrecarga
    const BATCH_SIZE = 50; // Reducido para archivos grandes
    const totalBatches = Math.ceil(data.length / BATCH_SIZE);
    
    console.log(`📊 Procesando en ${totalBatches} lotes de ${BATCH_SIZE} registros cada uno`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batch = data.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
      console.log(`🔄 Procesando lote ${batchIndex + 1}/${totalBatches} (${batch.length} registros)...`);
      
      for (const item of batch) {
        try {
          const cuenta = normalizeCuenta(item);
          
          if (!cuenta) {
            // Log del primer item sin cuenta para debugging
            if (skipped === 0) {
              console.log('⚠️ Primer registro sin cuenta detectado.');
              console.log('⚠️ Campos disponibles:', Object.keys(item));
              console.log('⚠️ Valores de los primeros 5 campos:');
              const firstKeys = Object.keys(item).slice(0, 5);
              firstKeys.forEach(key => {
                console.log(`   - "${key}": "${item[key]}"`);
              });
              console.log('⚠️ Primer registro completo (primeros 500 caracteres):');
              console.log(JSON.stringify(item, null, 2).substring(0, 500));
              
              // Intentar encontrar cualquier campo que contenga "cuenta"
              const keysWithCuenta = Object.keys(item).filter(k => 
                k.toLowerCase().includes('cuenta')
              );
              if (keysWithCuenta.length > 0) {
                console.log('🔍 Campos que contienen "cuenta":', keysWithCuenta);
                keysWithCuenta.forEach(key => {
                  console.log(`   - "${key}": "${item[key]}"`);
                });
              }
            }
            skipped++;
            continue;
          }
          
          // Si es reemplazo mensual, no buscar existentes - todos son nuevos
          let existingM1 = null;
          if (!replaceAll) {
            // Solo buscar si NO es reemplazo mensual
            existingM1 = await M1Master.findOne({
              $or: [
                { cuenta },
                { 'Nº de cuenta': cuenta },
                { 'Cuenta': cuenta }
              ]
            });
          }
          
          const preparedData = prepareDataForUpsert(item, 'm1');
          
          if (!preparedData) {
            skipped++;
            continue;
          }
          
          // OPTIMIZAR DATOS: Eliminar campos vacíos y normalizar antes de guardar
          const optimizedData = optimizeDocument(preparedData, 'm1');
        
          if (existingM1 && !replaceAll) {
            // Solo actualizar si NO es reemplazo mensual
            if (updateExisting) {
              // Actualizar manteniendo campos importantes (teléfono y notas si existen)
              await M1Master.findByIdAndUpdate(existingM1._id, {
                ...optimizedData,
                // Preservar teléfono actualizado si existe
                Telefono1: existingM1.Telefono1 || preparedData.Telefono1 || item.Telefono1 || '',
                Telefono2: existingM1.Telefono2 || preparedData.Telefono2 || item.Telefono2 || '',
                'Telefono1': existingM1['Telefono1'] || preparedData['Telefono1'] || item['Telefono1'] || '',
                'Telefono2': existingM1['Telefono2'] || preparedData['Telefono2'] || item['Telefono2'] || '',
                // Preservar notas y promesas de pago
                notaContacto: existingM1.notaContacto || preparedData.notaContacto || '',
                fechaPromesaPago: existingM1.fechaPromesaPago || preparedData.fechaPromesaPago || '',
                'Nota Contacto': existingM1['Nota Contacto'] || preparedData['Nota Contacto'] || '',
                'Fecha Promesa Pago': existingM1['Fecha Promesa Pago'] || preparedData['Fecha Promesa Pago'] || '',
                fechaCreacion: existingM1.fechaCreacion || new Date(),
                updatedAt: new Date()
              });
              updated++;
            } else {
              skipped++;
            }
          } else {
            // Nuevo registro (o reemplazo mensual - todos son nuevos)
            await M1Master.create(optimizedData);
            created++;
          }
        } catch (itemError) {
          console.error(`❌ Error procesando item (cuenta: ${normalizeCuenta(item) || 'N/A'}):`, itemError.message);
          console.error('Item completo:', JSON.stringify(item, null, 2).substring(0, 200));
          errors.push({ 
            item: { cuenta: normalizeCuenta(item) || 'N/A', ...Object.keys(item).slice(0, 3).reduce((acc, key) => ({ ...acc, [key]: item[key] }), {}) },
            error: itemError.message 
          });
          // Continuar con el siguiente item en lugar de fallar todo
        }
      }
      
      // Log de progreso cada lote
      console.log(`✅ Lote ${batchIndex + 1} completado. Progreso: ${created} creados, ${updated} actualizados, ${skipped} omitidos`);
    }
    
    console.log(`✅ Procesamiento completo: ${created} creados, ${updated} actualizados, ${skipped} omitidos, ${errors.length} errores`);
    
    res.json({ 
      success: true, 
      created, 
      updated, 
      skipped,
      total: data.length,
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

