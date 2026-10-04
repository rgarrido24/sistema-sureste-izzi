import { useState, useEffect } from 'react';
import { Calendar, Link2, Plus, X, Loader2, Eye } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const COLORES = [
  { nombre: 'Beige', valor: '#fde9c8' },
  { nombre: 'Verde', valor: '#b7cfa4' },
  { nombre: 'Amarillo', valor: '#fff066' },
  { nombre: 'Azul', valor: '#5bc8e8' },
  { nombre: 'Naranja', valor: '#f5a84e' },
  { nombre: 'Rojo', valor: '#f26666' },
  { nombre: 'Blanco', valor: '#ffffff' },
];

export default function CapacitacionesModule() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director';
  const canVerVistas = user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'marketing';

  const [celdas, setCeldas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null); // { horario, dia } de la celda en edición
  const [form, setForm] = useState({ titulo: '', color: '#fde9c8', link: '' });
  const [guardando, setGuardando] = useState(false);
  const [agregandoHorario, setAgregandoHorario] = useState(false);
  const [nuevoHorario, setNuevoHorario] = useState('');
  const [conteoVistas, setConteoVistas] = useState({});
  const [viendoVistasDe, setViendoVistasDe] = useState(null); // celda cuyo detalle de vistas se muestra
  const [listaVistas, setListaVistas] = useState([]);
  const [cargandoVistas, setCargandoVistas] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await api.getCapacitaciones();
      setCeldas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    if (canVerVistas) {
      api.getConteoVistasCapacitaciones().then(setConteoVistas).catch(() => {});
    }
  }, []);

  const verQuienVio = async (celda) => {
    setViendoVistasDe(celda);
    setCargandoVistas(true);
    try {
      const data = await api.getVistasCapacitacion(celda._id);
      setListaVistas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoVistas(false);
    }
  };

  // Horarios únicos, ordenados por "orden" (el menor orden visto por horario)
  const horarios = (() => {
    const map = new Map();
    celdas.forEach(c => {
      if (!map.has(c.horario) || c.orden < map.get(c.horario)) map.set(c.horario, c.orden ?? 0);
    });
    return Array.from(map.entries()).sort((a, b) => a[1] - b[1]).map(([h]) => h);
  })();

  const getCelda = (horario, dia) => celdas.find(c => c.horario === horario && c.dia === dia);

  const abrirEdicion = (horario, dia) => {
    if (!canEdit) {
      const celda = getCelda(horario, dia);
      if (celda?.link) {
        if (celda._id) api.registrarVistaCapacitacion(celda._id).catch(() => {});
        window.open(celda.link, '_blank');
      }
      return;
    }
    const celda = getCelda(horario, dia);
    setEditando({ horario, dia });
    setForm({
      titulo: celda?.titulo || '',
      color: celda?.color || '#fde9c8',
      link: celda?.link || '',
    });
  };

  const guardarCelda = async () => {
    if (!editando) return;
    setGuardando(true);
    try {
      const orden = horarios.indexOf(editando.horario) >= 0 ? horarios.indexOf(editando.horario) : horarios.length;
      const actualizada = await api.guardarCeldaCapacitacion({
        horario: editando.horario,
        dia: editando.dia,
        titulo: form.titulo,
        color: form.color,
        link: form.link,
        orden,
      });
      setCeldas(prev => {
        const sinEsta = prev.filter(c => !(c.horario === editando.horario && c.dia === editando.dia));
        return [...sinEsta, actualizada];
      });
      setEditando(null);
    } catch (e) {
      alert('Error guardando: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const borrarCelda = async () => {
    const celda = getCelda(editando.horario, editando.dia);
    if (!celda?._id) { setEditando(null); return; }
    if (!confirm('¿Borrar el contenido de esta celda?')) return;
    try {
      await api.eliminarCeldaCapacitacion(celda._id);
      setCeldas(prev => prev.filter(c => c._id !== celda._id));
      setEditando(null);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const agregarHorario = () => {
    if (!nuevoHorario.trim()) return;
    // Crea una celda "fantasma" en LUNES para que el horario aparezca en la rejilla;
    // se puede editar/borrar luego normalmente.
    abrirEdicion(nuevoHorario.trim(), 'LUNES');
    setNuevoHorario('');
    setAgregandoHorario(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="text-blue-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Calendario Semanal de Capacitaciones</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        {canEdit ? 'Haz clic en cualquier celda para editarla o agregar la liga de la sesión.' : 'Haz clic en una sesión para abrir su liga.'}
        {canVerVistas && ' El número con el ícono de ojo bajo cada sesión muestra cuántos han abierto esa liga — haz clic ahí para ver quiénes.'}
      </p>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-sky-400 text-white">
              <th className="p-2 border border-sky-300 min-w-[110px]">HORARIO</th>
              {DIAS.map(d => (
                <th key={d} className="p-2 border border-sky-300 min-w-[140px]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horarios.map(horario => (
              <tr key={horario}>
                <td className="p-2 border border-slate-200 font-bold bg-slate-50 text-center">{horario}</td>
                {DIAS.map(dia => {
                  const celda = getCelda(horario, dia);
                  return (
                    <td
                      key={dia}
                      onClick={() => abrirEdicion(horario, dia)}
                      className="p-2 border border-slate-200 text-center cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: celda?.color || (canEdit ? '#fafafa' : undefined) }}
                    >
                      <div className="font-bold text-slate-800 flex items-center justify-center gap-1">
                        {celda?.titulo || (canEdit ? <span className="text-slate-300">+ agregar</span> : '')}
                        {celda?.link && <Link2 size={12} className="text-blue-700" />}
                      </div>
                      {canVerVistas && celda?.link && (
                        <button
                          onClick={(e) => { e.stopPropagation(); verQuienVio(celda); }}
                          className="mt-1 flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-blue-700 mx-auto"
                        >
                          <Eye size={11} /> {conteoVistas[celda._id] || 0}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="mt-4">
          {!agregandoHorario ? (
            <button
              onClick={() => setAgregandoHorario(true)}
              className="flex items-center gap-1 text-sm text-blue-600 font-bold hover:underline"
            >
              <Plus size={16} /> Agregar nuevo horario (fila)
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nuevoHorario}
                onChange={(e) => setNuevoHorario(e.target.value)}
                placeholder="ej. 18:00-19:00 PM"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                autoFocus
              />
              <button onClick={agregarHorario} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Agregar</button>
              <button onClick={() => setAgregandoHorario(false)} className="px-3 py-2 text-sm text-slate-500">Cancelar</button>
            </div>
          )}
        </div>
      )}

      {editando && canEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditando(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-slate-800">{editando.dia} — {editando.horario}</h3>
              <button onClick={() => setEditando(null)}><X size={18} /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Título de la sesión</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ej. INDUCCION, REDES, IZZITV+"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Liga de la capacitación (opcional)</label>
                <input
                  type="text"
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORES.map(c => (
                    <button
                      key={c.valor}
                      onClick={() => setForm({ ...form, color: c.valor })}
                      className={`w-8 h-8 rounded-full border-2 ${form.color === c.valor ? 'border-blue-600' : 'border-slate-200'}`}
                      style={{ backgroundColor: c.valor }}
                      title={c.nombre}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={borrarCelda} className="px-3 py-2 text-sm text-red-600 font-bold">Borrar celda</button>
              <button
                onClick={guardarCelda}
                disabled={guardando}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400"
              >
                {guardando ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viendoVistasDe && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setViendoVistasDe(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-slate-800">Quién abrió este link</h3>
                <p className="text-xs text-slate-500">{viendoVistasDe.dia} — {viendoVistasDe.horario} — {viendoVistasDe.titulo}</p>
              </div>
              <button onClick={() => setViendoVistasDe(null)}><X size={18} /></button>
            </div>

            {cargandoVistas ? (
              <Loader2 className="animate-spin mx-auto my-6" size={20} />
            ) : listaVistas.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Nadie ha abierto este link todavía.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {listaVistas.map((v, i) => (
                  <div key={v._id || i} className="flex justify-between items-center text-sm border-b border-slate-100 pb-1">
                    <span className="font-medium text-slate-700">{v.usuarioNombre || v.usuarioUsername}</span>
                    <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleString('es-MX')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
