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
 * Parsea una fecha en distintos formatos de texto (los que trae Excel/SheetJS
 * al exportar con raw:false) a un objeto Date. Soporta:
 * - mm-dd-yy / mm-dd-yyyy
 * - mm/dd/yyyy / mm/dd/yy
 * - yyyy-mm-dd
 * - Date object o número serial de Excel (fallback vía excelDateToString)
 * Retorna null si no se pudo interpretar.
 */
export function parseFlexibleDate(value) {
  if (!value && value !== 0) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  const str = String(value).trim();
  if (!str) return null;

  // yyyy-mm-dd
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
  }

  // mm-dd-yy(yy) o mm/dd/yy(yy)
  m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, mo, d, yRaw] = m;
    let y = parseInt(yRaw, 10);
    if (yRaw.length === 2) y += y < 50 ? 2000 : 1900;
    return new Date(y, parseInt(mo, 10) - 1, parseInt(d, 10));
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calcula el Estatus FPD para registros M1 que no traen la columna
 * "Estatus FPD" directamente (formato nuevo del archivo M1), usando
 * la fecha límite "Fecha Perdida FPD": si ya pasó, se considera
 * "FPD PÉRDIDA"; si todavía no llega (o es hoy), "FPD CORRIENTE".
 */
export function calcularEstatusFPDDesdeFecha(fechaPerdidaFPD) {
  const fecha = parseFlexibleDate(fechaPerdidaFPD);
  if (!fecha) return '';

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);

  return fecha.getTime() < hoy.getTime() ? 'FPD PÉRDIDA' : 'FPD CORRIENTE';
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

