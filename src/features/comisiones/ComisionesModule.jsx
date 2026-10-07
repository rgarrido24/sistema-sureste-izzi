import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  DollarSign, Plus, Trash2, Loader2, Upload, RefreshCw, Pencil, Check, X,
  ChevronDown, ChevronUp, AlertTriangle, Download,
} from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

const dinero = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtFecha = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
};
const TIPO_LABEL = { directa: 'Venta directa', distribuidor: 'Distribuidor' };
const TIPO_CLASE = { directa: 'bg-blue-100 text-blue-700', distribuidor: 'bg-purple-100 text-purple-700' };

export default function ComisionesModule() {
  const { user } = useAuth();
  const canEdit = ['admin', 'admin_general', 'director'].includes(user?.role);
  const [tab, setTab] = useState('perdidas');

  const tabs = [
    { k: 'perdidas', label: 'Pérdidas por vendedor' },
    { k: 'vendedores', label: 'Base de vendedores' },
    { k: 'paquetes', label: 'Paquetes (comisión base)' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign className="text-green-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Comisiones y factores</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        El factor y la comisión base nunca los ve el vendedor/sub. Aquí se ve cuánto se pierde por cada cuenta perdida con el factor real de cada quien.
      </p>

      <div className="flex gap-2 mb-4 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap ${tab === t.k ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'perdidas' && <PerdidasTab canEdit={canEdit} irAVendedores={() => setTab('vendedores')} />}
      {tab === 'vendedores' && <VendedoresTab canEdit={canEdit} />}
      {tab === 'paquetes' && <PaquetesTab canEdit={canEdit} />}
    </div>
  );
}

// ============================ PÉRDIDAS POR VENDEDOR ============================

function PerdidasTab({ canEdit, irAVendedores }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [detalles, setDetalles] = useState({});
  const [catalogo, setCatalogo] = useState([]);
  const [eleccion, setEleccion] = useState({});
  const [asignando, setAsignando] = useState('');

  const cargar = async () => {
    setLoading(true);
    try {
      setData(await api.getPerdidasComisiones());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    if (canEdit) api.getComisionPaquetes().then(setCatalogo).catch(() => {});
  }, []);

  const abrir = async (v) => {
    const clave = v.vendedor;
    if (abierto === clave) { setAbierto(null); return; }
    setAbierto(clave);
    if (!detalles[clave]) {
      setDetalles((d) => ({ ...d, [clave]: { cargando: true } }));
      try {
        const r = await api.getDetallePerdidasComision(clave);
        setDetalles((d) => ({ ...d, [clave]: { cuentas: r.cuentas } }));
      } catch (e) {
        setDetalles((d) => ({ ...d, [clave]: { error: e.message } }));
      }
    }
  };

  const asignar = async (nombre) => {
    if (!eleccion[nombre]) return;
    setAsignando(nombre);
    try {
      await api.asignarAliasPaquete(nombre, eleccion[nombre]);
      setDetalles({});
      setAbierto(null);
      await cargar();
    } catch (e) {
      alert(e.message);
    } finally {
      setAsignando('');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-center text-red-600 py-8">{error}</p>;
  if (!data) return null;

  const { resumen, vendedores, paquetesSinBase } = data;
  const filtrados = vendedores.filter((v) => {
    if (busqueda && !v.vendedor.toLowerCase().includes(busqueda.toLowerCase())) return false;
    if (tipo === 'sin') return v.sinFactor;
    if (tipo) return v.tipo === tipo;
    return true;
  });

  const kpis = [
    { label: 'Comisión en cuentas perdidas', valor: dinero(resumen.comisionPerdida), sub: `${resumen.cuentasPerdidas} cuentas perdidas`, clase: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Retención perdida (distribuidores)', valor: dinero(resumen.retencionPerdida), sub: '10% de esa comisión', clase: 'bg-purple-50 border-purple-200 text-purple-700' },
    { label: 'Comisión en M1 pendientes', valor: dinero(resumen.comisionPendiente), sub: `${resumen.cuentasPendientes} cuentas por resolver`, clase: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Retención en riesgo', valor: dinero(resumen.retencionPendiente), sub: 'si no se resuelven', clase: 'bg-slate-50 border-slate-200 text-slate-700' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <b>Comisión</b> = base del paquete × factor del vendedor (en venta directa y redes el factor se calcula solo por sus ventas del mes y su capacitación). <b>Retención</b> = 10% de esa comisión, solo a distribuidores (venta directa no lleva retención).
        Se calcula sobre la cobranza M1: "perdidas" son las cuentas en FPD Pérdida y "pendientes" las que siguen en M1.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`p-3 rounded-xl border ${k.clase}`}>
            <p className="text-[11px] font-bold leading-tight">{k.label}</p>
            <p className="text-xl font-extrabold mt-1">{k.valor}</p>
            <p className="text-[11px] opacity-80">{k.sub}</p>
          </div>
        ))}
      </div>

      {(resumen.cuentasSinBase > 0 || resumen.vendedoresSinFactor > 0) && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-900 space-y-1">
          <p className="font-bold flex items-center gap-2"><AlertTriangle size={16} /> Hay datos incompletos: estos importes son un mínimo, no el total</p>
          {resumen.vendedoresSinFactor > 0 && (
            <p>Los vendedores sin factor se muestran con un <b>estimado (~)</b> usando ×{resumen.factorReferencia}: aprox. <b>{dinero(resumen.estimadoPerdida)}</b> en perdidas y <b>{dinero(resumen.estimadoPendiente)}</b> en M1 pendientes, aparte de los totales de arriba. Define su factor en "Base de vendedores" para verlo real.</p>
          )}
          {resumen.vendedoresSinFactor > 0 && (
            <p>
              {resumen.vendedoresSinFactor} de {resumen.totalVendedores} vendedores no tienen factor, así que no se calcula su comisión.{' '}
              <button onClick={irAVendedores} className="underline font-bold">Definir factores</button>
            </p>
          )}
          {resumen.cuentasSinBase > 0 && (
            <p>
              {resumen.cuentasSinBase} de {resumen.cuentasEvaluadas} cuentas ({(100 - resumen.cobertura).toFixed(1)}%) no tienen comisión base porque su paquete no está en el catálogo
              {canEdit ? ' (puedes asignarlos abajo).' : '.'}
            </p>
          )}
          {resumen.cuentasSinVendedor > 0 && <p>{resumen.cuentasSinVendedor} cuentas no traen vendedor y no se atribuyen a nadie.</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar vendedor…"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[180px]"
        />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="">Todos</option>
          <option value="distribuidor">Distribuidores</option>
          <option value="directa">Venta directa</option>
          <option value="sin">Sin factor</option>
        </select>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Vendedor</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-right px-3 py-2">Perdidas</th>
              <th className="text-right px-3 py-2">Comisión perdida</th>
              <th className="text-right px-3 py-2">Retención perdida</th>
              <th className="text-right px-3 py-2">M1 pend.</th>
              <th className="text-right px-3 py-2">Comisión en riesgo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((v) => {
              const det = detalles[v.vendedor];
              return (
                <FilaPerdida key={v.vendedor} v={v} abierto={abierto === v.vendedor} det={det} onToggle={() => abrir(v)} />
              );
            })}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="text-center text-slate-400 py-8">Sin resultados.</p>}
      </div>

      {paquetesSinBase.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="font-bold text-slate-700 mb-1">Paquetes sin comisión base</p>
          <p className="text-xs text-slate-500 mb-3">
            Así vienen en la cobranza y no coinciden con ningún paquete del catálogo.
            {canEdit ? ' Asigna cada uno a su paquete y se cuenta desde ya.' : ' Un admin o director puede asignarlos.'}
          </p>
          <div className="space-y-2">
            {paquetesSinBase.slice(0, 15).map((p) => (
              <div key={p.nombre} className="flex flex-wrap items-center gap-2 border border-slate-100 rounded-lg p-2 text-sm">
                <span className="font-bold text-slate-700 min-w-[44px]">{p.cuentas}×</span>
                <span className="flex-1 min-w-[180px] text-slate-600 break-words">{p.nombre} <span className="text-xs text-slate-400">({p.play || 's/play'})</span></span>
                {canEdit && (
                  <>
                    <select
                      value={eleccion[p.nombre] || ''}
                      onChange={(e) => setEleccion((x) => ({ ...x, [p.nombre]: e.target.value }))}
                      className="px-2 py-1 border border-slate-300 rounded text-xs max-w-[260px]"
                    >
                      <option value="">Asignar a…</option>
                      {catalogo.map((c) => (
                        <option key={c._id} value={c._id}>{(c.clave ? c.clave + ' · ' : '') + c.paquete + ' (' + dinero(c.comisionBase) + ')'}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => asignar(p.nombre)}
                      disabled={!eleccion[p.nombre] || asignando === p.nombre}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold disabled:bg-slate-300 flex items-center gap-1"
                    >
                      {asignando === p.nombre && <Loader2 size={12} className="animate-spin" />} Asignar
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Importe estimado (sin factor definido): se marca con ~ y en cursiva para no confundirlo con el real
function Est({ monto }) {
  return monto > 0
    ? <span className="italic font-semibold text-amber-600" title="Estimado con factor 1.5: define su factor en Base de vendedores">~{dinero(monto)}</span>
    : <span>—</span>;
}

function FilaPerdida({ v, abierto, det, onToggle }) {
  const sin = v.sinFactor;
  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-2 font-medium text-slate-800">{v.vendedor}</td>
        <td className="px-3 py-2">
          {v.tipo
            ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIPO_CLASE[v.tipo]}`}>{TIPO_LABEL[v.tipo]}</span>
            : <span className="text-xs text-slate-400">Sin tipo</span>}
          {v.factor && <span className="ml-1 text-[11px] text-slate-500">×{v.factor}{v.factorAuto ? ' auto' : ''}</span>}
          {sin && <span className="ml-1 text-[11px] font-bold text-amber-700">· sin factor</span>}
        </td>
        <td className="px-3 py-2 text-right font-bold">{v.perdidas}</td>
        <td className="px-3 py-2 text-right font-bold text-red-700">{sin ? <Est monto={v.estimadoPerdida} /> : dinero(v.comisionPerdida)}</td>
        <td className="px-3 py-2 text-right text-purple-700">{sin ? '—' : v.tipo === 'distribuidor' ? dinero(v.retencionPerdida) : '—'}</td>
        <td className="px-3 py-2 text-right">{v.pendientes}</td>
        <td className="px-3 py-2 text-right text-amber-700">{sin ? <Est monto={v.estimadoPendiente} /> : dinero(v.comisionPendiente)}</td>
        <td className="px-3 py-2 text-slate-400">{abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
      </tr>
      {abierto && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="px-3 py-3">
            {det?.cargando && <Loader2 className="animate-spin mx-auto" size={18} />}
            {det?.error && <p className="text-red-600 text-xs">{det.error}</p>}
            {det?.cuentas && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left py-1 pr-2">Cuenta</th>
                      <th className="text-left py-1 pr-2">Cliente</th>
                      <th className="text-left py-1 pr-2">Paquete (cobranza)</th>
                      <th className="text-left py-1 pr-2">Estatus</th>
                      <th className="text-right py-1 pr-2">Base</th>
                      <th className="text-right py-1 pr-2">Comisión</th>
                      <th className="text-right py-1">Retención</th>
                    </tr>
                  </thead>
                  <tbody>
                    {det.cuentas.map((c, i) => (
                      <tr key={c.cuenta + i} className="border-t border-slate-200">
                        <td className="py-1 pr-2 font-mono">{c.cuenta}</td>
                        <td className="py-1 pr-2">{c.cliente}</td>
                        <td className="py-1 pr-2 text-slate-600">
                          {c.paquete} <span className="text-slate-400">({c.play || '—'})</span>
                          {c.paqueteCatalogo && <span className="block text-[10px] text-slate-400">→ {c.paqueteCatalogo}</span>}
                        </td>
                        <td className="py-1 pr-2">
                          <span className={`font-bold ${c.estatus === 'PERDIDA' ? 'text-red-700' : 'text-amber-700'}`}>{c.estatus === 'PERDIDA' ? 'Perdida' : 'M1'}</span>
                        </td>
                        <td className="py-1 pr-2 text-right">{c.base === null ? <span className="text-amber-700 font-bold">sin base</span> : dinero(c.base)}</td>
                        <td className="py-1 pr-2 text-right font-bold">{c.comision === null ? '—' : dinero(c.comision)}</td>
                        <td className="py-1 text-right">{c.retencion === null || !(c.retencion > 0) ? '—' : dinero(c.retencion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {det.cuentas.length === 0 && <p className="text-slate-400 py-2">Sin cuentas.</p>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ============================ BASE DE VENDEDORES ============================

const FORM_VACIO = { vendedor: '', tipo: '', factor: '', telefono: '', email: '', fechaNacimiento: '' };

// Lee un Excel/CSV y devuelve filas con los encabezados del archivo (+ número de fila)
async function leerFilasVendedores(file) {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const esCsv = /\.csv$/i.test(file.name);
  const wb = esCsv
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });

  for (const hoja of wb.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: true, defval: '' });
    const idx = filas.findIndex((f, i) => i < 15 && f.some((c) => ['NOMBRE', 'VENDEDOR', 'NOMBRE DEL VENDEDOR', 'NOMBRE COMPLETO'].includes(norm(c))));
    if (idx === -1) continue;
    const headers = filas[idx].map((h) => String(h ?? '').trim());
    return filas
      .slice(idx + 1)
      .map((f, i) => {
        const o = { __fila: idx + 2 + i };
        headers.forEach((h, j) => { if (h) o[h] = f[j]; });
        return o;
      })
      .filter((o) => Object.entries(o).some(([k, v]) => k !== '__fila' && String(v ?? '').trim() !== ''));
  }
  return null;
}

function VendedoresTab({ canEdit }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloSinFactor, setSoloSinFactor] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [abiertoNuevo, setAbiertoNuevo] = useState(false);
  const [nuevo, setNuevo] = useState(FORM_VACIO);
  const [resultado, setResultado] = useState(null);
  const [procesando, setProcesando] = useState('');
  const archivoRef = useRef(null);

  const cargar = () => {
    api.getVendedoresFactor().then(setLista).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const empezarEdicion = (v) => {
    setEditandoId(v._id);
    setForm({
      vendedor: v.vendedor || '',
      tipo: v.tipo || '',
      factor: v.factor ?? '',
      telefono: v.telefono || '',
      email: v.email || '',
      fechaNacimiento: v.fechaNacimiento || '',
    });
    setMensaje('');
  };

  const guardarEdicion = async () => {
    setGuardando(true);
    setMensaje('');
    try {
      await api.actualizarVendedorMaestro(editandoId, form);
      setEditandoId(null);
      cargar();
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const crear = async () => {
    setGuardando(true);
    setMensaje('');
    try {
      const r = await api.guardarVendedorMaestro(nuevo);
      setNuevo(FORM_VACIO);
      setMensaje(r.actualizados ? 'Ese vendedor ya existía: se actualizaron sus datos.' : 'Vendedor agregado.');
      cargar();
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (v) => {
    if (!confirm(`¿Quitar a ${v.vendedor} de la base? (Sus cuentas en la cobranza no se tocan.)`)) return;
    await api.eliminarVendedorFactor(v._id);
    cargar();
  };

  const cambiarCapacitacion = async (v, aprobada) => {
    try {
      await api.actualizarVendedorMaestro(v._id, { capacitacionAprobada: aprobada });
      cargar();
    } catch (e) {
      setMensaje(e.message);
    }
  };

  const sincronizar = async () => {
    setProcesando('sync');
    setResultado(null);
    try {
      const r = await api.sincronizarVendedoresMaestro();
      setResultado({ tipo: 'sync', ...r });
      cargar();
    } catch (e) {
      setResultado({ tipo: 'error', mensaje: e.message });
    } finally {
      setProcesando('');
    }
  };

  const subirArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcesando('subir');
    setResultado(null);
    try {
      const filas = await leerFilasVendedores(file);
      if (!filas) throw new Error('No encontré una columna "Nombre" (o "Vendedor") en las primeras filas del archivo.');
      if (filas.length === 0) throw new Error('El archivo no trae filas con datos.');
      const r = await api.bulkVendedoresMaestro(filas);
      setResultado({ tipo: 'archivo', ...r });
      cargar();
    } catch (err) {
      setResultado({ tipo: 'error', mensaje: err.message });
    } finally {
      setProcesando('');
    }
  };

  const descargarPlantilla = () => {
    const csv = '\ufeffNombre,Tipo,Factor,Telefono,Correo,Fecha de nacimiento\nJUAN PEREZ LOPEZ,Venta directa,1.8,9991234567,juan@correo.com,15/03/1990\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'plantilla_vendedores.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <LoadingSpinner />;

  const sinFactor = lista.filter((v) => !(Number(v.factorEfectivo ?? v.factor) > 0)).length;
  const filtrada = lista.filter((v) => {
    if (soloSinFactor && Number(v.factorEfectivo ?? v.factor) > 0) return false;
    return !busqueda || v.vendedor.toLowerCase().includes(busqueda.toLowerCase());
  });

  const campo = (clave, tipoInput = 'text', ancho = 'w-full') => (
    <input
      type={tipoInput}
      step={clave === 'factor' ? '0.1' : undefined}
      value={form[clave]}
      onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
      className={`${ancho} px-2 py-1 border border-slate-300 rounded text-xs`}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          <b>{lista.length}</b> vendedores · <b className={sinFactor ? 'text-amber-700' : ''}>{sinFactor}</b> sin factor definido
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button onClick={sincronizar} disabled={!!procesando} className="px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 disabled:bg-slate-400">
              {procesando === 'sync' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Traer vendedores (cobranza y redes)
            </button>
            <button onClick={() => archivoRef.current?.click()} disabled={!!procesando} className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 disabled:bg-slate-400">
              {procesando === 'subir' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Subir Excel/CSV
            </button>
            <button onClick={descargarPlantilla} className="px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1">
              <Download size={13} /> Plantilla
            </button>
            <input ref={archivoRef} type="file" accept=".xlsx,.xls,.xlsb,.csv" onChange={subirArchivo} className="hidden" />
          </div>
        )}
      </div>

      {canEdit && (
        <p className="text-[11px] text-slate-400">
          Al subir un archivo: si el nombre ya existe se <b>actualiza</b> (nunca se duplica), si no existe se <b>crea</b>, y una celda vacía no borra lo que ya está capturado.
          Columnas: Nombre, Tipo, Factor, Teléfono, Correo y Fecha de nacimiento (en texto, día/mes/año).
        </p>
      )}

      {resultado && (
        <div className={`rounded-lg p-3 text-sm border ${resultado.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {resultado.tipo === 'error' && <p>{resultado.mensaje}</p>}
          {resultado.tipo === 'sync' && (
            <p>
              Se agregaron <b>{resultado.creados}</b> vendedores nuevos ({resultado.yaExistian} de la cobranza ya estaban).
              {(resultado.redesAgregados + resultado.redesTipificados) > 0 && <> <b>{resultado.redesAgregados + resultado.redesTipificados}</b> personas de redes sociales quedaron registradas como venta directa.</>}
              {' '}Ahora define el factor de cada uno.
            </p>
          )}
          {resultado.tipo === 'archivo' && (
            <div className="space-y-1">
              <p>
                <b>{resultado.creados}</b> creados · <b>{resultado.actualizados}</b> actualizados · {resultado.sinCambios} sin cambios
                {resultado.omitidos > 0 && <> · <b className="text-red-700">{resultado.omitidos} omitidos</b></>}
                {resultado.tipoInferido > 0 && <> · {resultado.tipoInferido} con tipo deducido del factor</>}
              </p>
              {resultado.creadosSinCobranza?.length > 0 && (
                <p className="text-amber-800 text-xs">
                  Revisa la ortografía: estos nuevos no aparecen en la cobranza ({resultado.creadosSinCobranza.length}): {resultado.creadosSinCobranza.slice(0, 8).join(', ')}{resultado.creadosSinCobranza.length > 8 ? '…' : ''}
                </p>
              )}
              {resultado.errores?.length > 0 && (
                <ul className="text-xs text-red-700 list-disc ml-5">
                  {resultado.errores.slice(0, 8).map((x, i) => <li key={i}>Fila {x.fila}: {x.mensaje}</li>)}
                </ul>
              )}
              {resultado.advertencias?.length > 0 && (
                <ul className="text-xs text-amber-800 list-disc ml-5">
                  {resultado.advertencias.slice(0, 8).map((x, i) => <li key={i}>Fila {x.fila}: {x.mensaje}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {canEdit && (
        <div className="bg-white border border-slate-200 rounded-xl">
          <button onClick={() => setAbiertoNuevo(!abiertoNuevo)} className="w-full flex items-center justify-between p-3 text-left">
            <span className="font-bold text-sm text-slate-700 flex items-center gap-2"><Plus size={14} /> Agregar un vendedor</span>
            {abiertoNuevo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {abiertoNuevo && (
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                <input value={nuevo.vendedor} onChange={(e) => setNuevo({ ...nuevo, vendedor: e.target.value })} placeholder="Nombre (como sale en la cobranza)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm col-span-2 lg:col-span-1" />
                <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">Tipo (sin definir)</option>
                  <option value="directa">Venta directa</option>
                  <option value="distribuidor">Distribuidor</option>
                </select>
                <input type="number" step="0.1" value={nuevo.factor} onChange={(e) => setNuevo({ ...nuevo, factor: e.target.value })} placeholder="Factor" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} placeholder="Teléfono" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} placeholder="Correo" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="date" value={nuevo.fechaNacimiento} onChange={(e) => setNuevo({ ...nuevo, fechaNacimiento: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <button onClick={crear} disabled={guardando || !nuevo.vendedor.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:bg-slate-400 flex items-center gap-2">
                {guardando && <Loader2 size={14} className="animate-spin" />} Guardar
              </button>
            </div>
          )}
        </div>
      )}

      {mensaje && <p className="text-xs text-slate-600">{mensaje}</p>}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
        <p className="font-bold">Factor de venta directa y redes (sin retención)</p>
        <p>Nacen en <b>1.5</b>. Con la <b>capacitación aprobada</b>: de <b>6 a 15</b> ventas en el mes → <b>1.8</b>; <b>16 o más</b> → <b>2.0</b>. Sin la capacitación no suben de 1.5.</p>
        <p>Es automático. Si escribes un factor a mano en alguien de venta directa o redes, queda <b>fijo</b> y ya no sube solo (bórralo para volver al automático). Ventas del mes = cuentas de la cosecha M1 cargada.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar vendedor…"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[180px]"
        />
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={soloSinFactor} onChange={(e) => setSoloSinFactor(e.target.checked)} /> Solo sin factor
        </label>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Vendedor</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Factor</th>
              <th className="text-left px-3 py-2">Ventas del mes</th>
              <th className="text-left px-3 py-2">Capacitación</th>
              <th className="text-left px-3 py-2">Teléfono</th>
              <th className="text-left px-3 py-2">Correo</th>
              <th className="text-left px-3 py-2">Nacimiento</th>
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {filtrada.map((v) => (
              editandoId === v._id ? (
                <tr key={v._id} className="border-t border-slate-100 bg-blue-50">
                  <td className="px-2 py-2">{campo('vendedor')}</td>
                  <td className="px-2 py-2">
                    <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-2 py-1 border border-slate-300 rounded text-xs">
                      <option value="">Sin definir</option>
                      <option value="directa">Venta directa</option>
                      <option value="distribuidor">Distribuidor</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">{campo('factor', 'number', 'w-20')}</td>
                  <td />
                  <td />
                  <td className="px-2 py-2">{campo('telefono')}</td>
                  <td className="px-2 py-2">{campo('email')}</td>
                  <td className="px-2 py-2">{campo('fechaNacimiento', 'date')}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <button onClick={guardarEdicion} disabled={guardando} className="text-green-700 mr-2" title="Guardar"><Check size={16} /></button>
                    <button onClick={() => setEditandoId(null)} className="text-slate-500" title="Cancelar"><X size={16} /></button>
                  </td>
                </tr>
              ) : (
                <tr key={v._id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{v.vendedor}</td>
                  <td className="px-3 py-2">
                    {v.tipo
                      ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIPO_CLASE[v.tipo]}`}>{TIPO_LABEL[v.tipo]}</span>
                      : <span className="text-xs text-slate-400">Sin definir</span>}
                  </td>
                  <td className="px-3 py-2 font-bold">
                    {Number(v.factorEfectivo) > 0 ? (
                      <>
                        {v.factorEfectivo}
                        {v.tipo === 'directa' && (
                          <span className={`ml-1 text-[10px] font-normal ${v.factorAuto ? 'text-green-600' : 'text-slate-400'}`}>{v.factorAuto ? 'auto' : 'fijo'}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-normal text-amber-600">sin factor</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{v.tipo === 'directa' ? v.ventasMes : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 text-xs">
                    {v.tipo !== 'directa' ? (
                      <span className="text-slate-300">—</span>
                    ) : canEdit ? (
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={!!v.capacitacionAprobada} onChange={(e) => cambiarCapacitacion(v, e.target.checked)} />
                        {v.capacitacionAprobada ? 'Aprobada' : 'Pendiente'}
                      </label>
                    ) : (
                      v.capacitacionAprobada ? 'Aprobada' : 'Pendiente'
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{v.telefono || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 text-xs">{v.email || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 text-xs">{fmtFecha(v.fechaNacimiento) || <span className="text-slate-300">—</span>}</td>
                  {canEdit && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => empezarEdicion(v)} className="text-slate-400 hover:text-blue-600 mr-2" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => eliminar(v)} className="text-slate-400 hover:text-red-600" title="Quitar"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              )
            ))}
          </tbody>
        </table>
        {filtrada.length === 0 && (
          <p className="text-center text-slate-400 py-8">
            {lista.length === 0 ? 'La base está vacía. Usa "Traer vendedores (cobranza y redes)" para llenarla de un jalón.' : 'Sin resultados.'}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================ PAQUETES ============================

const GRUPOS = [
  { k: 'triple', label: 'Planes triples' },
  { k: 'doble', label: 'Planes dobles' },
  { k: 'single', label: 'Planes single' },
  { k: 'otro', label: 'Otros (agregados a mano)' },
];

function PaquetesTab({ canEdit }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sembrando, setSembrando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [paquete, setPaquete] = useState('');
  const [comisionBase, setComisionBase] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    api.getComisionPaquetes().then(setLista).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const sembrar = async () => {
    if (!confirm('Esto carga o actualiza la comisión base de los 43 paquetes de la tabla vigente. Los paquetes que agregaste a mano no se tocan. ¿Continuar?')) return;
    setSembrando(true);
    setMensaje('');
    try {
      const r = await api.sembrarComisionPaquetes();
      setMensaje(`Listo: ${r.nuevos} paquetes nuevos y ${r.actualizados} actualizados.`);
      cargar();
    } catch (e) {
      setMensaje('Error: ' + e.message);
    } finally {
      setSembrando(false);
    }
  };

  const guardar = async () => {
    if (!paquete.trim() || comisionBase === '') return;
    setGuardando(true);
    try {
      await api.guardarComisionPaquete(paquete.trim(), parseFloat(comisionBase));
      setPaquete('');
      setComisionBase('');
      cargar();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (p) => {
    if (!confirm(`¿Borrar "${p.paquete}"?`)) return;
    await api.eliminarComisionPaquete(p._id);
    cargar();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={sembrar} disabled={sembrando} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2">
            {sembrando && <Loader2 size={14} className="animate-spin" />} Cargar / actualizar catálogo vigente (43 paquetes)
          </button>
          {mensaje && <span className="text-xs text-slate-600">{mensaje}</span>}
        </div>
      )}

      {canEdit && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="font-bold text-sm text-slate-700 mb-2">Agregar o corregir un paquete</p>
          <div className="flex flex-wrap gap-2">
            <input value={paquete} onChange={(e) => setPaquete(e.target.value)} placeholder="Nombre del paquete" className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[200px]" />
            <input type="number" step="0.01" value={comisionBase} onChange={(e) => setComisionBase(e.target.value)} placeholder="Comisión base $" className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <button onClick={guardar} disabled={guardando} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {GRUPOS.map((g) => {
        const items = lista
          .filter((p) => (p.categoria || 'otro') === g.k)
          .sort((a, b) => String(a.clave || a.paquete).localeCompare(String(b.clave || b.paquete), 'es', { numeric: true }));
        if (items.length === 0) return null;
        return (
          <div key={g.k}>
            <p className="font-bold text-sm text-slate-700 mb-1">{g.label} ({items.length})</p>
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Cve</th>
                    <th className="text-left px-3 py-2">Paquete</th>
                    <th className="text-right px-3 py-2">Comisión base</th>
                    <th className="text-left px-3 py-2">Nombres asignados</th>
                    {canEdit && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p._id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.clave || '—'}</td>
                      <td className="px-3 py-2">{p.paquete}</td>
                      <td className="px-3 py-2 text-right font-bold">{dinero(p.comisionBase)}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{(p.alias || []).length ? (p.alias || []).join(' · ') : '—'}</td>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <button onClick={() => eliminar(p)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {lista.length === 0 && <p className="text-center text-slate-400 py-8">Sin paquetes. {canEdit ? 'Carga el catálogo vigente con el botón de arriba.' : ''}</p>}
    </div>
  );
}
