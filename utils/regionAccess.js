import { getRegionFromHubPlaza } from './regionFromHubPlaza.js';

function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function normalizeRegion(region) {
  const r = normalizeText(region);
  if (!r) return '';
  if (r === 'SIN DATO' || r === 'SINDATO' || r === 'N/A' || r === 'NA') return '';
  // Normalizaciones comunes
  if (r.includes('METRO')) return 'METROPOLITANA';
  if (r.includes('METROPOLITANA')) return 'METROPOLITANA';
  // "MX CENTRO / MX NORTE / MX SUR" también es METROPOLITANA
  if (r.includes('MX CENTRO') || r.includes('MX NORTE') || r.includes('MX SUR') || (r.includes('CENTRO') && r.includes('MX'))) {
    return 'METROPOLITANA';
  }
  if (r.includes('SURESTE')) return 'SURESTE';
  if (r.includes('NORESTE')) return 'NORESTE';
  if (r.includes('OCCIDENTE')) return 'OCCIDENTE';
  if (r.includes('PACIF')) return 'PACIFICO';
  return r;
}

function isKnownRegion(region) {
  const r = normalizeRegion(region);
  return r === 'METROPOLITANA' || r === 'NORESTE' || r === 'OCCIDENTE' || r === 'PACIFICO' || r === 'SURESTE';
}

export function extractRegionFromRecord(record) {
  if (!record) return '';
  const obj = record.toObject ? record.toObject() : record;
  const candidates = [
    // Campos típicos en M1/M2/M3/M4
    obj.SUBREGION,
    obj['SUBREGION'],
    obj['Subregion'],
    obj['Sub Region'],
    obj['SUB REGION'],
    obj['SUBREGIÓN'],
    obj['Subregión'],
    obj['SUB REGIÓN'],

    obj['Region Nueva'],
    obj['REGION NUEVA'],
    obj['RegionNueva'],
    obj['REGIONNUEVA'],
    obj['REGIÓN NUEVA'],
    obj['Región Nueva'],

    obj.region,
    obj['region'],

    // Campos típicos en Operación / otros módulos
    obj.REGION,
    obj.Region,
    obj['Región'],
    obj['REGIÓN'],
    obj['DIVISION REGION'],
    obj['DIVISION REGIÓN'],
    obj.DivisionRegion,
    obj.divisionRegion,
  ];
  for (const c of candidates) {
    const r = normalizeRegion(c);
    // Importante: NO aceptar valores como "TIJUANA" / "MERIDA" que son plazas.
    // Solo regresamos cuando el valor ya es una región reconocida.
    if (r && isKnownRegion(r)) return r;
  }

  // Fallback: calcular por Hub/Plaza si existen
  const hub = obj.Hub || obj.HUB || obj['Hub'] || obj['HUB'] || obj.hub || '';
  const plaza = obj.Plaza || obj.PLAZA || obj['Plaza'] || obj['PLAZA'] || obj.plaza || '';
  const computed = getRegionFromHubPlaza(hub, plaza);
  const normComputed = normalizeRegion(computed);
  return isKnownRegion(normComputed) ? normComputed : '';
}

export function applyRegionalFilterInMemory(docs, userRegion) {
  const target = normalizeRegion(userRegion);
  if (!target) return [];
  return (docs || []).filter(d => extractRegionFromRecord(d) === target);
}

