/**
 * Lee el flag 0/1 de un registro de permanencia.
 * Prioridad: columna del módulo (M2/M5...) → Permanencia → M2 (archivos viejos).
 */
export function readPermanenciaFlag(item, moduleUpper) {
  const candidates = [
    item[moduleUpper],
    item[moduleUpper.toLowerCase()],
    item[`${moduleUpper} `],
    item[`${moduleUpper.toLowerCase()} `],
    item.Permanencia,
    item.permanencia,
    item.PERMANENCIA,
    item.M2,
    item.m2,
  ];

  for (const campo of candidates) {
    if (campo === null || campo === undefined || campo === '') continue;
    if (typeof campo === 'number' && (campo === 0 || campo === 1)) return campo;
    const str = String(campo).trim();
    if (str === '0' || str === '1') return parseInt(str, 10);
  }
  return null;
}

export function applyPermanenciaEstatus(preparedData, item, moduleUpper) {
  const num = readPermanenciaFlag(item, moduleUpper);
  if (num === 0) {
    preparedData['Estatus FPD'] = 'FPD CORRIENTE';
    preparedData['EstatusFPD'] = 'FPD CORRIENTE';
    preparedData[moduleUpper] = 0;
    preparedData.estado = 'Completa';
  } else if (num === 1) {
    preparedData['Estatus FPD'] = moduleUpper;
    preparedData['EstatusFPD'] = moduleUpper;
    preparedData[moduleUpper] = 1;
    preparedData.estado = 'Abierta';
  } else {
    preparedData['Estatus FPD'] = moduleUpper;
    preparedData['EstatusFPD'] = moduleUpper;
    preparedData.estado = 'Abierta';
  }
  return preparedData;
}
