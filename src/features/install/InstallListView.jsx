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
  const [installLastUpdate, setInstallLastUpdate] = useState(null);

  const pickFirst = (obj, keys = []) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  };

  const getCliente = (item) => pickFirst(item, ['Cliente', 'CLIENTE', 'Nombre', 'NOMBRE', 'Nombre Cliente', 'Cliente Nombre']);
  const getCuenta = (item) => pickFirst(item, ['Cuenta', 'CUENTA', 'Nº de cuenta', 'N° de cuenta', 'No. de cuenta', 'NoCuenta', 'Referencia', 'REFERENCIA']);
  const getCiudad = (item) => pickFirst(item, ['Ciudad', 'CIUDAD', 'Plaza', 'PLAZA', 'Hub', 'HUB']);
  const getEstatus = (item) => pickFirst(item, ['Estatus', 'ESTATUS', 'Estado', 'ESTADO', 'status']);

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

  useEffect(() => {
    const loadLastUpdate = async () => {
      if (!user) return;
      try {
        const result = await api.getInstallLastUpdate();
        setInstallLastUpdate(result?.installLastUpdate || null);
      } catch (e) {
        // ignore
      }
    };
    loadLastUpdate();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner message="Cargando instalaciones..." />
      </div>
    );
  }

  const ciudades = [...new Set(data.map(item => getCiudad(item)).filter(Boolean))].sort();

  const filteredData = data.filter(item => {
    const matchesSearch = !searchTerm || 
      String(getCliente(item) || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(getCuenta(item) || '').includes(searchTerm);
    
    const matchesCiudad = !filterCiudad || 
      getCiudad(item) === filterCiudad;
    
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
        {installLastUpdate?.lastAt && (
          <p className="text-xs text-slate-500 mt-1">
            Última actualización de Instalaciones: <span className="font-semibold">{new Date(installLastUpdate.lastAt).toLocaleString('es-MX')}</span>
            {installLastUpdate.byUsername ? <span> (por {installLastUpdate.byUsername})</span> : null}
          </p>
        )}
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
                    <td className="px-4 py-3 text-sm">{getCliente(item) || '-'}</td>
                    <td className="px-4 py-3 text-sm">{getCuenta(item) || '-'}</td>
                    <td className="px-4 py-3 text-sm">{getCiudad(item) || '-'}</td>
                    <td className="px-4 py-3 text-sm">{getEstatus(item) || '-'}</td>
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

