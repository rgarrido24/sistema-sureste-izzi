import { extractRegionFromRecord, normalizeRegion } from './regionAccess.js';

// Hub sin el prefijo "HUB " y en mayúsculas ("HUB CUERNAVACA" -> "CUERNAVACA")
export function extractHubFromRecord(doc) {
  const raw = doc?.HUB || doc?.Hub || doc?.hub || doc?.['HUB '] || '';
  return String(raw || '').trim().toUpperCase().replace(/^HUB\s+/, '');
}

export function extractPlazaFromRecord(doc) {
  const raw = doc?.PLAZA || doc?.Plaza || doc?.plaza || doc?.['PLAZA '] || '';
  return String(raw || '').trim().toUpperCase();
}

/**
 * Determina el alcance de acceso de un usuario:
 * - regionales / cobranza_mx: una sola región (como ya funcionaba).
 * - supervisor: una o varias plazas específicas, o una región completa si no tiene plazas y sí región.
 * - cualquier otro rol: sin restricción (ve todo).
 */
export function getAccessScope(user) {
  const role = user?.role;

  if (role === 'regionales') {
    return { type: 'region', value: normalizeRegion(user?.region || '') };
  }
  if (role === 'cobranza_mx') {
    return { type: 'region', value: normalizeRegion('METROPOLITANA') };
  }
  if (role === 'supervisor') {
    const plazas = Array.isArray(user?.plazas)
      ? user.plazas.map(p => String(p || '').trim().toUpperCase()).filter(Boolean)
      : [];
    // Supervisor de toda una región (ej. los supervisores de MX): sin plazas sueltas y con región asignada
    // Hubs completos (ej. el supervisor de Morelos): ve todo lo que caiga en esos hubs, además de sus plazas sueltas
    const hubs = Array.isArray(user?.hubs)
      ? user.hubs.map(h => String(h || '').trim().toUpperCase().replace(/^HUB\s+/, '')).filter(Boolean)
      : [];
    const region = normalizeRegion(user?.region || '');
    if (plazas.length === 0 && hubs.length === 0 && region) return { type: 'region', value: region };
    return { type: 'plaza', value: plazas, hubs };
  }
  return { type: 'none', value: null };
}

export function isScopedRole(role) {
  return role === 'regionales' || role === 'cobranza_mx' || role === 'supervisor';
}

/**
 * Filtra una lista de documentos (M0-M4) según el alcance de acceso del usuario.
 * Usa OperacionDia como respaldo para encontrar la región/plaza de cuentas que no
 * la traigan directamente en su propio registro.
 */
export async function filterByAccessScope(docs, user, OperacionDiaModel) {
  const scope = getAccessScope(user);
  if (scope.type === 'none') return docs;

  if (scope.type === 'plaza') {
    const hubsScope = scope.hubs || [];
    if (!scope.value.length && !hubsScope.length) return [];

    const plazaByCuenta = new Map();
    const hubByCuenta = new Map();
    const missingCuentas = [];
    for (const doc of docs) {
      const cuenta = doc?.cuenta;
      const plaza = extractPlazaFromRecord(doc);
      if (cuenta && plaza) plazaByCuenta.set(cuenta, plaza);
      else if (cuenta) missingCuentas.push(cuenta);
    }

    if (missingCuentas.length > 0 && OperacionDiaModel) {
      const uniqueMissing = Array.from(new Set(missingCuentas)).slice(0, 50000);
      const opDocs = await OperacionDiaModel.find(
        { cuenta: { $in: uniqueMissing } },
        { cuenta: 1, Hub: 1, HUB: 1, Plaza: 1, PLAZA: 1 }
      ).lean();
      for (const od of opDocs) {
        const cuenta = od?.cuenta;
        if (!cuenta || plazaByCuenta.has(cuenta)) continue;
        const plaza = extractPlazaFromRecord(od);
        if (plaza) plazaByCuenta.set(cuenta, plaza);
        const hub = extractHubFromRecord(od);
        if (hub) hubByCuenta.set(cuenta, hub);
      }
    }

    return docs.filter(doc => {
      const cuenta = doc?.cuenta;
      const plaza = (cuenta && plazaByCuenta.get(cuenta)) || extractPlazaFromRecord(doc);
      if (scope.value.includes(plaza)) return true;
      if (!hubsScope.length) return false;
      const hub = (cuenta && hubByCuenta.get(cuenta)) || extractHubFromRecord(doc);
      return hubsScope.includes(hub);
    });
  }

  if (scope.type === 'region') {
    if (!scope.value) return [];

    const regionByCuenta = new Map();
    const missingCuentas = [];
    for (const doc of docs) {
      const cuenta = doc?.cuenta;
      const reg = extractRegionFromRecord(doc);
      if (cuenta && reg) regionByCuenta.set(cuenta, reg);
      else if (cuenta) missingCuentas.push(cuenta);
    }

    if (missingCuentas.length > 0 && OperacionDiaModel) {
      const uniqueMissing = Array.from(new Set(missingCuentas)).slice(0, 50000);
      const opDocs = await OperacionDiaModel.find(
        { cuenta: { $in: uniqueMissing } },
        { cuenta: 1, Hub: 1, HUB: 1, Plaza: 1, PLAZA: 1, REGION: 1, Region: 1, 'Región': 1, 'REGIÓN': 1, SUBREGION: 1, 'SUBREGION': 1 }
      ).lean();
      for (const od of opDocs) {
        const cuenta = od?.cuenta;
        if (!cuenta || regionByCuenta.has(cuenta)) continue;
        const reg = extractRegionFromRecord(od);
        if (reg) regionByCuenta.set(cuenta, reg);
      }
    }

    return docs.filter(doc => {
      const cuenta = doc?.cuenta;
      const reg = (cuenta && regionByCuenta.get(cuenta)) || extractRegionFromRecord(doc);
      return normalizeRegion(reg) === scope.value;
    });
  }

  return docs;
}
