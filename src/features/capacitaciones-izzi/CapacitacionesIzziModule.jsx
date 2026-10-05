import { useState, useEffect } from 'react';
import { GraduationCap, Plus, Trash2, Loader2, Eye, ExternalLink } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import SeguimientoVistasModal from '../../components/common/SeguimientoVistasModal.jsx';

const hoy = () => new Date().toISOString().slice(0, 10);
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString('es-MX', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '');

// Capacitaciones que da directamente Izzi: constantes y abiertas para todos
export default function CapacitacionesIzziModule() {
  const { user } = useAuth();
  const canEdit = ['admin', 'admin_general', 'director'].includes(user?.role);
  const canTrack = canEdit || ['mesa_control', 'marketing'].includes(user?.role);

  const [items, setItems] = useState([]);
  const [conteo, setConteo] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ titulo: '', link: '', descripcion: '', fecha: hoy() });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [seguimiento, setSeguimiento] = useState(null);

  const cargar = async () => {
    try {
      setItems(await api.getContenidoIzzi());
      if (canTrack) api.getConteoSeguimiento().then(setConteo).catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const abrir = (i) => {
    api.registrarVistaContenido(i._id).catch(() => {});
    window.open(i.link, '_blank', 'noopener');
  };

  const agregar = async () => {
    setGuardando(true);
    setError('');
    try {
      await api.crearContenidoCapacitacion({ seccion: 'izzi', ...form });
      setForm({ titulo: '', link: '', descripcion: '', fecha: hoy() });
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (i) => {
    if (!confirm(`¿Borrar "${i.titulo}"? También se borra su registro de aperturas.`)) return;
    await api.eliminarContenidoCapacitacion(i._id);
    cargar();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap className="text-blue-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Capacitaciones de Izzi</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Capacitaciones que da directamente Izzi. Se publican conforme van llegando; abre la liga para tomarla.
        {canTrack && ' El número junto al ojo es cuántos de los esperados ya la abrieron: haz clic para ver quién sí y quién no.'}
      </p>

      {canEdit && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5">
          <p className="font-bold text-sm text-slate-700 mb-2">Publicar una capacitación de Izzi</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Liga (Teams, Meet, Drive, YouTube…)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-2" />
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción o fecha y hora de la sesión (opcional)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-2" />
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <button onClick={agregar} disabled={guardando || !form.titulo.trim() || !form.link.trim()} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publicar
          </button>
        </div>
      )}

      <div className="space-y-2">
        {items.map((i) => {
          const c = conteo[i._id];
          return (
            <div key={i._id} className="flex items-start justify-between gap-2 border border-slate-200 rounded-lg p-3 bg-white">
              <button onClick={() => abrir(i)} className="flex items-start gap-3 text-left flex-1 min-w-0">
                <ExternalLink size={18} className="text-blue-600 mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[11px] text-slate-400">{fmtFecha(i.fecha)}</span>
                  <span className="block font-medium text-slate-800">{i.titulo}</span>
                  {i.descripcion && <span className="block text-xs text-slate-500">{i.descripcion}</span>}
                </span>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                {canTrack && (
                  <button onClick={() => setSeguimiento(i)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-700" title="Quién la abrió y quién no">
                    <Eye size={14} /> {c ? `${c.abrieron}/${c.esperados}` : '—'}
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => eliminar(i)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-center text-slate-400 py-10">Todavía no hay capacitaciones de Izzi publicadas.</p>}
      </div>

      {seguimiento && <SeguimientoVistasModal item={seguimiento} filtroInicial="operativos" onClose={() => setSeguimiento(null)} />}
    </div>
  );
}
