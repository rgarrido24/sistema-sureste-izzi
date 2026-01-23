import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import * as api from '../../api.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import { filterByVendor } from '../../utils/vendorFilter.js';

export default function SalesListView({ 
  searchTerm, 
  setSearchTerm, 
  filterVendor, 
  setFilterVendor,
  filterPlaza,
  setFilterPlaza
}) {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbCount, setDbCount] = useState(0);
  const [cobranzaLastUploads, setCobranzaLastUploads] = useState(null);

  useEffect(() => {
    const loadLastUpdate = async () => {
      try {
        const result = await api.getCobranzaLastUpdate();
        setCobranzaLastUploads(result?.cobranzaLastUploads || []);
      } catch (e) {
        // ignore
      }
    };
    loadLastUpdate();
  }, []);

  // Cargar datos solo cuando esta vista se monta (pestaña "Ver BD")
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        let salesData = await api.getSalesMaster();
        // Aplicar filtro SOLO para vendedor/user. Regionales ya vienen filtrados server-side por región.
        if (user?.role === 'vendedor' || user?.role === 'user') {
          salesData = filterByVendor(salesData, user);
        }
        setData(salesData.map(d => ({ id: d._id || d.id, ...d })));
        setDbCount(salesData.length);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner message="Cargando clientes..." />
      </div>
    );
  }

  const vendors = [...new Set(data.map(item => item.Vendedor).filter(Boolean))].sort();
  const plazas = [...new Set(
    data
      .map(item => item.PLAZA || item['PLAZA'] || item.Plaza || item.plaza || '')
      .map(v => String(v || '').trim())
      .filter(v => v && v.toLowerCase() !== 'sin dato' && v.toLowerCase() !== 'n/a' && v.toLowerCase() !== 'na')
  )].sort((a, b) => a.localeCompare(b));
  
  // Filtrar datos
  const filteredData = data.filter(item => {
    const matchesSearch = !searchTerm || 
      (item.Cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.Cuenta || '').includes(searchTerm) ||
      (item.Telefono || '').includes(searchTerm);
    
    const matchesVendor = !filterVendor || item.Vendedor === filterVendor;

    const itemPlaza = String(item.PLAZA || item['PLAZA'] || item.Plaza || item.plaza || '').trim();
    const matchesPlaza = !filterPlaza || itemPlaza === filterPlaza;
    
    return matchesSearch && matchesVendor && matchesPlaza;
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, cuenta, teléfono..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={filterVendor}
            onChange={(e) => setFilterVendor(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos los vendedores</option>
            {vendors.map(vendor => (
              <option key={vendor} value={vendor}>{vendor}</option>
            ))}
          </select>
          <select
            value={filterPlaza || ''}
            onChange={(e) => setFilterPlaza(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas las plazas</option>
            {plazas.map(plaza => (
              <option key={plaza} value={plaza}>{plaza}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Mostrando {filteredData.length} de {dbCount} clientes
        </p>
        {Array.isArray(cobranzaLastUploads) && (
          (() => {
            const row = cobranzaLastUploads.find(r => String(r?._id || '').toLowerCase() === 'sales');
            if (!row?.lastAt) return null;
            const when = new Date(row.lastAt).toLocaleString('es-MX');
            return (
              <p className="text-xs text-slate-500 mt-1">
                Última actualización de Cobranza (BD): <span className="font-semibold">{when}</span>
                {row.byUsername ? <span> (por {row.byUsername})</span> : null}
              </p>
            );
          })()
        )}
      </div>

      {/* Lista de clientes */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Cuenta</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Estatus</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Vendedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                    No hay clientes para mostrar
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">{item.Cliente || '-'}</td>
                    <td className="px-4 py-3 text-sm">{item.Cuenta || '-'}</td>
                    <td className="px-4 py-3 text-sm">{item.Telefono || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        item.Estatus === 'M1' ? 'bg-amber-100 text-amber-700' :
                        item.Estatus === 'M2' ? 'bg-orange-100 text-orange-700' :
                        item.Estatus === 'M3' ? 'bg-red-100 text-red-700' :
                        item.Estatus === 'M4' ? 'bg-pink-100 text-pink-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {item.Estatus || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{item.Vendedor || '-'}</td>
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

