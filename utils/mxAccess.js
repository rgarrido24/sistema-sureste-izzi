import { extractRegionFromRecord } from './regionAccess.js';

function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

// Normaliza a formato "código país + dígitos" cuando es posible.
// Para México:
// - Si ya viene con 52 + 10 dígitos -> se conserva.
// - Si viene con 10 dígitos -> se asume México y se antepone 52.
export function cleanPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = String(phone).trim();
  if (!cleaned) return null;

  // Permitir '+', luego quedarnos solo con números
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  cleaned = digitsOnly(cleaned);
  if (!cleaned) return null;

  // México: 52 + 10 dígitos
  if (cleaned.startsWith('52') && cleaned.length >= 12) return cleaned;

  // Si tiene 10 dígitos, asumir MX
  if (cleaned.length === 10) return `52${cleaned}`;

  // Otros: dejar como venga (sirve para detectar NO-MX)
  return cleaned;
}

export function isMxPhone(phone) {
  const cleaned = cleanPhoneNumber(phone);
  return !!cleaned && cleaned.startsWith('52');
}

function inferCountryFlagFromRecord(record) {
  if (!record) return null;
  const obj = record?.toObject ? record.toObject() : record;

  const candidates = [
    obj.PAIS,
    obj.Pais,
    obj.pais,
    obj['País'],
    obj['PAÍS'],
    obj.country,
    obj.Country,
    obj.COUNTRY,
  ];

  for (const c of candidates) {
    const v = normalizeText(c);
    if (!v) continue;

    // Señales de MX
    if (v === 'MX' || v === 'MEX' || v.includes('MEXICO')) return true;

    // Señales claras de NO-MX
    if (v === 'US' || v === 'USA' || v.includes('UNITED STATES')) return false;
    if (v === 'CA' || v === 'CAN' || v.includes('CANADA')) return false;
    if (v === 'GT' || v.includes('GUATEMALA')) return false;
    if (v === 'SV' || v.includes('EL SALVADOR')) return false;
    if (v === 'HN' || v.includes('HONDURAS')) return false;
    if (v === 'CR' || v.includes('COSTA RICA')) return false;
    if (v === 'PA' || v.includes('PANAMA')) return false;
    if (v === 'NI' || v.includes('NICARAGUA')) return false;
    if (v === 'DO' || v.includes('REPUBLICA DOMINICANA') || v.includes('DOMINICAN')) return false;

    // Valor desconocido/no concluyente
    return null;
  }

  return null;
}

export function isMxRecord(record) {
  if (!record) return false;
  const obj = record?.toObject ? record.toObject() : record;

  // 1) Si el registro explícitamente trae país
  const countryFlag = inferCountryFlagFromRecord(obj);
  if (countryFlag === true) return true;
  if (countryFlag === false) return false;

  // 2) Teléfonos: si es 52 o 10 dígitos (se asume 52)
  const phoneCandidates = [
    obj.Telefono1, obj['Telefono1'], obj.Telefono2, obj['Telefono2'],
    obj.Telefono, obj['Telefono'], obj.telefono, obj.phone, obj.Phone,
    obj.Celular, obj['Celular'], obj.CELULAR, obj.Movil, obj['Movil'], obj['Móvil'], obj.MOVIL,
  ];
  for (const p of phoneCandidates) {
    if (isMxPhone(p)) return true;
  }

  // 3) Si se puede inferir una región MX conocida (METROPOLITANA, NORESTE, etc.)
  const reg = extractRegionFromRecord(obj);
  if (reg) return true;

  // 4) Default estricto: si no hay evidencia, NO incluir
  return false;
}

export function applyMxFilterInMemory(docs) {
  return (docs || []).filter(isMxRecord);
}

