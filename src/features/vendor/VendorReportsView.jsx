import { useState, useEffect } from 'react';
import * as api from '../../api.js';

export default function VendorReportsView({ myName }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const data = await api.getSalesReports();
        // Filtrar por vendedor
        const myReports = data.filter(r => {
          const vendor = (r.vendor || '').toLowerCase();
          return vendor === myName.toLowerCase();
        });
        setReports(myReports.map(r => ({ id: r._id || r.id, ...r })));
      } catch (error) {
        console.error('Error cargando reportes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
    const interval = setInterval(loadReports, 10000);
    return () => clearInterval(interval);
  }, [myName]);

  if (loading) {
    return <div className="text-center p-8">Cargando tus reportes...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold mb-4">Mis Reportes ({reports.length})</h2>
      {reports.length === 0 ? (
        <p className="text-slate-500 text-center py-8">
          No tienes reportes aún
        </p>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div key={report.id} className="p-4 border rounded-lg">
              <h3 className="font-bold">{report.title || 'Sin título'}</h3>
              <p className="text-sm text-slate-600">{report.description || ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

