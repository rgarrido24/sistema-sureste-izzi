import { useState, useEffect } from 'react';
import { Trophy, Medal } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

const PODIO_ICONOS = ['🥇', '🥈', '🥉'];

function colorPorcentaje(pct) {
  if (pct > 13.5) return 'text-red-700 bg-red-50';
  if (pct < 5) return 'text-green-700 bg-green-50';
  return 'text-amber-700 bg-amber-50';
}

export default function RankingVentaDirectaModule() {
  const { user } = useAuth();
  const esVendedor = user?.role === 'vendedor';

  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getRankingVentaDirecta();
        setRanking(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingSpinner />;

  const miNombreNorm = String(user?.name || '').trim().toUpperCase();
  const miIndice = ranking.findIndex(r => r.nombre.trim().toUpperCase() === miNombreNorm);
  const miPosicion = miIndice >= 0 ? miIndice + 1 : null;
  const miFila = miIndice >= 0 ? ranking[miIndice] : null;

  const filasAMostrar = esVendedor ? ranking.slice(0, 3) : ranking;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="text-amber-500" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Ranking de Venta Directa</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Ordenado por volumen de venta (cuentas en M1). El % M1 Total es un dato de calidad, no de orden.
      </p>

      {esVendedor && miFila && (
        <div className="bg-slate-800 text-white rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-300">Tu posición</p>
            <p className="text-2xl font-extrabold">#{miPosicion} de {ranking.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-300">Tu volumen / % M1</p>
            <p className="font-bold">{miFila.volumen} ventas · {miFila.porcentajeM1Total}%</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 w-12">#</th>
              <th className="text-left px-3 py-2">Vendedor</th>
              <th className="text-left px-3 py-2">Volumen</th>
              <th className="text-left px-3 py-2">% M1 Total</th>
              <th className="text-left px-3 py-2">Ciudad / Plaza</th>
            </tr>
          </thead>
          <tbody>
            {filasAMostrar.map((r, i) => {
              const esMiFila = r.nombre.trim().toUpperCase() === miNombreNorm;
              return (
                <tr key={r.nombre} className={`border-t border-slate-100 ${esMiFila ? 'bg-blue-50 font-bold' : ''}`}>
                  <td className="px-3 py-2">{i < 3 ? PODIO_ICONOS[i] : i + 1}</td>
                  <td className="px-3 py-2">{r.nombre}</td>
                  <td className="px-3 py-2 font-bold">{r.volumen}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colorPorcentaje(r.porcentajeM1Total)}`}>
                      {r.porcentajeM1Total}%
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.plaza}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filasAMostrar.length === 0 && (
          <p className="text-center text-slate-400 py-8">Sin datos todavía.</p>
        )}
      </div>

      {esVendedor && (
        <p className="text-xs text-slate-400 mt-2">Solo se muestra el top 3. Tu posición completa está arriba.</p>
      )}
    </div>
  );
}
