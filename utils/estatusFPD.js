/**
 * Parsea una fecha en distintos formatos de texto (los que trae Excel al
 * exportar) a un objeto Date. Soporta mm-dd-yy(yy), mm/dd/yy(yy), yyyy-mm-dd,
 * Date object o número serial de Excel. Retorna null si no se pudo interpretar.
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

  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
  }

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
 * "Estatus FPD" directamente (formato nuevo del archivo M1), usando la
 * fecha límite "Fecha Perdida FPD": si ya pasó -> "FPD PÉRDIDA",
 * si todavía no llega (o es hoy) -> "FPD CORRIENTE".
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
 * Obtiene el Estatus FPD (en mayúsculas) de un registro M1, usando la
 * columna directa si existe, o calculándolo desde "Fecha Perdida FPD"
 * cuando el archivo (formato nuevo) no la trae.
 */
export function getEstatusFPDM1(item) {
  let raw = item?.['Estatus FPD'] || item?.['EstatusFPD'] || '';
  if (!raw) {
    const fechaPerdida = item?.['Fecha Perdida FPD'] || item?.['FechaPerdidaFPD'] || '';
    if (fechaPerdida) raw = calcularEstatusFPDDesdeFecha(fechaPerdida);
  }
  return String(raw).toUpperCase().trim();
}
