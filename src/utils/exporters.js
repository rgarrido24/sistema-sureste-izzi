import * as XLSX from 'xlsx';

/**
 * Descarga datos como CSV
 */
export function downloadCSV(data, filename) {
  if (!data || data.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header] || '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta instalaciones a Excel
 */
export function exportInstalacionesToExcel(instalaciones) {
  if (!instalaciones || instalaciones.length === 0) {
    alert('No hay instalaciones para exportar');
    return;
  }

  const excelData = instalaciones.map(i => ({
    'Cliente': i.Cliente || '',
    'Cuenta': i.Cuenta || '',
    'Teléfono': i.Telefono || '',
    'Plaza': i.Plaza || '',
    'Ciudad': i.Ciudad || '',
    'Región': i.Region || '',
    'Estatus': i.Estatus || '',
    'Fecha Instalación': i.FechaInstalacion || '',
    'Paquete': i.Paquete || ''
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Instalaciones');

  const fecha = new Date().toISOString().split('T')[0];
  const filename = `instalaciones_${fecha}.xlsx`;
  XLSX.writeFile(wb, filename);

  alert(`✅ Instalaciones descargadas: ${filename}`);
}

/**
 * Exporta reportes a Excel
 */
export function exportReportsToExcel(reports) {
  if (!reports || reports.length === 0) {
    alert('No hay reportes para exportar');
    return;
  }

  // Eliminar duplicados por N° ORDEN
  const uniqueReports = reports.filter((r, index, self) => {
    const nOrden = r.nOrden || r.orden || r['N° ORDEN'] || '';
    if (!nOrden) return true;
    return index === self.findIndex(rep => (rep.nOrden || rep.orden || rep['N° ORDEN']) === nOrden);
  });

  const excelData = uniqueReports.map(r => ({
    'Fecha': r.fecha || r.createdAt || '',
    'Referencia': r.referencia || '',
    'Cuenta': r.cuenta || '',
    'N° ORDEN': r.nOrden || r.orden || '',
    'Nombre Completo': r.nombreCompleto || r.client || '',
    'Teléfono': r.telefono || '',
    'Mensual': r.mensual || '',
    'RGU': r.rgu || '',
    'Servicios Contratados': r.serviciosContratados || '',
    'Móvil': r.movil || '',
    'Tipo Venta': r.tipoVenta || '',
    'Estatus': r.estatus || '',
    'Fecha Instalación': r.fechaInstalacion || '',
    'Plaza': r.plaza || '',
    'Vendedor': r.vendedor || r.vendor || '',
    'Puesto': r.puesto || '',
    'CVVEN': r.cvven || '',
    'Comentarios': r.comentarios || '',
    'Hub': r.hub || '',
    'RPT': r.rpt || '',
    'Tipo': r.tipo || '',
    'Tipo Cuenta': r.tipoCuenta || '',
    'Orden Móvil': r.ordenMovil || ''
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reportes de Ventas');

  const fecha = new Date().toISOString().split('T')[0];
  const filename = `reportes_ventas_${fecha}.xlsx`;
  XLSX.writeFile(wb, filename);

  alert(`✅ Reporte descargado: ${filename}`);
}

// ====== EXPORT OPERACIÓN DEL DÍA (FORMATO MESA DE CONTROL) ======

function formatDateForExcel(value) {
  if (!value) return '';
  try {
    if (value instanceof Date) return value.toISOString().split('T')[0];
    const str = String(value).trim();
    if (!str) return '';
    if (str.includes('T')) return str.split('T')[0];
    if (str.includes(' ')) return str.split(' ')[0];
    return str;
  } catch {
    return String(value || '');
  }
}

function pickFirst(item, keys) {
  for (const k of keys) {
    const v = item?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function pickByRegexKey(item, regex) {
  if (!item || typeof item !== 'object') return '';
  const key = Object.keys(item).find(k => regex.test(k));
  return key ? (item[key] ?? '') : '';
}

function splitPhones(raw) {
  if (!raw) return ['', ''];
  const str = String(raw).trim();
  if (!str) return ['', ''];
  const parts = str
    .split(/[,/;|]/g)
    .map(s => s.trim())
    .filter(Boolean);
  const p1 = parts[0] || str;
  const p2 = parts[1] || '';
  return [p1, p2];
}

const OPERACION_DIA_HEADERS = [
  'FECHA',
  'REFERENCIA',
  'CUENTA',
  'N° ORDEN',
  'NOMBRE COMPLETO- DE CLIENTE',
  'TELEFONO  N° 1',
  'TELEFONO  N° 2',
  'MENSUALIDAD',
  'RGU',
  'SERVICIOS CONTRATADOS',
  'TIPO DE VENTA',
  'ESTATUS',
  'FECH INST.',
  'DIVISION',
  'REGION',
  'PLAZA',
  'VENDEDOR',
  'PUESTO',
  'LIDER',
  'CVVEN',
  'COMENTARIOS',
  'HUB',
  'RPT',
  'TIPO DE CUENTA',
  'CODIGO VERIFICACION',
];

function mapOperacionDiaRow(item) {
  const fecha = pickFirst(item, ['FECHA', 'Fecha', 'fecha', 'Fecha solicitada', 'Fecha Solicitada', 'createdAt']);
  const referencia = pickFirst(item, ['REFERENCIA', 'Referencia', 'referencia']);

  const cuenta = pickFirst(item, [
    'CUENTA',
    'Cuenta',
    'cuenta',
    'Cuenta de facturación',
    'Cuenta de Facturación',
    'Cuenta de facturacion',
    'Cuenta de Facturacion',
    'Nº de cuenta',
    'N° de cuenta',
  ]);

  const nOrden = pickFirst(item, ['N° ORDEN', 'Nº de orden', 'N° de orden', 'No. VTS', 'Orden', 'orden']);

  const nombre = pickFirst(item, [
    'NOMBRE COMPLETO- DE CLIENTE',
    'Nombre Completo- de Cliente',
    'Nombre completo- de cliente',
    'NOMBRE COMPLETO DE CLIENTE',
    'Compañia',
    'Compañía',
    'Cliente',
    'client',
  ]);

  const tel1Raw = pickFirst(item, ['TELEFONO  N° 1', 'TELEFONO N° 1', 'TELEFONO 1', 'Teléfono N° 1', 'Teléfono No. 1', 'Telefono1', 'Telefono 1']);
  const tel2Raw = pickFirst(item, ['TELEFONO  N° 2', 'TELEFONO N° 2', 'TELEFONO 2', 'Teléfono N° 2', 'Teléfono No. 2', 'Telefono2', 'Telefono 2']);
  const telefonosRaw = pickFirst(item, ['Teléfonos', 'Telefonos', 'TELÉFONOS', 'TELEFONOS']);
  const [p1, p2] = telefonosRaw ? splitPhones(telefonosRaw) : ['', ''];
  const tel1 = tel1Raw || p1;
  const tel2 = tel2Raw || p2;

  const mensualidad = pickFirst(item, ['MENSUALIDAD', 'Mensualidad', 'MENSUAL', 'Mensual']);
  const rgu = pickFirst(item, ['RGU', 'rgu']);
  const servicios = pickFirst(item, ['SERVICIOS CONTRATADOS', 'Servicios Contratados', 'SERVICIO', 'SERVICIOS', 'Servicios']);
  const tipoVenta = pickFirst(item, ['TIPO DE VENTA', 'Tipo de venta', 'Tipo Venta', 'TIPO VENTA']);

  const estatus = pickFirst(item, ['ESTATUS', 'Estatus', 'Estado', 'estado']);

  const fechInst = pickFirst(item, [
    'FECH INST.',
    'FECH INST',
    'Fecha Inst.',
    'Fecha Instalación',
    'Fecha Instalacion',
    'FechaInstalacion',
    'Fecha de instalación',
    'Fecha de instalacion',
  ]);

  const division = pickFirst(item, ['DIVISION', 'Division', 'División']);
  const region = pickFirst(item, ['REGION', 'Region', 'Región']);
  const plaza = pickFirst(item, ['PLAZA', 'Plaza', 'plaza']);

  const vendedor = pickFirst(item, ['VENDEDOR', 'VendedorAsignado', 'Vendedor Asignado', 'Vendedor', 'Clave Vendedor', 'CVVEN']);
  const puesto = pickFirst(item, ['PUESTO', 'Puesto']);
  const lider = pickFirst(item, ['LIDER', 'Líder', 'Lider']);
  const cvven = pickFirst(item, ['CVVEN', 'Clave Vendedor']);

  const comentarios = pickFirst(item, ['COMENTARIOS', 'Comentarios', 'Comentario', 'Nota', 'Notas']);
  const hub = pickFirst(item, ['HUB', 'Hub', 'hub']);
  const rpt = pickFirst(item, ['RPT', 'rpt']);
  const tipoCuenta = pickFirst(item, ['TIPO DE CUENTA', 'Tipo de Cuenta', 'Tipo Cuenta', 'tipoCuenta', 'TipoCuenta']);

  const codigoVerif =
    pickFirst(item, ['CODIGO VERIFICACION', 'Código Verificación', 'Codigo Verificacion', 'CODIGO DE VERIFICACION']) ||
    pickByRegexKey(item, /verific/i);

  return [
    formatDateForExcel(fecha),
    referencia ? String(referencia) : '',
    cuenta ? String(cuenta) : '',
    nOrden ? String(nOrden) : '',
    nombre ? String(nombre) : '',
    tel1 ? String(tel1) : '',
    tel2 ? String(tel2) : '',
    mensualidad ? String(mensualidad) : '',
    rgu ? String(rgu) : '',
    servicios ? String(servicios) : '',
    tipoVenta ? String(tipoVenta) : '',
    estatus ? String(estatus) : '',
    formatDateForExcel(fechInst),
    division ? String(division) : '',
    region ? String(region) : '',
    plaza ? String(plaza) : '',
    vendedor ? String(vendedor) : '',
    puesto ? String(puesto) : '',
    lider ? String(lider) : '',
    cvven ? String(cvven) : '',
    comentarios ? String(comentarios) : '',
    hub ? String(hub) : '',
    rpt ? String(rpt) : '',
    tipoCuenta ? String(tipoCuenta) : '',
    codigoVerif ? String(codigoVerif) : '',
  ];
}

/**
 * Exporta Operación del Día a Excel con el formato solicitado (columnas fijas).
 */
export function exportOperacionDiaToExcel(operaciones, { filenameBase = 'operacion_dia' } = {}) {
  if (!operaciones || operaciones.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  const aoa = [OPERACION_DIA_HEADERS, ...operaciones.map(mapOperacionDiaRow)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Operación del Día');

  const fecha = new Date().toISOString().split('T')[0];
  const filename = `${filenameBase}_${fecha}.xlsx`;
  XLSX.writeFile(wb, filename);
  alert(`✅ Excel descargado: ${filename}`);
}
