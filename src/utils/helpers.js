// Funciones auxiliares reutilizables

/**
 * Limpia y normaliza un valor de string
 */
export function cleanValue(value) {
  if (!value) return '';
  let str = String(value).trim();
  str = str.replace(/^["']+|["']+$/g, ''); // Quita comillas
  str = str.replace(/\s+/g, ' ').trim(); // Normaliza espacios
  return str;
}

/**
 * Hash simple de contraseña (compatible con backend)
 */
export function hashPassword(password) {
  return btoa(password).split('').reverse().join('');
}

/**
 * Verificar contraseña
 */
export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

/**
 * Calcula FLP (Fecha Límite de Pago) basado en fecha de instalación
 */
export function calcularFLP(fechaInstalacion) {
  if (!fechaInstalacion) return '';
  
  let diaInstalacion = 0;
  
  if (typeof fechaInstalacion === 'string') {
    const partes = fechaInstalacion.split(/[\/\-]/);
    if (partes.length >= 1) {
      diaInstalacion = parseInt(partes[0], 10);
    }
  } else if (fechaInstalacion instanceof Date) {
    diaInstalacion = fechaInstalacion.getDate();
  }
  
  if (diaInstalacion < 1 || diaInstalacion > 31) return '';
  
  // Calcular FLP según ciclos de Izzi
  let flpDia = diaInstalacion;
  
  // Si el día es 29, 30 o 31, el FLP es el día 4 del siguiente mes
  if (diaInstalacion >= 29) {
    flpDia = 4;
  }
  
  return flpDia.toString().padStart(2, '0');
}

/**
 * Convierte fecha de Excel a string legible
 */
export function excelDateToString(excelDate) {
  if (!excelDate) return '';
  
  // Si ya es string, retornarlo
  if (typeof excelDate === 'string') return excelDate;
  
  // Si es número (fecha de Excel)
  if (typeof excelDate === 'number') {
    // Excel cuenta desde 1900-01-01
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }
  
  // Si es Date object
  if (excelDate instanceof Date) {
    const day = excelDate.getDate().toString().padStart(2, '0');
    const month = (excelDate.getMonth() + 1).toString().padStart(2, '0');
    const year = excelDate.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return String(excelDate);
}

/**
 * Calcula el saldo total de un cliente
 */
export function calcularSaldoTotal(cliente) {
  const porVencer = parseFloat(cliente.SaldoPorVencer || cliente['Saldo Por Vencer'] || 0);
  const vencido = parseFloat(cliente.SaldoVencido || cliente['Saldo Vencido'] || 0);
  const monto = parseFloat(cliente.Saldo || cliente.Monto || 0);
  return porVencer + vencido + monto;
}

/**
 * Obtiene variables de entorno de forma segura
 */
export function getEnv() {
  try {
    return import.meta.env || {};
  } catch (e) {
    return {};
  }
}

