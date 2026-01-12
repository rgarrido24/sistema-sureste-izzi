// Utilidad para optimizar datos antes de guardar en MongoDB
// Reduce el tamaño de los documentos eliminando campos innecesarios

/**
 * Campos esenciales por módulo
 */
const ESSENTIAL_FIELDS = {
  operacion: [
    // Obligatorios
    'cuenta', 'estado', 'fechaCreacion', 'fechaActualizacion', 'origen',
    // Importantes (se muestran en tarjetas)
    'Compañia', 'No. VTS', 'Nº de orden', 'Cuenta de facturación', 'Nº de cuenta',
    'Fecha solicitada', 'Teléfonos', 'Clave Vendedor', 'CVVEN', 'Estado',
    'Hub', 'Plaza', 'VendedorAsignado', 'Vendedor', 'Nota', 'Notas',
    // Para estadísticas
    'Centro', 'Organización', 'Ciudad', 'Municipio', 'Localidad'
  ],
  m1: [
    'cuenta', 'estado', 'origen', 'fechaCreacion', 'fechaActualizacion',
    'Cliente', 'Nombre', 'Nº de cuenta', 'Cuenta', 'Teléfono', 'Teléfonos',
    'NotaContacto', 'Nota', 'FechaPromesaPago', 'Estatus FPD', 'EstatusFPD',
    'VendedorAsignado', 'Vendedor', 'Saldo'
  ],
  m2: [
    'cuenta', 'estado', 'origen', 'fechaCreacion', 'fechaActualizacion',
    'Cliente', 'Nombre', 'Nº de cuenta', 'Cuenta', 'Teléfono', 'Teléfonos',
    'NotaContacto', 'Nota', 'FechaPromesaPago', 'VendedorAsignado', 'Vendedor', 'Saldo'
  ],
  m3: [
    'cuenta', 'estado', 'origen', 'fechaCreacion', 'fechaActualizacion',
    'Cliente', 'Nombre', 'Nº de cuenta', 'Cuenta', 'Teléfono', 'Teléfonos',
    'NotaContacto', 'Nota', 'FechaPromesaPago', 'VendedorAsignado', 'Vendedor', 'Saldo'
  ],
  m4: [
    'cuenta', 'estado', 'origen', 'fechaCreacion', 'fechaActualizacion',
    'Cliente', 'Nombre', 'Nº de cuenta', 'Cuenta', 'Teléfono', 'Teléfonos',
    'NotaContacto', 'Nota', 'FechaPromesaPago', 'VendedorAsignado', 'Vendedor', 'Saldo'
  ]
};

/**
 * Normaliza nombres de campos duplicados
 */
const FIELD_NORMALIZATION = {
  // Cuenta
  'N° de cuenta': 'Nº de cuenta',
  'Cuenta de facturación': 'Nº de cuenta',
  'CUENTA': 'Cuenta',
  
  // Vendedor
  'CVVEN': 'Clave Vendedor',
  'Vendedor Asignado': 'VendedorAsignado',
  
  // Notas
  'Notas': 'Nota',
  
  // Teléfono
  'Teléfono': 'Teléfonos',
  
  // Estado
  'Estado': 'estado',
  
  // Cliente
  'Nombre': 'Cliente',
  'Nombre Cliente': 'Cliente',
  'Razón Social': 'Cliente'
};

/**
 * Optimiza un documento eliminando campos vacíos y normalizando
 * @param {Object} doc - Documento a optimizar
 * @param {String} module - Módulo al que pertenece (operacion, m1, m2, m3, m4)
 * @returns {Object} - Documento optimizado
 */
export function optimizeDocument(doc, module = 'operacion') {
  if (!doc || typeof doc !== 'object') return doc;
  
  const optimized = {};
  const essentialFields = ESSENTIAL_FIELDS[module] || ESSENTIAL_FIELDS.operacion;
  
  // Siempre incluir campos del sistema (timestamps, etc.)
  const systemFields = ['_id', 'cuenta', 'estado', 'origen', 'fechaCreacion', 'fechaActualizacion', 
                       'createdAt', 'updatedAt', '__v'];
  
  // Procesar cada campo
  for (const [key, value] of Object.entries(doc)) {
    // Saltar campos del sistema (se agregan después)
    if (systemFields.includes(key)) continue;
    
    // Normalizar nombre del campo
    const normalizedKey = FIELD_NORMALIZATION[key] || key;
    
    // Verificar si el campo está vacío
    if (isEmpty(value)) continue;
    
    // Verificar si el campo es esencial
    if (!essentialFields.includes(key) && !essentialFields.includes(normalizedKey)) {
      // Si no es esencial, verificar si tiene un valor significativo
      if (!isSignificantValue(value)) continue;
    }
    
    // Comprimir texto si es string
    let finalValue = value;
    if (typeof value === 'string') {
      finalValue = compressText(value);
      if (!finalValue || finalValue.trim() === '') continue;
    }
    
    // Usar clave normalizada si existe
    const finalKey = FIELD_NORMALIZATION[key] || key;
    
    // Si ya existe la clave normalizada, no duplicar
    if (optimized[finalKey] && optimized[finalKey] !== finalValue) {
      // Mantener el valor más largo/completo
      if (String(finalValue).length > String(optimized[finalKey]).length) {
        optimized[finalKey] = finalValue;
      }
    } else {
      optimized[finalKey] = finalValue;
    }
  }
  
  // Agregar campos del sistema
  systemFields.forEach(field => {
    if (doc[field] !== undefined) {
      optimized[field] = doc[field];
    }
  });
  
  return optimized;
}

/**
 * Verifica si un valor está vacío
 */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Verifica si un valor es significativo (no es solo espacios, guiones, etc.)
 */
function isSignificantValue(value) {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === 'N/A' || trimmed === 'N/A' || trimmed.toLowerCase() === 'sin dato') {
    return false;
  }
  return true;
}

/**
 * Comprime texto eliminando espacios extra y normalizando
 */
function compressText(text) {
  if (typeof text !== 'string') return text;
  
  // Eliminar espacios múltiples
  let compressed = text.replace(/\s+/g, ' ');
  
  // Eliminar espacios al inicio y final
  compressed = compressed.trim();
  
  // Normalizar caracteres especiales comunes
  compressed = compressed.replace(/[""]/g, '"'); // Comillas tipográficas
  compressed = compressed.replace(/['']/g, "'"); // Apostrofes tipográficos
  
  return compressed;
}

/**
 * Optimiza un array de documentos
 */
export function optimizeDocuments(docs, module = 'operacion') {
  if (!Array.isArray(docs)) return docs;
  return docs.map(doc => optimizeDocument(doc, module));
}

/**
 * Calcula el tamaño aproximado de un documento en bytes
 */
export function estimateDocumentSize(doc) {
  return JSON.stringify(doc).length;
}

/**
 * Calcula el ahorro de espacio después de optimizar
 */
export function calculateSpaceSavings(originalDocs, optimizedDocs) {
  const originalSize = originalDocs.reduce((sum, doc) => sum + estimateDocumentSize(doc), 0);
  const optimizedSize = optimizedDocs.reduce((sum, doc) => sum + estimateDocumentSize(doc), 0);
  const savings = originalSize - optimizedSize;
  const savingsPercent = originalSize > 0 ? (savings / originalSize) * 100 : 0;
  
  return {
    originalSize,
    optimizedSize,
    savings,
    savingsPercent: savingsPercent.toFixed(2)
  };
}
