import { useState, useEffect } from 'react';
import { X, Loader2, Copy, Check } from 'lucide-react';
import * as api from '../../api.js';

const ROL_LABEL = {
  vendedor: 'Vendedor', redes_sociales: 'Redes sociales', reclutador: 'Reclutador', mesa_control: 'Mesa de Control',
  director: 'Director', supervisor: 'Supervisor', regionales: 'Regional', cobranza_mx: 'Cobranza MX', marketing: 'Marketing',
  admin: 'Admin', admin_general: 'Admin',
};
const FILTROS = [
  { k: 'operativos', label: 'Vendedores y redes' },
  { k: 'vendedor', label: 'Solo vendedores' },
  { k: 'directa', label: 'Solo venta directa' },
  { k: 'distribuidor', label: 'Solo distribuidores' },
  { k: 'redes_sociales', label: 'Solo redes sociales' },
  { k: 'reclutador', label: 'Reclutadores' },
  { k: 'todos', label: 'Todos' },
];

const pasa = (p, f) => {
  if (f === 'todos') return true;
  if (f === 'operativos') return p.role === 'vendedor' || p.role === 'redes_sociales';
  if (f === 'directa' || f === 'distribuidor') return p.tipo === f;
  return p.role === f;
};
const etiqueta = (p) => (p.tipo === 'directa' ? 'Venta directa' : p.tipo === 'distribuidor' ? 'Distribuidor' : ROL_LABEL[p.role] || p.role);
const fmt = (d) => (d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '');

// Quién abrió un contenido y quién todavía no (con filtro por tipo de persona)
export default function SeguimientoVistasModal({ item, filtroInicial = 'operativos', onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('pendientes');
  const [filtro, setFiltro] = useState(filtroInicial);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    api.getSeguimientoContenido(item._id).then(setData).catch((e) => setError(e.message));
  }, [item._id]);

  const abrieron = (data?.abrieron || []).filter((p) => pasa(p, filtro));
  const pendientes = (data?.pendientes || []).filter((p) => pasa(p, filtro));
  const lista = tab === 'pendientes' ? pendientes : abrieron;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(pendientes.map((p) => p.nombre).join('\n'));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin permiso de portapapeles */ }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 max-w-md w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800">Seguimiento</h3>
            <p className="text-xs text-slate-500 truncate">{item.titulo}</p>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!data && !error && <Loader2 className="animate-spin mx-auto my-8" size={20} />}

        {data && (
          <>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3">
              {FILTROS.map((f) => <option key={f.k} value={f.k}>{f.label}</option>)}
            </select>

            <div className="flex gap-2 mb-3 border-b border-slate-200">
              <button onClick={() => setTab('pendientes')} className={`px-3 py-2 text-sm font-bold border-b-2 ${tab === 'pendientes' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500'}`}>
                No han abierto ({pendientes.length})
              </button>
              <button onClick={() => setTab('abrieron')} className={`px-3 py-2 text-sm font-bold border-b-2 ${tab === 'abrieron' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500'}`}>
                Ya abrieron ({abrieron.length})
              </button>
            </div>

            {tab === 'pendientes' && pendientes.length > 0 && (
              <button onClick={copiar} className="self-start mb-2 text-xs font-bold text-blue-600 flex items-center gap-1">
                {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar nombres para dar seguimiento'}
              </button>
            )}

            <div className="overflow-y-auto space-y-1">
              {lista.map((p) => (
                <div key={p.id} className="flex justify-between items-center text-sm border-b border-slate-100 py-1.5 gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 truncate">{p.nombre}</p>
                    <p className="text-[11px] text-slate-400">{etiqueta(p)}</p>
                  </div>
                  {tab === 'abrieron' && (
                    <span className="text-[11px] text-slate-400 text-right shrink-0">
                      {p.veces} {p.veces === 1 ? 'vez' : 'veces'}<br />{fmt(p.ultima)}
                    </span>
                  )}
                </div>
              ))}
              {lista.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">
                  {tab === 'pendientes' ? 'Nadie pendiente en este grupo. 🎉' : 'Nadie de este grupo lo ha abierto todavía.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
