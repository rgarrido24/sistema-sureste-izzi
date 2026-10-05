import { useState, useEffect } from 'react';
import { TrendingUp, Plus, Trash2, Loader2, Eye, ExternalLink, Lock } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import SeguimientoVistasModal from '../../components/common/SeguimientoVistasModal.jsx';

const NIVELES = [1, 2, 3, 4, 5];
const COLOR_NIVEL = { 1: 'bg-slate-100 text-slate-700', 2: 'bg-blue-100 text-blue-700', 3: 'bg-indigo-100 text-indigo-700', 4: 'bg-purple-100 text-purple-700', 5: 'bg-amber-100 text-amber-800' };
const colorPct = (p) => (p === null ? 'text-slate-400' : p > 13.5 ? 'text-red-700 font-bold' : p < 5 ? 'text-green-700 font-bold' : 'text-amber-700 font-bold');

// Contenido exclusivo de venta directa y redes sociales; cambia conforme suben de nivel
export default function CrecimientoTab({ esStaff }) {
  const { user } = useAuth();
  const canEdit = ['admin', 'admin_general', 'director'].includes(user?.role);
  const canTrack = canEdit || ['mesa_control', 'marketing'].includes(user?.role);
  const [vista, setVista] = useState('contenido');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="text-green-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Crecimiento: venta directa y redes sociales</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Esta sección solo la ven venta directa y redes sociales (los distribuidores no). El contenido va cambiando conforme mejoran en ventas y calidad.
      </p>

      {esStaff && (
        <div className="flex gap-2 mb-4 border-b border-slate-200">
          <button onClick={() => setVista('contenido')} className={`px-4 py-2 text-sm font-bold border-b-2 ${vista === 'contenido' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Contenido por nivel</button>
          <button onClick={() => setVista('miembros')} className={`px-4 py-2 text-sm font-bold border-b-2 ${vista === 'miembros' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Personas y niveles</button>
        </div>
      )}

      {vista === 'contenido' ? <ContenidoCrecimiento canEdit={canEdit} canTrack={canTrack} /> : <MiembrosNiveles canEdit={canEdit} />}
    </div>
  );
}

function ContenidoCrecimiento({ canEdit, canTrack }) {
  const [data, setData] = useState(null);
  const [conteo, setConteo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ titulo: '', link: '', descripcion: '', nivel: 1 });
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [seguimiento, setSeguimiento] = useState(null);

  const cargar = async () => {
    try {
      setData(await api.getContenidoCrecimiento());
      if (canTrack) api.getConteoSeguimiento().then(setConteo).catch(() => {});
    } catch (e) {
      setError(e.message);
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
    setErrorForm('');
    try {
      await api.crearContenidoCapacitacion({ seccion: 'crecimiento', ...form });
      setForm({ titulo: '', link: '', descripcion: '', nivel: form.nivel });
      cargar();
    } catch (e) {
      setErrorForm(e.message);
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
  if (error) return <p className="text-center text-red-600 py-8">{error}</p>;

  const grupos = NIVELES.map((n) => ({ nivel: n, items: data.items.filter((i) => i.nivel === n) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {!data.esStaff && (
        <div className="bg-slate-800 text-white rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-300">Tu nivel</p>
            <p className="text-2xl font-extrabold">Nivel {data.nivel}</p>
          </div>
          <p className="text-xs text-slate-300 max-w-[220px] text-right">Conforme mejores en ventas y calidad, se desbloquea más contenido.</p>
        </div>
      )}

      {canEdit && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="font-bold text-sm text-slate-700 mb-2">Agregar contenido</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título" className="px-3 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-2" />
            <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: Number(e.target.value) })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              {NIVELES.map((n) => <option key={n} value={n}>Nivel {n}</option>)}
            </select>
            <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Liga (Drive, YouTube, Meet…)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-3" />
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción (opcional)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-3" />
          </div>
          {errorForm && <p className="text-xs text-red-600 mt-2">{errorForm}</p>}
          <button onClick={agregar} disabled={guardando || !form.titulo.trim() || !form.link.trim()} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Agregar
          </button>
        </div>
      )}

      {grupos.map((g) => (
        <div key={g.nivel}>
          <p className="mb-2"><span className={`text-xs font-bold px-2 py-1 rounded-full ${COLOR_NIVEL[g.nivel]}`}>Nivel {g.nivel}</span></p>
          <div className="space-y-2">
            {g.items.map((i) => {
              const c = conteo[i._id];
              return (
                <div key={i._id} className="flex items-start justify-between gap-2 border border-slate-200 rounded-lg p-3 bg-white">
                  <button onClick={() => abrir(i)} className="flex items-start gap-3 text-left flex-1 min-w-0">
                    <ExternalLink size={18} className="text-blue-600 mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800">{i.titulo}</span>
                      {i.descripcion && <span className="block text-xs text-slate-500">{i.descripcion}</span>}
                    </span>
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    {canTrack && (
                      <button onClick={() => setSeguimiento(i)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-700" title="Quién lo abrió y quién no">
                        <Eye size={14} /> {c ? `${c.abrieron}/${c.esperados}` : '—'}
                      </button>
                    )}
                    {canEdit && <button onClick={() => eliminar(i)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {grupos.length === 0 && <p className="text-center text-slate-400 py-10">Todavía no hay contenido en esta sección.</p>}

      {!data.esStaff && data.nivelesSuperiores > 0 && (
        <div className="flex items-center gap-2 border border-dashed border-slate-300 rounded-lg p-3 text-sm text-slate-500">
          <Lock size={16} /> Hay más contenido que se desbloquea al subir de nivel.
        </div>
      )}

      {seguimiento && <SeguimientoVistasModal item={seguimiento} filtroInicial="todos" onClose={() => setSeguimiento(null)} />}
    </div>
  );
}

// Dirección ve el desempeño de cada persona y decide su nivel; Mesa de Control y Marketing solo lo ven
function MiembrosNiveles({ canEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState('');

  useEffect(() => {
    api.getMiembrosCrecimiento().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const cambiar = async (m, nivel) => {
    setGuardando(m.id);
    try {
      await api.cambiarNivelMiembro(m.id, nivel);
      setData((d) => ({ ...d, miembros: d.miembros.map((x) => (x.id === m.id ? { ...x, nivel } : x)) }));
    } catch (e) {
      alert(e.message);
    } finally {
      setGuardando('');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-center text-red-600 py-8">{error}</p>;

  const filtrados = data.miembros.filter((m) => !busqueda || m.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
        Aquí aparecen las personas de redes sociales y de venta directa. Un vendedor sale en esta lista solo si en la <b>Base de vendedores</b> (Comisiones)
        está marcado como Venta directa y su nombre coincide con el de su usuario. Todos empiezan en nivel 1; {canEdit ? 'tú decides cuándo sube cada quien según sus ventas y su % M1.' : 'Dirección decide cuándo sube cada quien.'}
      </p>
      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar persona…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Persona</th>
              <th className="text-left px-3 py-2">Perfil</th>
              <th className="text-right px-3 py-2">Cuentas M1</th>
              <th className="text-right px-3 py-2">% M1 Total</th>
              <th className="text-left px-3 py-2">Nivel</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{m.nombre}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{m.role === 'redes_sociales' ? 'Redes sociales' : 'Venta directa'}</td>
                <td className="px-3 py-2 text-right">{m.ventas}</td>
                <td className={`px-3 py-2 text-right ${colorPct(m.porcentajeM1)}`}>{m.porcentajeM1 === null ? '—' : `${m.porcentajeM1}%`}</td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <select value={m.nivel} disabled={guardando === m.id} onChange={(e) => cambiar(m, Number(e.target.value))} className="px-2 py-1 border border-slate-300 rounded text-xs">
                      {NIVELES.map((n) => <option key={n} value={n}>Nivel {n}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${COLOR_NIVEL[m.nivel]}`}>Nivel {m.nivel}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="text-center text-slate-400 py-8">Sin personas en esta lista todavía.</p>}
      </div>
    </div>
  );
}
