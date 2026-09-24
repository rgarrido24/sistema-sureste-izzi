const MS_RANK = { MS_2: 2, MS_3: 3, MS_4: 4, MS_5: 5, MS_6: 6, M2: 2, M3: 3, M4: 4, M5: 5, M6: 6 };

export function headersLookLikePermanencia(headers = []) {
  const norms = headers.map((h) => String(h || '').trim().toLowerCase());
  const hasPermanencia = norms.includes('permanencia');
  const hasM = norms.includes('m') || norms.includes('ms');
  return hasPermanencia && hasM;
}

export function fileLooksLikePermanencia(fileName = '', headers = []) {
  const name = String(fileName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (name.includes('permanencia')) return true;
  return headersLookLikePermanencia(headers);
}

export function fileLooksLikeSingleMn(fileName = '') {
  const name = String(fileName || '').toLowerCase();
  return /(?:^|[^a-z0-9])m[2-6](?:[^0-9]|$)/.test(name);
}

export function parseMsLevel(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (MS_RANK[raw]) return MS_RANK[raw];
  const match = raw.match(/MS?_?([2-6])/);
  return match ? Number(match[1]) : null;
}

export function readFlag01(item) {
  const candidates = [
    item.Permanencia, item.permanencia, item.PERMANENCIA,
    item.M2, item.m2, item.M3, item.m3, item.M4, item.m4, item.M5, item.m5, item.M6, item.m6,
  ];
  for (const campo of candidates) {
    if (campo === null || campo === undefined || campo === '') continue;
    if (typeof campo === 'number' && (campo === 0 || campo === 1)) return campo;
    const str = String(campo).trim();
    if (str === '0' || str === '1') return parseInt(str, 10);
  }
  return null;
}

export function stampModuleFlag(row, moduleUpper) {
  const next = { ...row };
  const flag = readFlag01(next);
  if (flag !== null) {
    next[moduleUpper] = flag;
    next[moduleUpper.toLowerCase()] = flag;
  }
  if (String(next.Telefono2 || '').trim() === '0') next.Telefono2 = '';
  return next;
}

function cuentaOf(row) {
  return String(
    row.cuenta || row.Cuenta || row.CUENTA || row.NoCuenta || row.Referencia ||
    row['Num Cliente'] || row['NUM CLIENTE'] || row.NumCliente || ''
  ).trim();
}

/** Se queda con la fila del mes más alto por cuenta (estatus actual). */
export function keepLatestPermanencia(rows) {
  const byCuenta = new Map();
  for (const row of rows) {
    const cuenta = cuentaOf(row);
    if (!cuenta) continue;
    const level = parseMsLevel(row.M || row.m || row.MS);
    const prev = byCuenta.get(cuenta);
    if (!prev || (level || 0) >= (prev.level || 0)) {
      byCuenta.set(cuenta, { level, row });
    }
  }
  return [...byCuenta.values()];
}

export function groupLatestByModule(rows) {
  const groups = { m2: [], m3: [], m4: [], m5: [], m6: [] };
  for (const { level, row } of keepLatestPermanencia(rows)) {
    if (!level || !groups[`m${level}`]) continue;
    const moduleUpper = `M${level}`;
    groups[`m${level}`].push(stampModuleFlag(row, moduleUpper));
  }
  return groups;
}
