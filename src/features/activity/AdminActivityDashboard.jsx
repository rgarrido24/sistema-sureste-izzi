import { useEffect, useState } from 'react';
import * as api from '../../api.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('es-MX');
  } catch {
    return String(value);
  }
};

export default function AdminActivityDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [cobranzaLastUploads, setCobranzaLastUploads] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getAdminActivitySummary();
        setUsers(result?.users || []);
        setCobranzaLastUploads(result?.cobranzaLastUploads || []);
      } catch (e) {
        setError(e?.message || 'Error cargando dashboard de actividad');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner message="Cargando actividad..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Actividad de usuarios</h2>
        <p className="text-sm text-slate-600 mt-1">
          Último login, última actualización de Cobranza y uso de WhatsApp (Cobranza)
        </p>
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Última actualización de archivos (Cobranza)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {['m1', 'm2', 'm3', 'm4', 'sales'].map((k) => {
            const row = cobranzaLastUploads.find(r => String(r?._id || '').toLowerCase() === k);
            return (
              <div key={k} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                <div className="text-xs font-bold text-slate-600 uppercase">{k === 'sales' ? 'BD' : k}</div>
                <div className="text-sm font-semibold text-slate-800 mt-1">{formatDateTime(row?.lastAt)}</div>
                <div className="text-xs text-slate-500 mt-1">{row?.byUsername ? `por ${row.byUsername}` : '-'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Región</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Último login</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Última carga Cobranza</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">WhatsApp Cobranza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                    Sin datos para mostrar
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-semibold text-slate-800">{u.name || '-'}</div>
                      <div className="text-xs text-slate-500">{u.username}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{u.role}</td>
                    <td className="px-4 py-3 text-sm">{u.region || '-'}</td>
                    <td className="px-4 py-3 text-sm">{formatDateTime(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div>{formatDateTime(u.lastCobranzaUploadAt)}</div>
                      <div className="text-xs text-slate-500">{u.lastCobranzaUploadModule ? `módulo: ${u.lastCobranzaUploadModule}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{formatDateTime(u.lastWhatsAppAt)}</div>
                      <div className="text-xs text-slate-500">{(u.whatsappCount || 0)} envíos</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

