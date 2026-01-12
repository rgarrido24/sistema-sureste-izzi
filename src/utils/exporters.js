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

