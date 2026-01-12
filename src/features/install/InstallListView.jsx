import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import * as api from '../../api.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import { filterByVendor } from '../../utils/vendorFilter.js';

export default function InstallListView({ 
  searchTerm, 
  setSearchTerm, 
  filterCiudad, 
  setFilterCiudad
}) {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbCount, setDbCount] = useState(0);

  // Cargar datos solo cuando esta vista se monta
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        let installData = await api.getInstallMaster();
        // Aplicar filtro de vendedor si es necesario
        installData = filterByVendor(installData, user);
        setData(installData.map(d => ({ id: d._id || d.id, ...d })));
        setDbCount(installData.length);
      } catch (error) {
        console.error('Error cargando instalaciones:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner message="Cargando instalaciones..." />
      </div>
    );
  }

  const ciudades = [...new Set(data.map(item => item.Ciudad || item.Plaza).filter(Boolean))].sort();

  const filteredData = data.filter(item => {
    const matchesSearch = !searchTerm || 
      (item.Cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.Cuenta || '').includes(searchTerm);
    
    const matchesCiudad = !filterCiudad || 
      (item.Ciudad || item.Plaza) === filterCiudad;
    
    return matchesSearch && matchesCiudad;
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
              placeholder="Buscar cliente, cuenta..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={filterCiudad}
            onChange={(e) => setFilterCiudad(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas las ciudades</option>
            {ciudades.map(ciudad => (
              <option key={ciudad} value={ciudad}>{ciudad}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Mostrando {filteredData.length} de {dbCount} instalaciones
        </p>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Cuenta</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Ciudad</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                    No hay instalaciones para mostrar
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">{item.Cliente || '-'}</td>
                    <td className="px-4 py-3 text-sm">{item.Cuenta || '-'}</td>
                    <td className="px-4 py-3 text-sm">{item.Ciudad || item.Plaza || '-'}</td>
                    <td className="px-4 py-3 text-sm">{item.Estatus || '-'}</td>
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

