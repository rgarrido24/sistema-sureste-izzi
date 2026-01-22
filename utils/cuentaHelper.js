/**
 * Normaliza el número de cuenta para usarlo como clave única
 * Extrae el número de cuenta de diferentes formatos posibles
 */
export function normalizeCuenta(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }
  
  // Intentar diferentes variaciones del campo cuenta (case insensitive)
  let cuenta = '';
  
  // Buscar en todas las claves del objeto (case insensitive y sin espacios)
  const keys = Object.keys(item);
  
  for (const key of keys) {
    // Normalizar la clave: quitar espacios, convertir a minúsculas
    // Incluir NBSP (\u00A0) porque muchos CSV/Excel lo traen invisible
    const keyNormalized = String(key || '').trim().toLowerCase().replace(/[\s\u00A0]+/g, '');
    
    // Buscar variaciones de "cuenta" - incluir "nocuenta", "referencia" y "nº de cuenta" como alternativas
    // Priorizar "nº de cuenta" para operación del día
    const isStrongMatch =
      keyNormalized === 'cuentadefacturacion' ||
      keyNormalized === 'cuentadefacturación' ||
      keyNormalized === 'nºdecuenta' ||
      keyNormalized === 'n°decuenta' ||
      keyNormalized === 'nocuenta' ||
      keyNormalized === 'cuenta';

    const isWeakMatch =
      keyNormalized.includes('cuenta') ||
      keyNormalized.includes('nocuenta') ||
      keyNormalized.includes('facturacion') ||
      keyNormalized.includes('facturación');

    if (isStrongMatch || isWeakMatch) {
      const value = item[key];
      if (value === undefined || value === null || value === '') continue;
      const raw = String(value).trim();
      if (!raw || raw === 'undefined' || raw === 'null') continue;

      // Para matches débiles, SOLO aceptar si trae dígitos suficientes.
      if (!isStrongMatch) {
        const digits = raw.replace(/[^\d]/g, '');
        if (!digits || digits.length < 3) continue;
      }

      cuenta = raw;
      break;
    }
  }
  
  // Si no se encontró, intentar las variaciones exactas (con espacios)
  // IMPORTANTE: Buscar "CUENTA" primero porque es el más común en archivos Excel
  // También buscar "NoCuenta" y "Referencia" como alternativas
  if (!cuenta) {
    // Buscar en orden de prioridad: Cuenta de facturación (operación) > Nº de cuenta (operación) > CUENTA > NoCuenta > Referencia > otras variaciones
    const possibleFields = [
      'Cuenta de facturación',  // Prioridad 1: Columna AT (Operación del día) - PRIMERO para operación
      'Cuenta de Facturación',  // Variación con mayúscula
      'CUENTA DE FACTURACIÓN',  // Todo mayúsculas
      'cuenta de facturación',  // Todo minúsculas
      'Nº de cuenta',           // Prioridad 2: Columna BQ (Operación del día)
      'N° de cuenta',           // Variación con °
      'Nº Cuenta',              // Sin "de"
      'N° Cuenta',              // Sin "de" con °
      'CUENTA',                 // Prioridad 3: Columna A (M1, M2, M3, M4)
      'Cuenta',
      'cuenta',
      'NoCuenta',               // Prioridad 4: Columna AD
      'No Cuenta',
      'No cuenta',
      'nocuenta',
      'Referencia',             // Prioridad 5: Columna AE (si es el mismo dato)
      'referencia',
      'Numero de cuenta',
      'Número de cuenta',
      'numero de cuenta',
      'número de cuenta',
      'CUENTA ',                // Con espacio al final
      ' cuenta',                // Con espacio al inicio
      ' cuenta '                // Con espacios
    ];
    
    for (const field of possibleFields) {
      const value = item[field];
      if (value !== undefined && value !== null && value !== '') {
        cuenta = value;
        break;
      }
    }
  }
  
  // Limpiar y normalizar el valor
  let normalized = String(cuenta || '').trim();
  
  // Quitar espacios internos
  normalized = normalized.replace(/[\s\u00A0]+/g, '');
  
  // Si está vacío después de normalizar, retornar vacío
  if (!normalized || normalized === 'undefined' || normalized === 'null' || normalized === '') {
    return '';
  }

  // Si contiene dígitos, preferir SOLO dígitos (las cuentas son numéricas)
  // Esto arregla casos como "12345.0", "  00123 ", "Nº 12345", etc.
  const digits = normalized.replace(/[^\d]/g, '');
  if (digits && digits.length >= 3) {
    return digits;
  }
  
  return normalized;
}

/**
 * Busca un registro existente por número de cuenta en cualquier colección
 */
export async function findExistingByCuenta(cuenta, models) {
  if (!cuenta) return null;
  
  const normalizedCuenta = normalizeCuenta({ cuenta });
  
  // Buscar en todas las colecciones posibles
  for (const model of models) {
    const existing = await model.findOne({
      $or: [
        { cuenta: normalizedCuenta },
        { 'Nº de cuenta': normalizedCuenta },
        { 'Cuenta': normalizedCuenta },
        { 'N° de cuenta': normalizedCuenta }
      ]
    });
    
    if (existing) {
      return { model, document: existing };
    }
  }
  
  return null;
}

/**
 * Crea un objeto de datos normalizado con el número de cuenta
 */
export function prepareDataForUpsert(item, origen = 'operacion') {
  const cuenta = normalizeCuenta(item);
  
  if (!cuenta) {
    // En lugar de lanzar error, retornar null y que el código que lo llama lo maneje
    return null;
  }
  
  // Limpiar el objeto para evitar campos undefined
  const cleanedItem = {};
  for (const key in item) {
    const k = String(key || '').trim();
    // CRÍTICO: no permitir keys vacías (Mongo falla en $set con "ruta vacía")
    if (!k) continue;
    // Seguridad básica: evitar keys inválidas en Mongo updates
    if (k.startsWith('$')) continue;
    if (item[key] !== undefined && item[key] !== null) cleanedItem[k] = item[key];
  }
  
  return {
    ...cleanedItem,
    cuenta,
    'Nº de cuenta': cuenta,
    'Cuenta': cuenta,
    'N° de cuenta': cuenta,
    origen,
    fechaActualizacion: new Date(),
    fechaCreacion: item.fechaCreacion || new Date()
  };
}

