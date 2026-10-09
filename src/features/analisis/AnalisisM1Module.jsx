import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Download, Target, AlertTriangle, PhoneOff, Clock } from 'lucide-react';
import * as api from '../../api.js';

const dinero = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const num = (n) => Number(n || 0).toLocaleString('es-MX');
const colorPct = (pct, meta) => (pct <= meta ? 'text-green-600' : pct <= meta * 2 ? 'text-amber-600' : 'text-red-600 font-bold');

const COLORES = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

// Gráfica de líneas sencilla (SVG): una línea por serie, con la meta como línea punteada
function Lineas({ series, fechas, meta }) {
  const W = 640, H = 220, P = { l: 34, r: 10, t: 10, b: 24 };
  const valores = series.flatMap((s) => s.valores.filter((v) => v !== null));
  const max = Math.max(meta + 5, ...valores, 10);
  const x = (i) => P.l + (fechas.length <= 1 ? (W - P.l - P.r) / 2 : (i / (fechas.length - 1)) * (W - P.l - P.r));
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56">
      {[0, 25, 50, 75, 100].filter((t) => t <= max + 10).map((t) => (<g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" /><text x={P.l - 4} y={y(t) + 3} fontSize="10" textAnchor="end" fill="#64748b">{t}%</text></g>))}
      <line x1={P.l} x2={W - P.r} y1={y(meta)} y2={y(meta)} stroke="#16a34a" strokeDasharray="5 4" /><text x={W - P.r} y={y(meta) - 3} fontSize="10" textAnchor="end" fill="#16a34a">meta {meta}%</text>
      {fechas.map((fe, i) => (i === 0 || i === fechas.length - 1 || fechas.length <= 8) && <text key={fe} x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="#64748b">{fe.slice(5)}</text>)}
      {series.map((s, si) => {
        const pts = s.valores.map((v, i) => (v === null ? null : [x(i), y(v)]));
        const d = pts.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
        return (<g key={s.nombre}><path d={d} fill="none" stroke={COLORES[si % COLORES.length]} strokeWidth={si === 0 ? 3 : 1.8} />{pts.filter(Boolean).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={si === 0 ? 3.5 : 2.5} fill={COLORES[si % COLORES.length]} />)}</g>);
      })}
    </svg>
  );
}

const TABS = [
  { id: 'vendedores', titulo: 'Vendedores / Subs', col: 'Vendedor' },
  { id: 'plazas', titulo: 'Plazas (ciudad)', col: 'Plaza' },
  { id: 'cruces', titulo: 'Vendedor × plaza', col: 'Vendedor — plaza' },
  { id: 'hubs', titulo: 'Hubs', col: 'Hub' },
  { id: 'subregiones', titulo: 'Subregiones', col: 'Subregión' },
  { id: 'claves', titulo: 'Claves', col: 'Clave de venta' },
  { id: 'paquetes', titulo: 'Paquete', col: 'Paquete' },
  { id: 'semanas', titulo: 'Semana de instalación', col: 'Semana (lunes)' },
];

const HALLAZGO_ESTILO = {
  alerta: 'bg-red-50 border-red-200 text-red-900', urgente: 'bg-red-50 border-red-200 text-red-900',
  ok: 'bg-green-50 border-green-200 text-green-900', meta: 'bg-blue-50 border-blue-200 text-blue-900',
};

function descargarCSV(nombre, filas) {
  if (!filas.length) return;
  const cols = Object.keys(filas[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre;
  a.click();
}

export default function AnalisisM1Module() {
  const [f, setF] = useState({ region: '', subregion: '', plaza: '', meta: 13 });
  const [d, setD] = useState(null);
  const [tend, setTend] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('vendedores');
  const [orden, setOrden] = useState({ k: 'exceso', dir: -1 });

  const cargar = useCallback(async (filtros) => {
    setCargando(true);
    try { setD(await api.getAnalisisM1(filtros)); setError(''); }
    catch (e) { setError(e?.message || 'No se pudo cargar el análisis'); }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(f); }, [f, cargar]);
  useEffect(() => { api.getTendenciaM1(f).then(setTend).catch(() => setTend(null)); }, [f.region, f.subregion, f.plaza]); // eslint-disable-line react-hooks/exhaustive-deps

  const filas = useMemo(() => {
    if (!d) return [];
    const base = tab === 'cruces' ? d.cruces : d.tablas[tab];
    return [...(base || [])].sort((a, b) => ((a[orden.k] > b[orden.k] ? 1 : a[orden.k] < b[orden.k] ? -1 : 0) * orden.dir));
  }, [d, tab, orden]);

  const r = d?.resumen;
  const maxAporte = Math.max(1, ...filas.map((x) => x.aporte || 0));
  const th = (k, texto, extra = '') => (
    <th onClick={() => setOrden((o) => ({ k, dir: o.k === k ? -o.dir : -1 }))} className={`px-2 py-2 text-right cursor-pointer select-none whitespace-nowrap ${extra}`}>
      {texto}{orden.k === k ? (orden.dir === -1 ? ' ▼' : ' ▲') : ''}
    </th>
  );
  const sel = 'border rounded-lg px-3 py-2 text-sm bg-white';
  const caja = 'bg-white rounded-xl border border-slate-200 p-4 sm:p-5';
  const tabInfo = TABS.find((t) => t.id === tab);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className={caja}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><Target size={18} /> Análisis de M1 — quién nos está afectando</h2>
          <button onClick={() => cargar(f)} className="text-slate-500 hover:text-blue-600" title="Actualizar"><RefreshCw size={16} className={cargando ? 'animate-spin' : ''} /></button>
        </div>
        <p className="text-xs text-slate-500 mt-1">Solo Admin. Se calcula con la cosecha de M1 cargada. % = (M1 + Pérdida) ÷ total de cuentas.</p>
        <div className="flex flex-wrap gap-2 mt-3 items-center">
          <select className={sel} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value, subregion: '', plaza: '' })}>
            <option value="">Todas las regiones</option>
            {d?.opciones.regiones.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className={sel} value={f.subregion} onChange={(e) => setF({ ...f, subregion: e.target.value, plaza: '' })}>
            <option value="">Todas las subregiones</option>
            {d?.opciones.subregiones.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className={sel} value={f.plaza} onChange={(e) => setF({ ...f, plaza: e.target.value })}>
            <option value="">Todas las plazas</option>
            {d?.opciones.plazas.map((x) => <option key={x}>{x}</option>)}
          </select>
          <label className="text-sm text-slate-600 flex items-center gap-1">Meta máx.
            <input type="number" min="1" max="100" value={f.meta} onChange={(e) => setF({ ...f, meta: Number(e.target.value) || 13 })} className="border rounded-lg px-2 py-2 w-16 text-sm" />%
          </label>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {r && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className={caja + ' text-center'}><div className={`text-3xl ${colorPct(r.pct, r.meta)}`}>{r.pct}%</div><div className="text-xs text-slate-500">Hoy · meta {r.meta}%</div></div>
            <div className={caja + ' text-center'}><div className="text-2xl font-bold text-slate-800">{num(r.m1ARecuperar)}</div><div className="text-xs text-slate-500">M1 por cobrar para llegar a meta (de {num(r.m1)})</div></div>
            <div className={caja + ' text-center'}><div className={`text-2xl font-bold ${r.alcanzable ? 'text-slate-800' : 'text-red-600'}`}>{r.pctPiso}%</div><div className="text-xs text-slate-500">Piso: si cobras TODO el M1 ({num(r.perdida)} perdidas)</div></div>
            <div className={caja + ' text-center'}><div className="text-2xl font-bold text-slate-800">{dinero(r.saldoVencidoM1)}</div><div className="text-xs text-slate-500">Saldo vencido en M1</div></div>
            <div className={caja + ' text-center'}><div className="text-2xl font-bold text-slate-800">{num(r.total)}</div><div className="text-xs text-slate-500">Cuentas · {num(r.corriente)} corriente</div></div>
          </div>

          <div className={caja}>
            <h3 className="font-bold text-slate-800 mb-1">Tendencia día con día</h3>
            {!tend || tend.serie.length < 2 ? (
              <p className="text-sm text-slate-500">Hoy se empezó a guardar una foto diaria de M1. Con 2 o más días ya aparece la gráfica (se guarda sola cada vez que se sube el M1 o se abre esta pantalla).</p>
            ) : (
              <>
                {tend.cambio && (
                  <p className={`text-sm font-semibold mb-1 ${tend.cambio.deltaPct <= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    Desde el {tend.cambio.desde.slice(5)}: {tend.cambio.pctAntes}% → {tend.cambio.pctAhora}% ({tend.cambio.deltaPct > 0 ? '+' : ''}{tend.cambio.deltaPct} puntos) · M1 {num(tend.cambio.m1Antes)} → {num(tend.cambio.m1Ahora)} ({tend.cambio.deltaM1 > 0 ? '+' : ''}{tend.cambio.deltaM1})
                  </p>
                )}
                <Lineas fechas={tend.serie.map((s) => s.fecha)} meta={r.meta} series={[{ nombre: 'Total filtrado', valores: tend.serie.map((s) => s.pct) }, ...tend.vendedores.map((v) => ({ nombre: v.nombre, valores: v.puntos.map((p) => p.pct) }))]} />
                <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                  <span><b style={{ color: COLORES[0] }}>━</b> Total filtrado</span>
                  {tend.vendedores.map((v, i) => <span key={v.nombre}><b style={{ color: COLORES[(i + 1) % COLORES.length] }}>━</b> {v.nombre}</span>)}
                </div>
                <p className="text-xs text-slate-400 mt-1">Al cargar una cosecha nueva (otro mes) la línea cambia de base: compara dentro de la misma cosecha.</p>
              </>
            )}
          </div>

          <div className={caja}>
            <h3 className="font-bold text-slate-800 mb-2">Lo que veo</h3>
            <ul className="space-y-2">
              {d.hallazgos.map((h, i) => (
                <li key={i} className={`text-sm border rounded-lg px-3 py-2 ${HALLAZGO_ESTILO[h.tipo] || 'bg-slate-50 border-slate-200 text-slate-800'}`}>{h.texto}</li>
              ))}
            </ul>
          </div>

          <div className={caja}>
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock size={16} /> Cuánto tiempo les queda a las cuentas en M1</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 text-center">
              {[['Hoy o vencidas', d.urgencia.hoyOAntes, 'bg-red-50'], ['1-3 días', d.urgencia.tres, 'bg-red-50'], ['4-7 días', d.urgencia.siete, 'bg-amber-50'], ['8-15 días', d.urgencia.quince, 'bg-amber-50'], ['Más de 15', d.urgencia.mas, 'bg-slate-50']].map(([t, v, bg]) => (
                <div key={t} className={`${bg} rounded-lg p-2`}><div className="text-xl font-bold">{num(v.cuentas)}</div><div className="text-xs text-slate-600">{t}</div><div className="text-xs text-slate-500">{dinero(v.saldoVencido)}</div></div>
              ))}
            </div>
          </div>

          <div className={caja}>
            <div className="flex flex-wrap gap-1 mb-3">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); setOrden({ k: 'exceso', dir: -1 }); }} className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t.titulo}</button>
              ))}
              <button onClick={() => descargarCSV(`analisis-m1-${tab}.csv`, filas.map(({ nombre, total, corriente, m1, perdida, pct, aporte, peso, exceso, puntos, saldoVencido }) => ({ nombre, total, corriente, m1, perdida, pct, aporte, peso, exceso, puntos, saldoVencido })))} className="ml-auto px-3 py-1.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left">{tabInfo.col}</th>
                    {th('total', 'Total')}{th('corriente', 'Corriente')}{th('m1', 'M1')}{th('perdida', 'Pérdida')}{th('pct', '% M1+P')}
                    {th('aporte', '% del problema', 'min-w-[140px]')}{th('exceso', 'Sobran vs meta')}{th('puntos', 'Puntos que mueve')}{th('saldoVencido', 'Saldo venc. M1')}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((x) => (
                    <tr key={x.nombre} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-2 py-2 font-semibold text-slate-800">
                        {x.nombre}
                        {x.tipo && <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{x.tipo === 'distribuidor' ? 'DIST' : 'DIRECTA'}</span>}
                        {x.pocas && <span className="ml-1 text-[10px] text-slate-400">(pocas)</span>}
                        {x.sinTelefonoM1 > 0 && <span className="ml-1 text-[10px] text-red-500 inline-flex items-center gap-0.5"><PhoneOff size={10} />{x.sinTelefonoM1}</span>}
                      </td>
                      <td className="px-2 py-2 text-right">{num(x.total)}</td>
                      <td className="px-2 py-2 text-right text-green-700">{num(x.corriente)}</td>
                      <td className="px-2 py-2 text-right text-amber-700 font-semibold">{num(x.m1)}</td>
                      <td className="px-2 py-2 text-right text-red-700">{num(x.perdida)}</td>
                      <td className={`px-2 py-2 text-right ${colorPct(x.pct, r.meta)}`}>{x.pct}%</td>
                      <td className="px-2 py-2"><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-slate-100 rounded"><div className="h-2 bg-red-400 rounded" style={{ width: `${(x.aporte / maxAporte) * 100}%` }} /></div><span className="w-10 text-right text-xs">{x.aporte}%</span></div></td>
                      <td className="px-2 py-2 text-right font-bold">{num(x.exceso)}</td>
                      <td className="px-2 py-2 text-right">{x.puntos}</td>
                      <td className="px-2 py-2 text-right">{dinero(x.saldoVencido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-2">“Sobran vs meta” = cuentas que ese grupo tiene de más para quedar en {r.meta}%. “Puntos que mueve” = cuánto bajaría el % de todo lo filtrado si ese grupo llegara a meta.</p>
          </div>

          <div className={caja}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Cuentas a perseguir primero ({d.prioridad.length})</h3>
              <button onClick={() => descargarCSV('cuentas-m1-prioridad.csv', d.prioridad.map((p) => ({ cuenta: p.cuenta, cliente: p.cliente, telefono: p.telefono, vendedor: p.vendedor, plaza: p.plaza, dias_para_perdida: p.dias, saldo_vencido: p.saldoVencido })))} className="px-3 py-1.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <p className="text-xs text-slate-500 mt-1">M1 ordenadas por los días que les quedan antes de pasar a pérdida (primero las más urgentes) y luego por saldo.</p>
            <div className="overflow-x-auto mt-2 max-h-96">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b sticky top-0 bg-white"><tr><th className="px-2 py-2 text-left">Cuenta</th><th className="px-2 py-2 text-left">Cliente</th><th className="px-2 py-2 text-left">Teléfono</th><th className="px-2 py-2 text-left">Vendedor</th><th className="px-2 py-2 text-left">Plaza</th><th className="px-2 py-2 text-right">Días</th><th className="px-2 py-2 text-right">Saldo venc.</th></tr></thead>
                <tbody>
                  {d.prioridad.map((p) => (
                    <tr key={p.cuenta} className="border-b last:border-0">
                      <td className="px-2 py-1.5 font-mono">{p.cuenta}</td><td className="px-2 py-1.5">{p.cliente || <span className="text-slate-400">sin nombre</span>}</td>
                      <td className="px-2 py-1.5">{p.telefono || <span className="text-red-500">sin teléfono</span>}</td><td className="px-2 py-1.5">{p.vendedor}</td><td className="px-2 py-1.5">{p.plaza}</td>
                      <td className={`px-2 py-1.5 text-right font-bold ${p.dias <= 0 ? 'text-red-600' : p.dias <= 3 ? 'text-red-500' : 'text-amber-600'}`}>{p.dias <= 0 ? 'hoy/vencida' : p.dias}</td>
                      <td className="px-2 py-1.5 text-right">{dinero(p.saldoVencido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {!r && cargando && <p className="text-sm text-slate-500">Calculando…</p>}
    </div>
  );
}
