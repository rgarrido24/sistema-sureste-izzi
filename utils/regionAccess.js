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
  // Normalizaciones comunes
  if (r.includes('METRO')) return 'METROPOLITANA';
  if (r.includes('SURESTE')) return 'SURESTE';
  if (r.includes('NORESTE')) return 'NORESTE';
  if (r.includes('OCCIDENTE')) return 'OCCIDENTE';
  if (r.includes('PACIF')) return 'PACIFICO';
  return r;
}

export function extractRegionFromRecord(record) {
  if (!record) return '';
  const obj = record.toObject ? record.toObject() : record;
  const candidates = [
    obj.REGION,
    obj.Region,
    obj['Región'],
    obj['REGIÓN'],
    obj['DIVISION REGION'],
    obj['DIVISION REGIÓN'],
    obj.DivisionRegion,
    obj.divisionRegion
  ];
  for (const c of candidates) {
    const r = normalizeRegion(c);
    if (r) return r;
  }

  // Fallback: calcular por Hub/Plaza si existen
  const hub = obj.Hub || obj.HUB || obj['Hub'] || obj['HUB'] || obj.hub || '';
  const plaza = obj.Plaza || obj.PLAZA || obj['Plaza'] || obj['PLAZA'] || obj.plaza || '';
  const computed = getRegionFromHubPlaza(hub, plaza);
  return normalizeRegion(computed);
}

export function applyRegionalFilterInMemory(docs, userRegion) {
  const target = normalizeRegion(userRegion);
  if (!target) return [];
  return (docs || []).filter(d => extractRegionFromRecord(d) === target);
}

