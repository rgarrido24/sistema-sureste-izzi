import { useState, useEffect } from 'react';
import {
  Rocket, Lock, CheckCircle2, Circle, Loader2, AlertTriangle, ExternalLink,
  ChevronDown, ChevronUp, UserPlus, Copy, RefreshCw, Users,
} from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

const STAFF_EDIT = ['admin', 'admin_general', 'director', 'mesa_control'];
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString('es-MX') : '');

export default function ArranqueModule() {
  const { user } = useAuth();
  if (user?.role === 'redes_sociales') return <MiArranque />;
  return <Tablero role={user?.role} />;
}

// ============================ VISTA DEL RECLUTADO ============================

function MiArranque() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [valores, setValores] = useState({});
  const [enviando, setEnviando] = useState('');
  const [errores, setErrores] = useState({});
  const [mensajeAyuda, setMensajeAyuda] = useState('');
  const [enviandoAyuda, setEnviandoAyuda] = useState(false);

  useEffect(() => {
    api.getMiArranque()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const completar = async (paso) => {
    setEnviando(paso.clave);
    setErrores((prev) => ({ ...prev, [paso.clave]: '' }));
    try {
      const evidencias = paso.tipo === 'evidencia'
        ? (valores[paso.clave] || '').split(/\s+/).filter(Boolean)
        : [];
      setData(await api.completarPasoArranque(paso.clave, evidencias));
    } catch (e) {
      setErrores((prev) => ({ ...prev, [paso.clave]: e.message }));
    } finally {
      setEnviando('');
    }
  };

  const pedirAyuda = async () => {
    setEnviandoAyuda(true);
    try {
      setData(await api.pedirAyudaArranque(mensajeAyuda));
      setMensajeAyuda('');
    } catch (e) {
      alert(e.message);
    } finally {
      setEnviandoAyuda(false);
    }
  };

  const cancelarAyuda = async () => {
    try {
      setData(await api.cancelarAyudaArranque());
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-center text-red-600 py-8">{error}</p>;
  if (!data) return null;

  const { pasos, progreso, dia, diasMeta, grupo, atorado, liberado } = data;
  const porcentaje = Math.round((progreso.completados / progreso.total) * 100);
  const primeraPendiente = pasos.find((p) => !p.completado && !p.bloqueado);
  const terminado = progreso.completados >= progreso.total;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="text-blue-600" size={22} />
          <h2 className="text-lg font-bold text-slate-800">Mi arranque</h2>
        </div>
        <p className="text-sm text-slate-500 mb-3">
          Día {dia} de {diasMeta} · {progreso.completados} de {progreso.total} pasos completados
        </p>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${porcentaje}%` }} />
        </div>
        {terminado && <p className="text-sm font-bold text-green-700 mt-3">¡Completaste todo tu arranque! 🎉</p>}
        {!terminado && dia > diasMeta && (
          <p className="text-xs text-amber-700 mt-3">
            Ya pasó tu primera semana. Si algo te está costando trabajo, pide ayuda abajo y Mesa de Control te apoya.
          </p>
        )}
        {liberado && (
          <p className="text-xs text-slate-600 mt-3">
            Mesa de Control pausó tu seguimiento. Si quieres retomarlo, avisa a tu reclutador o a Marketing.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {pasos.map((paso, i) => {
          const esActual = primeraPendiente?.clave === paso.clave;
          const borde = paso.completado
            ? 'border-green-300 bg-green-50'
            : paso.bloqueado
              ? 'border-slate-200 bg-slate-50 opacity-70'
              : esActual
                ? 'border-blue-400 bg-white ring-2 ring-blue-100'
                : 'border-slate-200 bg-white';
          return (
            <div key={paso.clave} className={`p-4 rounded-xl border ${borde}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {paso.completado
                    ? <CheckCircle2 size={22} className="text-green-600" />
                    : paso.bloqueado
                      ? <Lock size={20} className="text-slate-400" />
                      : <Circle size={22} className="text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">{i + 1}. {paso.titulo}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{paso.descripcion}</p>

                  {paso.completado && (
                    <p className="text-xs text-green-700 mt-2">
                      Completado {fmtFecha(paso.completadoEn)}{paso.completadoPor === 'staff' ? ' · confirmado por Mesa de Control' : ''}
                    </p>
                  )}

                  {!paso.completado && paso.bloqueado && (
                    <p className="text-xs text-slate-500 mt-2">Primero completa: {paso.faltan.join(', ')}.</p>
                  )}

                  {!paso.completado && !paso.bloqueado && paso.tipo === 'staff' && (
                    <p className="text-xs text-amber-700 mt-2 font-medium">Pendiente de confirmación de Mesa de Control.</p>
                  )}

                  {!paso.completado && !paso.bloqueado && paso.tipo === 'evidencia' && (
                    <div className="mt-3">
                      <textarea
                        rows={paso.minEvidencias > 1 ? 4 : 2}
                        value={valores[paso.clave] || ''}
                        onChange={(e) => setValores((prev) => ({ ...prev, [paso.clave]: e.target.value }))}
                        placeholder={paso.placeholder}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      {errores[paso.clave] && <p className="text-xs text-red-600 mt-1">{errores[paso.clave]}</p>}
                      <button
                        onClick={() => completar(paso)}
                        disabled={enviando === paso.clave || !(valores[paso.clave] || '').trim()}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2"
                      >
                        {enviando === paso.clave && <Loader2 size={14} className="animate-spin" />}
                        Marcar como hecho
                      </button>
                    </div>
                  )}

                  {!paso.completado && !paso.bloqueado && paso.tipo === 'simple' && (
                    <div className="mt-3">
                      {errores[paso.clave] && <p className="text-xs text-red-600 mb-1">{errores[paso.clave]}</p>}
                      <button
                        onClick={() => completar(paso)}
                        disabled={enviando === paso.clave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2"
                      >
                        {enviando === paso.clave && <Loader2 size={14} className="animate-spin" />}
                        Ya me uní al grupo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grupo de Mesa de Control: el link solo existe aquí cuando se desbloquea */}
      {grupo.desbloqueado ? (
        <div className="bg-green-50 border border-green-300 rounded-2xl p-5">
          <p className="font-bold text-green-800 mb-1">¡Desbloqueaste el grupo de Mesa de Control!</p>
          {grupo.responsable && <p className="text-sm text-green-700 mb-3">Te va a dar seguimiento: {grupo.responsable}</p>}
          {grupo.link ? (
            <a
              href={grupo.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg font-bold"
            >
              <ExternalLink size={16} /> Unirme al grupo
            </a>
          ) : (
            <p className="text-sm text-green-700">Estamos preparando el grupo. Mesa de Control te avisa en cuanto esté listo.</p>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <p className="font-bold text-slate-700 flex items-center gap-2 mb-1"><Lock size={16} /> Grupo de Mesa de Control</p>
          <p className="text-sm text-slate-500">
            Se desbloquea cuando completes: {grupo.faltan.join(', ')}.
          </p>
        </div>
      )}

      {/* Estoy atorado */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        {atorado.activo ? (
          <>
            <p className="font-bold text-amber-700 flex items-center gap-2"><AlertTriangle size={16} /> Ya avisamos a Mesa de Control</p>
            <p className="text-sm text-slate-500 mt-1">
              {atorado.mensaje ? `Tu mensaje: "${atorado.mensaje}". ` : ''}Te van a contactar para ayudarte.
            </p>
            <button onClick={cancelarAyuda} className="mt-3 text-xs text-slate-500 underline">Ya lo resolví, cancelar aviso</button>
          </>
        ) : (
          <>
            <p className="font-bold text-slate-700 mb-1">¿Te atoraste en algún paso?</p>
            <p className="text-xs text-slate-500 mb-2">Avísale a Mesa de Control y te ayudan. También puedes preguntarle al Asistente IA.</p>
            <textarea
              rows={2}
              value={mensajeAyuda}
              onChange={(e) => setMensajeAyuda(e.target.value)}
              placeholder="Cuéntanos en qué paso estás atorado (opcional)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={pedirAyuda}
              disabled={enviandoAyuda}
              className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2"
            >
              {enviandoAyuda && <Loader2 size={14} className="animate-spin" />}
              Estoy atorado
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================ TABLERO (STAFF + MARKETING) ============================

function Tablero({ role }) {
  const canEdit = STAFF_EDIT.includes(role);
  const canAlta = canEdit || role === 'marketing';
  const esReclutador = role === 'reclutador'; // solo ve a SUS reclutados (lo filtra el servidor)

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('activos');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [reclutadores, setReclutadores] = useState([]);

  const cargar = async () => {
    try {
      setData(await api.getTableroArranque());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    if (canAlta) api.getReclutadoresArranque().then(setReclutadores).catch(() => {});
  }, []);

  const accion = async (fn, ...args) => {
    try {
      await fn(...args);
      await cargar();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-center text-red-600 py-8">{error}</p>;

  const items = data?.items || [];
  const terminado = (i) => i.completados >= i.total;
  const estancado = (i) => !i.liberado && !terminado(i) && i.diasSinAvance >= 3;

  const cuentas = {
    activos: items.filter((i) => !i.liberado).length,
    atorados: items.filter((i) => !i.liberado && i.atorado.activo).length,
    estancados: items.filter(estancado).length,
    vencidos: items.filter((i) => i.vencido).length,
    liberados: items.filter((i) => i.liberado).length,
  };

  const filtrados = items
    .filter((i) => {
      const texto = `${i.usuarioNombre} ${i.usuarioUsername} ${i.reclutadorNombre}`.toLowerCase();
      if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
      switch (filtro) {
        case 'activos': return !i.liberado;
        case 'atorados': return !i.liberado && i.atorado.activo;
        case 'estancados': return estancado(i);
        case 'vencidos': return i.vencido;
        case 'liberados': return i.liberado;
        default: return true;
      }
    })
    .sort((a, b) => (Number(b.atorado.activo) - Number(a.atorado.activo)) || (b.diasSinAvance - a.diasSinAvance));

  const chips = [
    { k: 'activos', label: 'Activos' },
    { k: 'atorados', label: 'Atorados' },
    { k: 'estancados', label: '3+ días sin avance' },
    { k: 'vencidos', label: 'Plazo vencido' },
    { k: 'liberados', label: 'Liberados' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Users className="text-blue-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">{esReclutador ? 'Cómo van mis reclutados' : 'Seguimiento de Redes Sociales'}</h2>
      </div>

      {esReclutador && (
        <p className="text-sm text-slate-500 -mt-2">
          Las personas que reclutaste y en qué paso van. Mesa de Control les da seguimiento.
        </p>
      )}
      {canAlta && <AltaReclutado onCreated={cargar} reclutadores={reclutadores} />}
      {canEdit && <ConfigArranque />}

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.k}
            onClick={() => setFiltro(c.k)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              filtro === c.k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
            }`}
          >
            {c.label} ({cuentas[c.k]})
          </button>
        ))}
        <button
          onClick={() => setFiltro('todos')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
            filtro === 'todos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
          }`}
        >
          Todos ({items.length})
        </button>
      </div>

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, usuario o reclutador…"
        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm"
      />

      <div className="space-y-3">
        {filtrados.map((i) => {
          const expandido = abierto === i.id;
          return (
            <div key={i.id} className={`bg-white border rounded-xl ${i.atorado.activo && !i.liberado ? 'border-red-300' : 'border-slate-200'}`}>
              <button onClick={() => setAbierto(expandido ? null : i.id)} className="w-full text-left p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{i.usuarioNombre}</p>
                    <p className="text-xs text-slate-500">
                      @{i.usuarioUsername}{i.reclutadorNombre ? ` · Reclutó: ${i.reclutadorNombre}` : ' · Sin reclutador registrado'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end shrink-0">
                    {i.atorado.activo && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">ATORADO</span>}
                    {i.vencido && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700">PLAZO VENCIDO</span>}
                    {i.liberado && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-600">LIBERADO</span>}
                    {terminado(i) && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700">COMPLETO</span>}
                    {expandido ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Día {i.dia} · {i.completados}/{i.total} pasos
                  {i.etapaActual ? ` · Falta: ${i.etapaActual.titulo}` : ''}
                  {' · '}
                  <span className={i.diasSinAvance >= 3 && !terminado(i) ? 'text-red-600 font-bold' : ''}>
                    {i.diasSinAvance} día(s) sin avance
                  </span>
                </p>
                {i.atorado.activo && i.atorado.mensaje && (
                  <p className="text-xs text-red-700 mt-1">"{i.atorado.mensaje}"</p>
                )}
              </button>

              {expandido && (
                <div className="border-t border-slate-100 p-4 space-y-3">
                  {i.pasos.map((p) => (
                    <div key={p.clave} className="text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          {p.completado
                            ? <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
                            : <Circle size={16} className="text-slate-300 mt-0.5 shrink-0" />}
                          <div className="min-w-0">
                            <p className={p.completado ? 'text-slate-700' : 'text-slate-500'}>{p.titulo}</p>
                            {p.completado && (
                              <p className="text-[11px] text-slate-400">
                                {fmtFecha(p.completadoEn)} · {p.completadoPor === 'staff' ? `confirmado por ${p.completadoPorNombre || 'staff'}` : 'lo marcó el usuario'}
                              </p>
                            )}
                            {p.evidencias.map((url) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline truncate">
                                {url}
                              </a>
                            ))}
                            {p.nota && <p className="text-[11px] text-slate-400 italic">{p.nota}</p>}
                          </div>
                        </div>
                        {canEdit && (
                          <div className="shrink-0">
                            {p.completado ? (
                              <button
                                onClick={() => {
                                  const motivo = window.prompt('Motivo para reabrir este paso (opcional):');
                                  if (motivo === null) return;
                                  accion(api.reabrirPasoArranque, i.id, p.clave, motivo);
                                }}
                                className="text-xs text-amber-700 font-bold"
                              >
                                Reabrir
                              </button>
                            ) : (
                              <button onClick={() => accion(api.confirmarPasoArranque, i.id, p.clave)} className="text-xs text-green-700 font-bold">
                                Confirmar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
                    {canAlta && <ReclutadorEditor item={i} reclutadores={reclutadores} onSave={(datos) => accion(api.actualizarArranque, i.id, datos)} />}
                    {canEdit && i.atorado.activo && (
                      <button onClick={() => accion(api.actualizarArranque, i.id, { atoradoResuelto: true })} className="text-xs font-bold text-green-700">
                        Marcar atorado como resuelto
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => {
                          if (!i.liberado && !confirm('¿Liberar a este reclutado? Sale de la lista de activos (su cuenta sigue funcionando).')) return;
                          accion(api.actualizarArranque, i.id, { liberado: !i.liberado });
                        }}
                        className="text-xs font-bold text-slate-600"
                      >
                        {i.liberado ? 'Reactivar seguimiento' : 'Liberar'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <p className="text-center text-slate-400 py-10">
            {esReclutador && items.length === 0
              ? 'Todavía no tienes reclutados vinculados a tu usuario. Marketing los vincula contigo al darlos de alta.'
              : 'No hay reclutados en esta vista.'}
          </p>
        )}
      </div>
    </div>
  );
}

function ReclutadorEditor({ item, reclutadores = [], onSave }) {
  const [sel, setSel] = useState(item.reclutadorId || '');
  const [otro, setOtro] = useState(item.reclutadorId ? '' : (item.reclutadorNombre || ''));
  const cambio = sel !== (item.reclutadorId || '') || (!sel && otro.trim() !== (item.reclutadorNombre || ''));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={sel} onChange={(e) => setSel(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs">
        <option value="">Reclutador sin usuario en el sistema</option>
        {reclutadores.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
      </select>
      {!sel && (
        <input
          type="text"
          value={otro}
          onChange={(e) => setOtro(e.target.value)}
          placeholder="Nombre del reclutador"
          className="px-2 py-1 border border-slate-300 rounded text-xs w-40"
        />
      )}
      {cambio && (
        <button onClick={() => onSave({ reclutadorId: sel, reclutadorNombre: otro.trim() })} className="text-xs font-bold text-blue-600">
          Guardar
        </button>
      )}
    </div>
  );
}

// Alta de un reclutado (Marketing recibe los datos de reclutamiento y crea el usuario)
function AltaReclutado({ onCreated, reclutadores = [] }) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', username: '', password: '', email: '', reclutadorNombre: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState(null);
  const [reclutadorSel, setReclutadorSel] = useState('');

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const generarPassword = () => {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint32Array(8);
    crypto.getRandomValues(bytes);
    setForm((f) => ({ ...f, password: Array.from(bytes).map((b) => alfabeto[b % alfabeto.length]).join('') }));
  };

  const crear = async () => {
    setGuardando(true);
    setError('');
    try {
      await api.altaReclutado({ ...form, reclutadorId: reclutadorSel });
      setCreado({ nombre: form.nombre.trim(), username: form.username.trim().toLowerCase(), password: form.password });
      setForm({ nombre: '', username: '', password: '', email: '', reclutadorNombre: '' });
      setReclutadorSel('');
      onCreated();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const mensaje = creado
    ? `Hola ${creado.nombre.split(' ')[0]}, ya tienes tu acceso al sistema:\n${window.location.origin}\nUsuario: ${creado.username}\nContraseña: ${creado.password}\nAl entrar verás "Mi Arranque" con tus primeros pasos.`
    : '';

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <button onClick={() => setAbierto(!abierto)} className="w-full flex items-center justify-between p-4 text-left">
        <span className="font-bold text-slate-700 flex items-center gap-2"><UserPlus size={16} /> Dar de alta a un reclutado</span>
        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-3">
          {creado && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-bold text-green-800 mb-1">Usuario creado. Mándale estos datos:</p>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-white border border-green-100 rounded p-2">{mensaje}</pre>
              <button
                onClick={() => navigator.clipboard?.writeText(mensaje)}
                className="mt-2 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-bold flex items-center gap-1"
              >
                <Copy size={12} /> Copiar mensaje
              </button>
              <p className="text-[11px] text-green-700 mt-1">Esta contraseña no se vuelve a mostrar.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={form.nombre} onChange={set('nombre')} placeholder="Nombre completo" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <div className="flex flex-col gap-2">
              <select value={reclutadorSel} onChange={(e) => setReclutadorSel(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Reclutado por… (reclutador sin usuario: escribir nombre)</option>
                {reclutadores.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              {!reclutadorSel && (
                <input value={form.reclutadorNombre} onChange={set('reclutadorNombre')} placeholder="Nombre del reclutador" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              )}
            </div>
            <input value={form.username} onChange={set('username')} placeholder="Usuario (sin espacios)" autoComplete="off" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <div className="flex gap-2">
              <input value={form.password} onChange={set('password')} placeholder="Contraseña (mín. 6)" autoComplete="off" className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-0 font-mono" />
              <button onClick={generarPassword} type="button" className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1">
                <RefreshCw size={12} /> Generar
              </button>
            </div>
            <input value={form.email} onChange={set('email')} placeholder="Correo (opcional)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-2" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={crear}
            disabled={guardando}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2"
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            Crear usuario
          </button>
          <p className="text-[11px] text-slate-400">El usuario se crea siempre con rol Redes Sociales.</p>
        </div>
      )}
    </div>
  );
}

// Configuración del grupo de Mesa de Control (solo Mesa de Control y dirección)
function ConfigArranque() {
  const [abierto, setAbierto] = useState(false);
  const [cfg, setCfg] = useState({ grupoLink: '', responsableNombre: '', diasMeta: 7 });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    api.getConfigArranque().then(setCfg).catch(() => {});
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setMensaje('');
    try {
      setCfg(await api.guardarConfigArranque(cfg));
      setMensaje('Guardado.');
    } catch (e) {
      setMensaje('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <button onClick={() => setAbierto(!abierto)} className="w-full flex items-center justify-between p-4 text-left">
        <span className="font-bold text-slate-700">Configuración del grupo y plazo</span>
        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {abierto && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Liga del grupo de WhatsApp de Mesa de Control</label>
            <input
              value={cfg.grupoLink}
              onChange={(e) => setCfg({ ...cfg, grupoLink: e.target.value })}
              placeholder="https://chat.whatsapp.com/..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <p className="text-[11px] text-slate-400 mt-1">Solo se muestra a cada reclutado cuando completa sus primeros pasos.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-bold text-slate-600 mb-1">Responsable de dar seguimiento</label>
              <input
                value={cfg.responsableNombre}
                onChange={(e) => setCfg({ ...cfg, responsableNombre: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Plazo para el primer lead (días)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={cfg.diasMeta}
                onChange={(e) => setCfg({ ...cfg, diasMeta: e.target.value })}
                className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <button onClick={guardar} disabled={guardando} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          {mensaje && <p className="text-xs text-slate-600">{mensaje}</p>}
        </div>
      )}
    </div>
  );
}
