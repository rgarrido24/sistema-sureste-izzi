import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Send, RefreshCw, Copy, Ban, ClipboardList } from 'lucide-react';
import * as api from '../../api.js';

const TIPOS = { captura: 'Captura del portal (extensión / marcador)', bot: 'Chatbot (WhatsApp)' };

export default function EstatusModule({ canManageKeys }) {
  const [resumen, setResumen] = useState(null);
  const [llaves, setLlaves] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('captura');
  const [nueva, setNueva] = useState(null);
  const [error, setError] = useState('');
  const [tel, setTel] = useState('');
  const [msg, setMsg] = useState('');
  const [resp, setResp] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [r, l, p] = await Promise.all([api.getEstatusResumen(), api.getEstatusIntegraciones(), api.getEstatusPendientes()]);
      setResumen(r); setLlaves(l.data || []); setPendientes(p.data || []); setError('');
    } catch (e) { setError(e?.message || 'No se pudo cargar'); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    if (!nombre.trim()) return;
    try { const r = await api.crearEstatusIntegracion(nombre.trim(), tipo); setNueva(r.llave); setNombre(''); cargar(); }
    catch (e) { setError(e?.message || 'No se pudo crear'); }
  };
  const revocar = async (id) => {
    if (!window.confirm('¿Revocar esta llave? Lo que la use dejará de funcionar.')) return;
    try { await api.revocarEstatusIntegracion(id); cargar(); } catch (e) { setError(e?.message || 'No se pudo revocar'); }
  };
  const probar = async () => {
    setEnviando(true); setResp(null);
    try { setResp(await api.probarEstatusBot(tel, msg)); } catch (e) { setResp({ respuesta: e?.message || 'Error' }); }
    setEnviando(false);
  };

  const caja = 'bg-white rounded-xl border border-slate-200 p-4 sm:p-5';
  return (
    <div className="space-y-4 max-w-4xl">
      <div className={caja}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><ClipboardList size={18} /> Estatus de órdenes Izzi</h2>
          <button onClick={cargar} className="text-slate-500 hover:text-blue-600" title="Actualizar"><RefreshCw size={16} /></button>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Una persona con acceso al portal de Izzi sincroniza las pantallas que ya tiene abiertas; RGO guarda solo el estatus (sin datos del cliente)
          y el chatbot responde a vendedores registrados que escriben un número de cuenta u orden.
        </p>
        {resumen && (
          <div className="grid grid-cols-3 gap-3 mt-3 text-center">
            <div className="bg-slate-50 rounded-lg p-2"><div className="text-xl font-bold">{resumen.ordenes}</div><div className="text-xs text-slate-500">Órdenes guardadas</div></div>
            <div className="bg-slate-50 rounded-lg p-2"><div className="text-xl font-bold">{resumen.pendientes}</div><div className="text-xs text-slate-500">Por revisar en el portal</div></div>
            <div className="bg-slate-50 rounded-lg p-2"><div className="text-xl font-bold">{resumen.consultasHoy}</div><div className="text-xs text-slate-500">Consultas hoy</div></div>
          </div>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div className={caja}>
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Send size={16} /> Probar el chatbot (sin WhatsApp)</h3>
        <p className="text-xs text-slate-500 mt-1">Simula que un vendedor escribe. El teléfono debe estar en Comisiones → Base de vendedores.</p>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Teléfono (10 dígitos)" className="border rounded-lg px-3 py-2 text-sm sm:w-48" />
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Número de cuenta u orden" className="border rounded-lg px-3 py-2 text-sm flex-1" />
          <button onClick={probar} disabled={enviando || !tel || !msg} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">Preguntar</button>
        </div>
        {resp && <pre className="mt-3 bg-slate-50 border rounded-lg p-3 text-sm whitespace-pre-wrap font-sans">{resp.respuesta}</pre>}
      </div>

      <div className={caja}>
        <h3 className="font-bold text-slate-800">Cuentas por revisar en el portal</h3>
        {pendientes.length === 0 ? <p className="text-sm text-slate-500 mt-1">Nada pendiente.</p> : (
          <div className="flex flex-wrap gap-2 mt-2">
            {pendientes.map((p) => <span key={p._id} className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-sm font-mono">{p.consulta}</span>)}
          </div>
        )}
      </div>

      {canManageKeys && (
        <div className={caja}>
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><KeyRound size={16} /> Llaves</h3>
          <p className="text-xs text-slate-500 mt-1">Cada herramienta usa su propia llave, aparte de tu sesión. Se muestra una sola vez; si se pierde, se revoca y se crea otra.</p>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Mesa Mérida)" className="border rounded-lg px-3 py-2 text-sm flex-1" />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={crear} disabled={!nombre.trim()} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">Crear llave</button>
          </div>
          {nueva && (
            <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-xs text-green-800 font-bold">Copia esta llave ahora. No se vuelve a mostrar.</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm break-all flex-1">{nueva}</code>
                <button onClick={() => navigator.clipboard?.writeText(nueva)} className="text-green-700" title="Copiar"><Copy size={16} /></button>
              </div>
            </div>
          )}
          <div className="mt-3 divide-y">
            {llaves.map((l) => (
              <div key={l._id} className="py-2 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{l.nombre} <span className="text-xs font-normal text-slate-500">· {TIPOS[l.tipo]}</span></div>
                  <div className="text-xs text-slate-500">{l.prefijo}… · {l.ultimoUso ? `último uso ${new Date(l.ultimoUso).toLocaleString('es-MX')}` : 'sin usar'}</div>
                </div>
                {l.activa
                  ? <button onClick={() => revocar(l._id)} className="text-red-600 flex items-center gap-1 text-xs font-bold"><Ban size={14} /> Revocar</button>
                  : <span className="text-xs text-slate-400">Revocada</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
