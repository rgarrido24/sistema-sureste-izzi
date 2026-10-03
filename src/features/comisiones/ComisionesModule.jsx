import { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Loader2 } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

export default function ComisionesModule() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director';
  const [tab, setTab] = useState('vendedores');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign className="text-green-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Factor de Comisión</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        El factor y la comisión base nunca los ve el vendedor/sub — solo tú, supervisores, regionales y directores.
      </p>

      <div className="flex gap-2 mb-4 border-b border-slate-200">
        <button
          onClick={() => setTab('vendedores')}
          className={`px-4 py-2 text-sm font-bold border-b-2 ${tab === 'vendedores' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
        >
          Vendedores (factor)
        </button>
        <button
          onClick={() => setTab('paquetes')}
          className={`px-4 py-2 text-sm font-bold border-b-2 ${tab === 'paquetes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
        >
          Paquetes (comisión base)
        </button>
      </div>

      {tab === 'vendedores' && <VendedoresTab canEdit={canEdit} />}
      {tab === 'paquetes' && <PaquetesTab canEdit={canEdit} />}
    </div>
  );
}

function VendedoresTab({ canEdit }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendedor, setVendedor] = useState('');
  const [tipo, setTipo] = useState('directa');
  const [factor, setFactor] = useState('1.5');
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    setLoading(true);
    api.getVendedoresFactor().then(setLista).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const handleGuardar = async () => {
    if (!vendedor.trim() || !factor) return;
    setGuardando(true);
    try {
      await api.guardarVendedorFactor(vendedor.trim(), tipo, parseFloat(factor), 10);
      setVendedor(''); setFactor('1.5'); setTipo('directa');
      cargar();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Quitar el factor de este vendedor?')) return;
    await api.eliminarVendedorFactor(id);
    cargar();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {canEdit && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
          <p className="font-bold text-sm text-slate-700 mb-3">Asignar / actualizar factor</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              placeholder="Nombre del vendedor/sub"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[150px]"
            />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="directa">Venta directa (sin retención)</option>
              <option value="distribuidor">Distribuidor (retención 10%)</option>
            </select>
            <input
              type="number"
              step="0.1"
              value={factor}
              onChange={(e) => setFactor(e.target.value)}
              placeholder="Factor"
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-1"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Guardar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2">Vendedor</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Factor</th>
              <th className="text-left px-3 py-2">Retención</th>
              {canEdit && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {lista.map(v => (
              <tr key={v._id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{v.vendedor}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v.tipo === 'distribuidor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {v.tipo === 'distribuidor' ? 'Distribuidor' : 'Venta directa'}
                  </span>
                </td>
                <td className="px-3 py-2 font-bold">{v.factor}</td>
                <td className="px-3 py-2">{v.tipo === 'distribuidor' ? `${v.retencionPorcentaje}%` : '—'}</td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <button onClick={() => handleEliminar(v._id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="text-center text-slate-400 py-8">Sin vendedores con factor asignado todavía.</p>}
      </div>
    </div>
  );
}

function PaquetesTab({ canEdit }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sembrando, setSembrando] = useState(false);
  const [paquete, setPaquete] = useState('');
  const [comisionBase, setComisionBase] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    setLoading(true);
    api.getComisionPaquetes().then(setLista).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const handleSembrar = async () => {
    setSembrando(true);
    try {
      await api.sembrarComisionPaquetes();
      cargar();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSembrando(false);
    }
  };

  const handleGuardar = async () => {
    if (!paquete.trim() || !comisionBase) return;
    setGuardando(true);
    try {
      await api.guardarComisionPaquete(paquete.trim(), parseFloat(comisionBase));
      setPaquete(''); setComisionBase('');
      cargar();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Borrar este paquete?')) return;
    await api.eliminarComisionPaquete(id);
    cargar();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {canEdit && lista.length === 0 && (
        <button
          onClick={handleSembrar}
          disabled={sembrando}
          className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400"
        >
          {sembrando ? 'Cargando...' : 'Cargar tabla de comisiones (~40 paquetes)'}
        </button>
      )}

      {canEdit && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
          <p className="font-bold text-sm text-slate-700 mb-3">Agregar / actualizar un paquete</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={paquete}
              onChange={(e) => setPaquete(e.target.value)}
              placeholder="Nombre del paquete"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[200px]"
            />
            <input
              type="number"
              step="0.01"
              value={comisionBase}
              onChange={(e) => setComisionBase(e.target.value)}
              placeholder="Comisión base $"
              className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2">Paquete</th>
              <th className="text-left px-3 py-2">Comisión base</th>
              {canEdit && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {lista.map(p => (
              <tr key={p._id} className="border-t border-slate-100">
                <td className="px-3 py-2">{p.paquete}</td>
                <td className="px-3 py-2 font-bold">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.comisionBase)}
                </td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <button onClick={() => handleEliminar(p._id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="text-center text-slate-400 py-8">Sin paquetes cargados todavía.</p>}
      </div>
    </div>
  );
}
