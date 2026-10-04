import { useState, useEffect } from 'react';
import { Star, Plus, Loader2 } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

export default function PuntosModule() {
  const { user } = useAuth();
  const canOtorgar = user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director';
  const esVendedor = ['vendedor', 'redes_sociales', 'reclutador'].includes(user?.role);

  if (esVendedor) return <MisPuntos />;
  return <PuntosAdmin canOtorgar={canOtorgar} />;
}

function MisPuntos() {
  const [data, setData] = useState({ total: 0, movimientos: [] });
  const [riesgo, setRiesgo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getMisPuntos().catch(() => ({ total: 0, movimientos: [] })),
      api.getMiRiesgo().catch(() => ({ aplica: false })),
    ]).then(([puntosData, riesgoData]) => {
      setData(puntosData);
      setRiesgo(riesgoData);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Star className="text-amber-500" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Mis Puntos</h2>
      </div>

      <div className="bg-slate-800 text-white rounded-xl p-6 text-center mb-4">
        <p className="text-sm text-slate-300 mb-1">Total acumulado</p>
        <p className="text-4xl font-extrabold">{data.total}</p>
      </div>

      {riesgo?.aplica && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-red-700 mb-1">Monto en riesgo si no pagan tus clientes</p>
          <p className="text-3xl font-extrabold text-red-700">
            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(riesgo.montoEnRiesgo)}
          </p>
          <p className="text-xs text-red-500 mt-1">{riesgo.cuentasEnRiesgo} cuenta(s) pendiente(s) de pago</p>
        </div>
      )}

      <h3 className="font-bold text-slate-700 mb-2 text-sm">Historial</h3>
      <div className="space-y-2">
        {data.movimientos.map(m => (
          <div key={m._id} className="flex justify-between items-center bg-white border border-slate-200 rounded-lg p-3 text-sm">
            <div>
              <p className="font-medium text-slate-700">{m.motivo || (m.puntos > 0 ? 'Puntos ganados' : 'Puntos canjeados')}</p>
              <p className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleDateString('es-MX')}</p>
            </div>
            <span className={`font-extrabold ${m.puntos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {m.puntos >= 0 ? '+' : ''}{m.puntos}
            </span>
          </div>
        ))}
        {data.movimientos.length === 0 && (
          <p className="text-center text-slate-400 py-8">Todavía no tienes movimientos de puntos.</p>
        )}
      </div>
    </div>
  );
}

function PuntosAdmin({ canOtorgar }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendedor, setVendedor] = useState('');
  const [puntos, setPuntos] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await api.getPuntosTodos();
      setLista(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleOtorgar = async () => {
    if (!vendedor.trim() || !puntos) return;
    setGuardando(true);
    try {
      await api.otorgarPuntos(vendedor.trim(), parseInt(puntos), motivo);
      setVendedor(''); setPuntos(''); setMotivo('');
      cargar();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Star className="text-amber-500" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Puntos de Venta</h2>
      </div>

      {canOtorgar && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
          <p className="font-bold text-sm text-slate-700 mb-3">Otorgar / ajustar puntos</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              placeholder="Nombre del vendedor"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[150px]"
            />
            <input
              type="number"
              value={puntos}
              onChange={(e) => setPuntos(e.target.value)}
              placeholder="Puntos (negativo para descontar)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-44"
            />
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (opcional)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[150px]"
            />
            <button
              onClick={handleOtorgar}
              disabled={guardando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-1"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Aplicar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr><th className="text-left px-3 py-2">Vendedor</th><th className="text-left px-3 py-2">Puntos totales</th></tr>
          </thead>
          <tbody>
            {lista.map(v => (
              <tr key={v.vendedor} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{v.vendedor}</td>
                <td className="px-3 py-2 font-extrabold text-amber-600">{v.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="text-center text-slate-400 py-8">Sin puntos registrados todavía.</p>}
      </div>
    </div>
  );
}
