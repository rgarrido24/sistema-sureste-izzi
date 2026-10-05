import { useState, useEffect } from 'react';
import { Calendar, Link2, Plus, X, Loader2, Eye, Video, FileCheck, Trash2, Lock, Key, RefreshCw } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import CrecimientoTab from './CrecimientoTab.jsx';

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

function CapacitacionesGeneral() {
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

      <RecursosCapacitacion canEdit={canEdit} canVerVistas={canVerVistas} />
    </div>
  );
}

function RecursosCapacitacion({ canEdit, canVerVistas }) {
  const [recursos, setRecursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState({ exento: false, desbloqueado: true, expiraEn: null, codigoConfigurado: true });
  const [conteoVistas, setConteoVistas] = useState({});
  const [viendoVistasDe, setViendoVistasDe] = useState(null);
  const [listaVistas, setListaVistas] = useState([]);
  const [cargandoVistas, setCargandoVistas] = useState(false);

  const [codigoInput, setCodigoInput] = useState('');
  const [desbloqueando, setDesbloqueando] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState('');

  const [tipoNuevo, setTipoNuevo] = useState('pregrabada');
  const [tituloNuevo, setTituloNuevo] = useState('');
  const [linkNuevo, setLinkNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const [data, est] = await Promise.all([
        api.getRecursosCapacitacion(),
        api.getEstadoPregrabadas().catch(() => null),
      ]);
      setRecursos(data);
      if (est) setEstado(est);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    if (canVerVistas) {
      api.getConteoVistasRecursos().then(setConteoVistas).catch(() => {});
    }
  }, []);

  const handleDesbloquear = async () => {
    if (!codigoInput.trim()) return;
    setDesbloqueando(true);
    setErrorCodigo('');
    try {
      await api.desbloquearPregrabadas(codigoInput.trim());
      setCodigoInput('');
      await cargar();
    } catch (e) {
      setErrorCodigo(e.message || 'No se pudo validar el código');
    } finally {
      setDesbloqueando(false);
    }
  };

  const handleAgregar = async () => {
    if (!tituloNuevo.trim() || !linkNuevo.trim()) return;
    setGuardando(true);
    try {
      await api.crearRecursoCapacitacion(tipoNuevo, tituloNuevo.trim(), linkNuevo.trim());
      setTituloNuevo(''); setLinkNuevo('');
      cargar();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este recurso?')) return;
    await api.eliminarRecursoCapacitacion(id);
    cargar();
  };

  const handleAbrir = (recurso) => {
    if (recurso.bloqueado || !recurso.link) return;
    api.registrarVistaRecurso(recurso._id).catch(() => {});
    window.open(recurso.link, '_blank');
  };

  const verQuienVio = async (recurso) => {
    setViendoVistasDe(recurso);
    setCargandoVistas(true);
    try {
      const data = await api.getVistasRecurso(recurso._id);
      setListaVistas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoVistas(false);
    }
  };

  if (loading) return null;

  const pregrabadas = recursos.filter(r => r.tipo === 'pregrabada');
  const examenes = recursos.filter(r => r.tipo === 'examen');
  const hayBloqueadas = pregrabadas.some(r => r.bloqueado);

  const renderLista = (lista, Icono) => (
    <div className="space-y-2">
      {lista.map(r => (
        <div key={r._id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg p-3">
          <button
            onClick={() => handleAbrir(r)}
            disabled={r.bloqueado}
            className={`flex items-center gap-2 text-left flex-1 min-w-0 ${r.bloqueado ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {r.bloqueado
              ? <Lock size={16} className="text-amber-600 shrink-0" />
              : <Icono size={16} className="text-blue-600 shrink-0" />}
            <span className="font-medium text-slate-700 truncate">{r.titulo}</span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {canVerVistas && (
              <button onClick={() => verQuienVio(r)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700">
                <Eye size={12} /> {conteoVistas[r._id] || 0}
              </button>
            )}
            {canEdit && (
              <button onClick={() => handleEliminar(r._id)} className="text-red-500 hover:text-red-700">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
      {lista.length === 0 && <p className="text-sm text-slate-400">Nada cargado todavía.</p>}
    </div>
  );

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2"><Video size={18} /> Capacitaciones pregrabadas</h3>
        <p className="text-xs text-slate-500 mb-3">Material de repaso. Primero toma la capacitación en vivo.</p>

        {hayBloqueadas && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
            <p className="text-sm font-bold text-amber-800 flex items-center gap-1"><Lock size={14} /> Acceso con código</p>
            {estado.codigoConfigurado ? (
              <>
                <p className="text-xs text-amber-700 mt-1">
                  El código se da al final de cada capacitación en vivo. Si ya asististe y no lo tienes,
                  contacta a tu supervisor o al administrador.
                </p>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={codigoInput}
                    onChange={(e) => setCodigoInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDesbloquear(); }}
                    placeholder="Código"
                    autoComplete="off"
                    className="px-3 py-2 border border-amber-300 rounded-lg text-sm uppercase flex-1 min-w-0"
                  />
                  <button
                    onClick={handleDesbloquear}
                    disabled={!codigoInput.trim() || desbloqueando}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-1"
                  >
                    {desbloqueando ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />} Desbloquear
                  </button>
                </div>
                {errorCodigo && <p className="text-xs text-red-600 mt-2">{errorCodigo}</p>}
              </>
            ) : (
              <p className="text-xs text-amber-700 mt-1">
                El acceso a las pregrabadas todavía no está activado. Contacta al administrador.
              </p>
            )}
          </div>
        )}

        {!hayBloqueadas && !estado.exento && estado.expiraEn && pregrabadas.length > 0 && (
          <p className="text-xs text-green-700 mb-2">
            Acceso activo hasta {new Date(estado.expiraEn).toLocaleString('es-MX')}
          </p>
        )}

        {renderLista(pregrabadas, Video)}
      </div>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><FileCheck size={18} /> Exámenes</h3>
        {renderLista(examenes, FileCheck)}
      </div>

      {canEdit && <ConfigCodigoPregrabadas />}

      {canEdit && (
        <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="font-bold text-sm text-slate-700 mb-3">Agregar pregrabada o examen</p>
          <div className="flex flex-wrap gap-2">
            <select value={tipoNuevo} onChange={(e) => setTipoNuevo(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="pregrabada">Pregrabada</option>
              <option value="examen">Examen</option>
            </select>
            <input
              type="text"
              value={tituloNuevo}
              onChange={(e) => setTituloNuevo(e.target.value)}
              placeholder="Título"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[150px]"
            />
            <input
              type="text"
              value={linkNuevo}
              onChange={(e) => setLinkNuevo(e.target.value)}
              placeholder="Liga (Drive, Forms, etc.)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[200px]"
            />
            <button
              onClick={handleAgregar}
              disabled={guardando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-1"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Agregar
            </button>
          </div>
        </div>
      )}

      {viendoVistasDe && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setViendoVistasDe(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-slate-800">Quién abrió "{viendoVistasDe.titulo}"</h3>
              <button onClick={() => setViendoVistasDe(null)}><X size={18} /></button>
            </div>
            {cargandoVistas ? (
              <Loader2 className="animate-spin mx-auto my-6" size={20} />
            ) : listaVistas.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Nadie lo ha abierto todavía.</p>
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

// Panel solo para admin/director: ver/cambiar el código y la duración del acceso
function ConfigCodigoPregrabadas() {
  const [cfg, setCfg] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [horas, setHoras] = useState(24);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [verAccesos, setVerAccesos] = useState(false);
  const [accesos, setAccesos] = useState([]);

  const cargar = async () => {
    try {
      const c = await api.getConfigPregrabadas();
      setCfg(c);
      setCodigo(c.codigo || '');
      setHoras(c.horasAcceso || 24);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { cargar(); }, []);

  const generar = () => {
    // Sin caracteres que se confunden (0/O, 1/I)
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint32Array(6);
    crypto.getRandomValues(bytes);
    setCodigo(Array.from(bytes).map(b => alfabeto[b % alfabeto.length]).join(''));
  };

  const guardar = async () => {
    setGuardando(true);
    setMensaje('');
    try {
      const anterior = cfg?.codigo || '';
      const c = await api.guardarConfigPregrabadas(codigo, horas);
      setCfg(c);
      setCodigo(c.codigo);
      setMensaje(c.codigo !== anterior
        ? 'Código actualizado. Los accesos anteriores quedaron cancelados.'
        : 'Guardado.');
      if (verAccesos) api.getAccesosPregrabadas().then(setAccesos).catch(() => {});
    } catch (e) {
      setMensaje('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const toggleAccesos = async () => {
    const abrir = !verAccesos;
    setVerAccesos(abrir);
    if (abrir) {
      try { setAccesos(await api.getAccesosPregrabadas()); } catch (e) { console.error(e); }
    }
  };

  if (!cfg) return null;

  return (
    <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <p className="font-bold text-sm text-amber-900 mb-1 flex items-center gap-1"><Key size={14} /> Código de acceso a pregrabadas</p>
      <p className="text-xs text-amber-800 mb-3">
        Dilo en voz alta al final de cada capacitación en vivo, para que solo lo tengan quienes asistieron.
        Al cambiarlo, los accesos anteriores se cancelan y tienen que meter el nuevo.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] font-bold text-amber-900 mb-1">Código vigente</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Sin código = acceso desactivado"
            autoComplete="off"
            className="px-3 py-2 border border-amber-300 rounded-lg text-sm font-mono w-56"
          />
        </div>
        <button onClick={generar} className="px-3 py-2 bg-white border border-amber-300 text-amber-800 rounded-lg text-sm font-bold flex items-center gap-1">
          <RefreshCw size={14} /> Generar
        </button>
        <div>
          <label className="block text-[11px] font-bold text-amber-900 mb-1">Duración del acceso (horas)</label>
          <input
            type="number"
            min="1"
            max="720"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            className="px-3 py-2 border border-amber-300 rounded-lg text-sm w-28"
          />
        </div>
        <button
          onClick={guardar}
          disabled={guardando || codigo.trim().length < 4}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
      {mensaje && <p className="text-xs text-amber-900 mt-2 font-medium">{mensaje}</p>}

      <button onClick={toggleAccesos} className="mt-3 text-xs font-bold text-amber-800 underline">
        {verAccesos ? 'Ocultar intentos recientes' : 'Ver intentos recientes (quién entró y quién falló)'}
      </button>
      {verAccesos && (
        <div className="mt-2 bg-white border border-amber-200 rounded-lg max-h-56 overflow-y-auto">
          {accesos.length === 0 ? (
            <p className="text-xs text-slate-400 p-3">Todavía no hay intentos.</p>
          ) : accesos.map((a, i) => (
            <div key={a._id || i} className="flex justify-between items-center text-xs px-3 py-1.5 border-b border-slate-100">
              <span className="font-medium text-slate-700">{a.usuarioNombre || a.usuarioUsername}</span>
              <span className="flex items-center gap-3">
                <span className={a.exito ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>{a.exito ? 'Entró' : 'Falló'}</span>
                <span className="text-slate-400">{new Date(a.createdAt).toLocaleString('es-MX')}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Pestañas: General (para todos) y Crecimiento (solo venta directa y redes sociales, más dirección/Mesa/Marketing)
export default function CapacitacionesModule() {
  const [acceso, setAcceso] = useState(null);
  const [tab, setTab] = useState('general');

  useEffect(() => {
    api.getAccesoCrecimiento().then(setAcceso).catch(() => setAcceso({ permitido: false }));
  }, []);

  const conCrecimiento = !!acceso?.permitido;

  return (
    <div>
      {conCrecimiento && (
        <div className="max-w-6xl mx-auto flex gap-2 mb-4 border-b border-slate-200">
          <button onClick={() => setTab('general')} className={`px-4 py-2 text-sm font-bold border-b-2 ${tab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
            General
          </button>
          <button onClick={() => setTab('crecimiento')} className={`px-4 py-2 text-sm font-bold border-b-2 ${tab === 'crecimiento' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500'}`}>
            Crecimiento (venta directa y redes)
          </button>
        </div>
      )}
      {(!conCrecimiento || tab === 'general') && <CapacitacionesGeneral />}
      {conCrecimiento && tab === 'crecimiento' && <CrecimientoTab esStaff={!!acceso.esStaff} />}
    </div>
  );
}
