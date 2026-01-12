import { useEffect } from 'react';
import { useReports } from '../../hooks/useReports.js';

export default function ReportsModule() {
  // Solo carga cuando esta pestaña está activa
  const { reports, loading, loadReports } = useReports(true);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  if (loading) {
    return <div className="text-center p-8">Cargando reportes...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold mb-4">Reportes de Ventas</h2>
      <p className="text-slate-600 mb-4">
        Total de reportes: {reports.length}
      </p>
      
      {reports.length === 0 ? (
        <p className="text-slate-500 text-center py-8">
          No hay reportes aún
        </p>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div key={report.id} className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-bold">{report.title || 'Sin título'}</h3>
              <p className="text-sm text-slate-600">{report.description || ''}</p>
              <p className="text-xs text-slate-400 mt-2">
                Creado: {report.createdAt || 'Reciente'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

