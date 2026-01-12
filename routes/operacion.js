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

const router = express.Router();

// Obtener todos los registros
router.get('/', async (req, res) => {
  try {
    const { estado, vendedor } = req.query;
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
    
    const operaciones = await OperacionDia.find(query).sort({ createdAt: -1 });
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
    
    for (const item of data) {
      try {
        // Log para debugging (solo los primeros 5 registros)
        if (created + updated + skipped < 5) {
          console.log('🔍 Operación - Item:', created + updated + skipped + 1);
          console.log('   - Keys del item:', Object.keys(item));
          console.log('   - Buscando campo "Nº de cuenta":', item['Nº de cuenta']);
          console.log('   - Buscando campo "N° de cuenta":', item['N° de cuenta']);
          console.log('   - Buscando campo "Cuenta":', item['Cuenta']);
          console.log('   - Buscando campo "CUENTA":', item['CUENTA']);
          console.log('   - Item completo (primeros campos):', Object.keys(item).slice(0, 10).reduce((acc, key) => {
            acc[key] = item[key];
            return acc;
          }, {}));
        }
        
        // Intentar obtener cuenta directamente primero (prioridad para operación)
        let cuenta = '';
        
        // DEBUG: Mostrar TODOS los campos del item para identificar el nombre exacto
        if (created + updated + skipped < 3) {
          console.log('   - 🔍 TODOS los campos del item:', Object.keys(item));
          console.log('   - 🔍 Valores de campos relacionados con cuenta:');
          Object.keys(item).forEach(key => {
            const keyLower = key.toLowerCase();
            if (keyLower.includes('cuenta') || keyLower.includes('facturacion') || keyLower.includes('facturación')) {
              console.log(`      "${key}": "${item[key]}"`);
            }
          });
        }
        
        // Buscar en todas las variaciones posibles de "Cuenta de facturación" (columna AT)
        const cuentaFacturacionVariations = [
          'Cuenta de facturación',
          'Cuenta de Facturación',
          'CUENTA DE FACTURACIÓN',
          'cuenta de facturación',
          'Cuenta De Facturación',
          'CUENTA DE FACTURACION',  // Sin tilde
          'Cuenta de Facturacion',   // Sin tilde
          'Cuenta de facturacion',  // Sin tilde minúsculas
          'CUENTA DE FACTURACION',  // Sin tilde mayúsculas
          'Cuenta De Facturacion'   // Sin tilde
        ];
        
        for (const field of cuentaFacturacionVariations) {
          const value = item[field];
          if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
            const valueStr = String(value).trim();
            // Aceptar cualquier valor que no sea solo espacios
            if (valueStr && valueStr !== 'undefined' && valueStr !== 'null') {
              cuenta = valueStr;
              if (created + updated + skipped < 3) {
                console.log(`   - ✅ Cuenta encontrada en "${field}":`, cuenta);
              }
              break;
            }
          }
        }
        
        // Si no se encontró, buscar "Nº de cuenta" (columna BQ)
        if (!cuenta) {
          const cuentaNumVariations = [
            'Nº de cuenta',
            'N° de cuenta',
            'Nº Cuenta',
            'N° Cuenta',
            'No. de cuenta',
            'No. Cuenta',
            'Nº DE CUENTA',
            'N° DE CUENTA',
            'NO. DE CUENTA'
          ];
          
          for (const field of cuentaNumVariations) {
            const value = item[field];
            if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
              const valueStr = String(value).trim();
              // Aceptar si es numérico (incluso con espacios o caracteres especiales que se puedan limpiar)
              const numericValue = valueStr.replace(/[^\d]/g, '');
              if (numericValue && numericValue.length >= 3) {
                cuenta = numericValue;
                if (created + updated + skipped < 3) {
                  console.log(`   - ✅ Cuenta encontrada en "${field}":`, cuenta, '(original:', valueStr + ')');
                }
                break;
              }
            }
          }
        }
        
        // Si aún no se encontró, buscar en TODOS los campos que contengan "cuenta" o "facturacion"
        if (!cuenta) {
          Object.keys(item).forEach(key => {
            if (!cuenta) {
              const keyLower = key.toLowerCase();
              if ((keyLower.includes('cuenta') || keyLower.includes('facturacion') || keyLower.includes('facturación')) && 
                  !keyLower.includes('nocuenta') && !keyLower.includes('no cuenta') && 
                  !keyLower.includes('vendedor') && !keyLower.includes('clave')) {
                const value = item[key];
                if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
                  const valueStr = String(value).trim();
                  // Si el campo es "Cuenta de facturación", aceptar cualquier valor
                  if (keyLower.includes('facturacion') || keyLower.includes('facturación')) {
                    cuenta = valueStr;
                    if (created + updated + skipped < 3) {
                      console.log(`   - ✅ Cuenta encontrada en campo "${key}":`, cuenta);
                    }
                    return; // Salir del forEach
                  }
                  // Para otros campos, solo aceptar si es numérico
                  const numericValue = valueStr.replace(/[^\d]/g, '');
                  if (numericValue && numericValue.length >= 3) {
                    cuenta = numericValue;
                    if (created + updated + skipped < 3) {
                      console.log(`   - ✅ Cuenta encontrada en campo "${key}":`, cuenta, '(original:', valueStr + ')');
                    }
                    return; // Salir del forEach
                  }
                }
              }
            }
          });
        }
        
        // Si aún no se encontró, usar normalizeCuenta como fallback
        if (!cuenta) {
          cuenta = normalizeCuenta(item);
          if (created + updated + skipped < 3) {
            console.log('   - 🔍 Usando normalizeCuenta como fallback:', cuenta);
            if (!cuenta) {
              console.log('   - ❌ normalizeCuenta tampoco encontró cuenta');
              // Último intento: buscar cualquier campo que tenga un valor numérico largo
              Object.keys(item).forEach(key => {
                if (!cuenta) {
                  const value = item[key];
                  if (value !== undefined && value !== null) {
                    const valueStr = String(value).trim();
                    const numericOnly = valueStr.replace(/[^\d]/g, '');
                    // Si tiene al menos 6 dígitos, probablemente es una cuenta
                    if (numericOnly && numericOnly.length >= 6) {
                      cuenta = numericOnly;
                      if (created + updated + skipped < 3) {
                        console.log(`   - ⚠️ Cuenta encontrada en campo genérico "${key}":`, cuenta);
                      }
                    }
                  }
                }
              });
            }
          }
        }
        
        // Limpiar y normalizar el valor - extraer solo números si es necesario
        if (cuenta) {
          // Si la cuenta tiene caracteres no numéricos, intentar extraer solo números
          const numericOnly = String(cuenta).replace(/[^\d]/g, '');
          if (numericOnly && numericOnly.length >= 3) {
            cuenta = numericOnly;
          } else {
            // Si no tiene suficientes números, usar el valor original limpio
            cuenta = String(cuenta).trim().replace(/\s+/g, '');
          }
        } else {
          cuenta = '';
        }
        
        if (created + updated + skipped < 3) {
          console.log('   - Cuenta final obtenida:', cuenta);
          console.log('   - Primeros 20 campos del item:', Object.keys(item).slice(0, 20));
        }
        
        // CRÍTICO: Solo rechazar si realmente no hay cuenta
        // Aceptar cualquier valor que tenga al menos 3 caracteres (numéricos o alfanuméricos)
        if (!cuenta || cuenta === 'undefined' || cuenta === 'null' || cuenta === '' || cuenta.length < 3) {
          if (created + updated + skipped < 3) {
            console.log('   - ❌ Cuenta vacía o inválida, saltando registro');
            console.log('   - Item completo (primeros campos):', Object.keys(item).slice(0, 15).reduce((acc, key) => {
              acc[key] = item[key];
              return acc;
            }, {}));
          }
          skipped++;
          continue;
        }
        
        // CRÍTICO: Buscar por número de cuenta (clave única)
        // Si el número de cuenta es el mismo, solo actualizar (no duplicar)
        // Normalizar la cuenta para búsqueda (eliminar espacios, convertir a string)
        const cuentaNormalizada = String(cuenta).trim().replace(/\s+/g, '');
        
        if (!cuentaNormalizada || cuentaNormalizada === 'undefined' || cuentaNormalizada === 'null') {
          if (created + updated + skipped < 5) {
            console.log(`   - ⚠️ Cuenta vacía o inválida, saltando registro`);
          }
          skipped++;
          continue;
        }
        
        // BÚSQUEDA OPTIMIZADA Y ROBUSTA:
        // 1. Buscar primero en el campo 'cuenta' normalizado (índice principal) - MÁS RÁPIDO
        let existing = await OperacionDia.findOne({ cuenta: cuentaNormalizada });
        
        // 2. Si no se encontró, buscar en otros campos usando regex (más flexible)
        if (!existing) {
          // Buscar en 'Nº de cuenta' normalizando con regex
          existing = await OperacionDia.findOne({
            $or: [
              { 'Nº de cuenta': cuentaNormalizada },
              { 'Nº de cuenta': { $regex: `^\\s*${cuentaNormalizada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, $options: 'i' } }
            ]
          });
        }
        
        // 3. Si aún no se encontró, buscar en 'Cuenta de facturación'
        if (!existing) {
          existing = await OperacionDia.findOne({
            $or: [
              { 'Cuenta de facturación': cuentaNormalizada },
              { 'Cuenta de facturación': { $regex: `^\\s*${cuentaNormalizada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, $options: 'i' } }
            ]
          });
        }
        
        // 4. Si aún no se encontró, buscar en 'Cuenta'
        if (!existing) {
          existing = await OperacionDia.findOne({
            $or: [
              { 'Cuenta': cuentaNormalizada },
              { 'Cuenta': { $regex: `^\\s*${cuentaNormalizada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, $options: 'i' } }
            ]
          });
        }
        
        // Log para debugging
        if (created + updated + skipped < 5) {
          console.log(`   - 🔍 Buscando cuenta normalizada: "${cuentaNormalizada}"`);
          console.log(`   - 🔍 Registro existente encontrado:`, existing ? 'SÍ' : 'NO');
          if (existing) {
            console.log(`   - 🔍 ID del existente:`, existing._id);
            console.log(`   - 🔍 Cuenta del existente:`, existing.cuenta || existing['Nº de cuenta'] || existing['Cuenta de facturación']);
          }
        }
        
        const preparedData = prepareDataForUpsert(item, 'operacion');
        
        // Si no tiene estado, establecer por defecto
        if (!preparedData.estado) {
          preparedData.estado = item['Estado'] || item.Estado || 'Abierta';
        }
        
        // OPTIMIZAR DATOS: Eliminar campos vacíos y normalizar antes de guardar
        const optimizedData = optimizeDocument({
          ...preparedData,
          cuenta: cuentaNormalizada,
          'Nº de cuenta': cuentaNormalizada,
          'Cuenta de facturación': cuentaNormalizada
        }, 'operacion');
        
        if (existing) {
          if (updateExisting) {
            // CRÍTICO: Si el número de cuenta es el mismo, ACTUALIZAR (no crear duplicado)
            // Mantener la última versión como estatus definitivo
            const updateResult = await OperacionDia.findByIdAndUpdate(existing._id, {
              ...optimizedData,
              fechaCreacion: existing.fechaCreacion || existing.createdAt || new Date(),
              updatedAt: new Date()
            }, { new: true });
            
            if (created + updated + skipped < 5) {
              console.log(`   - ✅ Registro ACTUALIZADO (ID: ${existing._id})`);
            }
            updated++;
          } else {
            if (created + updated + skipped < 5) {
              console.log(`   - ⏭️ Registro existente omitido (updateExisting=false)`);
            }
            skipped++;
          }
        } else {
          // Nuevo registro (número de cuenta diferente)
          const newRecord = await OperacionDia.create(optimizedData);
          
          if (created + updated + skipped < 5) {
            console.log(`   - ✅ Nuevo registro CREADO (ID: ${newRecord._id})`);
          }
          created++;
        }
      } catch (itemError) {
        errors.push({ item, error: itemError.message });
      }
    }
    
    res.json({ 
      success: true, 
      created, 
      updated, 
      skipped,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error en bulk operaciones:', error);
    res.status(500).json({ error: 'Error del servidor' });
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

// Función auxiliar para extraer vendedores de un registro
function extractVendorsFromRecord(record) {
  const vendors = new Set();
  const recordObj = record.toObject ? record.toObject() : record;
  
  // Campos conocidos de vendedor
  const vendorFields = [
    'Vendedor', 'VendedorAsignado', 'Vendedor Asignado',
    'Clave Vendedor', 'CVVEN', 'VENDEDOR', 'VENDEDORASIGNADO'
  ];
  
  vendorFields.forEach(field => {
    if (recordObj[field] && String(recordObj[field]).trim() !== '') {
      const value = String(recordObj[field]).trim();
      // Excluir valores inválidos
      if (value.toLowerCase() !== 'sin dato' && 
          value.toLowerCase() !== 'sin datos' &&
          value.toLowerCase() !== 'n/a' &&
          value.toLowerCase() !== 'na' &&
          value.length > 2) {
        // Capitalizar correctamente
        const capitalized = value.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        vendors.add(capitalized);
      }
    }
  });
  
  // Buscar en todos los campos que contengan "vendedor"
  Object.keys(recordObj).forEach(key => {
    const keyUpper = key.toUpperCase();
    if ((keyUpper.includes('VENDEDOR') || keyUpper.includes('VENDOR')) && 
        recordObj[key] && String(recordObj[key]).trim() !== '') {
      const value = String(recordObj[key]).trim();
      // Excluir valores inválidos y códigos cortos
      if (value.toLowerCase() !== 'sin dato' && 
          value.toLowerCase() !== 'sin datos' &&
          value.toLowerCase() !== 'n/a' &&
          value.toLowerCase() !== 'na' &&
          value.length > 3 && 
          !value.match(/^[A-Z0-9]{1,3}$/)) { // No códigos de 1-3 caracteres
        const capitalized = value.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        vendors.add(capitalized);
      }
    }
  });
  
  return vendors;
}

// Obtener lista de vendedores únicos de TODAS las colecciones
router.get('/vendors', async (req, res) => {
  try {
    const allVendorsSet = new Set();
    
    console.log('🔍 Buscando vendedores en todas las colecciones...');
    
    // 1. Buscar en M1Master
    console.log('   - Buscando en M1Master...');
    const allM1 = await M1Master.find({}).limit(50000);
    allM1.forEach(record => {
      const vendors = extractVendorsFromRecord(record);
      vendors.forEach(v => allVendorsSet.add(v));
    });
    console.log(`   - M1Master: ${allVendorsSet.size} vendedores únicos hasta ahora`);
    
    // 2. Buscar en M2Master
    console.log('   - Buscando en M2Master...');
    const allM2 = await M2Master.find({}).limit(50000);
    allM2.forEach(record => {
      const vendors = extractVendorsFromRecord(record);
      vendors.forEach(v => allVendorsSet.add(v));
    });
    console.log(`   - M2Master: ${allVendorsSet.size} vendedores únicos hasta ahora`);
    
    // 3. Buscar en M3Master
    console.log('   - Buscando en M3Master...');
    const allM3 = await M3Master.find({}).limit(50000);
    allM3.forEach(record => {
      const vendors = extractVendorsFromRecord(record);
      vendors.forEach(v => allVendorsSet.add(v));
    });
    console.log(`   - M3Master: ${allVendorsSet.size} vendedores únicos hasta ahora`);
    
    // 4. Buscar en M4Master
    console.log('   - Buscando en M4Master...');
    const allM4 = await M4Master.find({}).limit(50000);
    allM4.forEach(record => {
      const vendors = extractVendorsFromRecord(record);
      vendors.forEach(v => allVendorsSet.add(v));
    });
    console.log(`   - M4Master: ${allVendorsSet.size} vendedores únicos hasta ahora`);
    
    // 5. Buscar en SalesMaster
    console.log('   - Buscando en SalesMaster...');
    const allSales = await SalesMaster.find({}).limit(50000);
    allSales.forEach(record => {
      const vendors = extractVendorsFromRecord(record);
      vendors.forEach(v => allVendorsSet.add(v));
    });
    console.log(`   - SalesMaster: ${allVendorsSet.size} vendedores únicos hasta ahora`);
    
    // 6. Buscar en InstallMaster
    console.log('   - Buscando en InstallMaster...');
    const allInstalls = await InstallMaster.find({}).limit(50000);
    allInstalls.forEach(record => {
      const vendors = extractVendorsFromRecord(record);
      vendors.forEach(v => allVendorsSet.add(v));
    });
    console.log(`   - InstallMaster: ${allVendorsSet.size} vendedores únicos hasta ahora`);
    
    // 7. Buscar en OperacionDia
    console.log('   - Buscando en OperacionDia...');
    const allOperaciones = await OperacionDia.find({}).limit(50000);
    allOperaciones.forEach(record => {
      const vendors = extractVendorsFromRecord(record);
      vendors.forEach(v => allVendorsSet.add(v));
    });
    console.log(`   - OperacionDia: ${allVendorsSet.size} vendedores únicos hasta ahora`);
    
    // Convertir a array y ordenar
    const allVendors = Array.from(allVendorsSet).sort();
    
    console.log(`✅ Total vendedores únicos encontrados: ${allVendors.length}`);
    
    res.json({ vendors: allVendors });
  } catch (error) {
    console.error('Error obteniendo vendedores:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

