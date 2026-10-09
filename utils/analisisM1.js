// Análisis de M1 para Dirección: quién nos está afectando por región, subregión, plaza, vendedor, clave, paquete y semana de instalación.
// Función pura (sin base de datos) para poder probarla con el archivo real. Solo la consume una ruta de admin.
import { getItemVendedores } from '../src/utils/helpers.js';
import { parseFlexibleDate } from './estatusFPD.js';
import { extractRegionFromRecord } from './regionAccess.js';
import { estatusCobranza, normalizarNombre } from './comisionesCalc.js';
import { telefonosDeRegistro } from './telefonos.js';

export const META_POR_DEFECTO = 13; // % máximo de (M1 + Pérdida) sobre el total de la cosecha

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const claveNorm = (k) => sinAcentos(k).toUpperCase().replace(/[^A-Z0-9]/g, '');
const limpio = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

function dinero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
const redondea = (n, d = 1) => Number(Number(n).toFixed(d));

function normalizaRegistro(item, hoy) {
  const m = {};
  for (const [k, v] of Object.entries(item || {})) m[claveNorm(k)] = v;
  const g = (...ks) => { for (const k of ks) { const v = m[k]; if (v !== undefined && v !== null && limpio(v) !== '') return limpio(v); } return ''; };

  const est = estatusCobranza(item); // 'PERDIDA' | 'M1' | null (corriente)
  const estatus = est === 'PERDIDA' ? 'P' : est === 'M1' ? 'M' : 'C';
  const vendedor = getItemVendedores(item)[0] || g('VENDEDOR') || 'SIN VENDEDOR';
  const fechaInst = parseFlexibleDate(g('FECHAINSTALACION'));
  const fechaPerdida = parseFlexibleDate(g('FECHAPERDIDAFPD'));
  let dias = null;
  if (fechaPerdida) { const f = new Date(fechaPerdida); f.setHours(0, 0, 0, 0); dias = Math.round((f - hoy) / 86400000); }
  const velocidad = (g('PAQUETECONTRATADO').match(/\b(\d{2,4})\b/) || [])[1];
  const play = g('PLAYCONTRATADO') || '?';
  const tels = telefonosDeRegistro(item);

  return {
    estatus,
    region: extractRegionFromRecord(item) || 'SIN REGIÓN',
    subregion: g('SUBREGION', 'REGIONNUEVA') || 'SIN SUBREGIÓN',
    hub: g('HUB').replace(/^HUB\s+/i, '') || 'SIN HUB',
    plaza: g('PLAZA') || 'SIN PLAZA',
    vendedor, vendedorKey: normalizarNombre(vendedor),
    login: g('LOGINDISTRIBUIDOR') || 'SIN CLAVE',
    play,
    paquete: velocidad ? `${play} · ${velocidad} Mbps` : `${play} · sin velocidad`,
    semana: fechaInst ? inicioSemana(fechaInst) : 'SIN FECHA',
    saldoVencido: dinero(g('SALDOVENCIDO')),
    dias,
    cuenta: g('CUENTA', 'NDECUENTA') || String(item?.cuenta ?? ''),
    cliente: /^sin dato$/i.test(g('CLIENTE', 'NOMBRE')) ? '' : g('CLIENTE', 'NOMBRE'),
    telefono: tels[0] || '',
    sinTelefono: tels.length === 0,
  };
}

function inicioSemana(fecha) {
  const d = new Date(fecha); d.setHours(0, 0, 0, 0);
  const dia = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dia);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function agrupar(rows, keyFn, ctx, extra = () => ({})) {
  const mapa = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    let g = mapa.get(k);
    if (!g) { g = { nombre: k, total: 0, corriente: 0, m1: 0, perdida: 0, saldoVencido: 0, sinTelefonoM1: 0, ...extra(r) }; mapa.set(k, g); }
    g.total++;
    if (r.estatus === 'C') g.corriente++;
    else if (r.estatus === 'M') { g.m1++; g.saldoVencido += r.saldoVencido; if (r.sinTelefono) g.sinTelefonoM1++; }
    else g.perdida++;
  }
  const { totalScope, problemaScope, meta } = ctx;
  return Array.from(mapa.values()).map((g) => {
    const problema = g.m1 + g.perdida;
    const exceso = Math.max(0, Math.round(problema - (meta / 100) * g.total));
    return {
      ...g,
      saldoVencido: redondea(g.saldoVencido, 2),
      pct: g.total ? redondea((problema / g.total) * 100) : 0,
      aporte: problemaScope ? redondea((problema / problemaScope) * 100) : 0, // % del problema total que pone este grupo
      peso: totalScope ? redondea((g.total / totalScope) * 100) : 0,           // % de las cuentas que es este grupo
      exceso,                                                                   // cuentas de más contra la meta
      puntos: totalScope ? redondea((exceso / totalScope) * 100) : 0,           // puntos de % que bajaría el total si llegara a meta
      pocas: g.total < 8,
    };
  }).sort((a, b) => (b.exceso - a.exceso) || ((b.m1 + b.perdida) - (a.m1 + a.perdida)) || (b.total - a.total));
}

export function analizarM1(items, { region = '', subregion = '', plaza = '', meta = META_POR_DEFECTO, tiposPorVendedor = new Map(), hoy = new Date() } = {}) {
  const dia0 = new Date(hoy); dia0.setHours(0, 0, 0, 0);
  const todos = (items || []).map((it) => normalizaRegistro(it, dia0));

  const opciones = {
    regiones: [...new Set(todos.map((r) => r.region))].sort(),
    subregiones: [...new Set(todos.filter((r) => !region || r.region === region).map((r) => r.subregion))].sort(),
    plazas: [...new Set(todos.filter((r) => (!region || r.region === region) && (!subregion || r.subregion === subregion)).map((r) => r.plaza))].sort(),
  };

  const rows = todos.filter((r) => (!region || r.region === region) && (!subregion || r.subregion === subregion) && (!plaza || r.plaza === plaza));
  const total = rows.length;
  const m1 = rows.filter((r) => r.estatus === 'M').length;
  const perdida = rows.filter((r) => r.estatus === 'P').length;
  const corriente = total - m1 - perdida;
  const problema = m1 + perdida;
  const ctx = { totalScope: total, problemaScope: problema, meta };

  const maxProblema = Math.floor((meta / 100) * total);
  const m1Maximo = maxProblema - perdida; // M1 que aún se toleran para quedar en la meta (negativo = ya no alcanza)
  const resumen = {
    total, corriente, m1, perdida,
    pct: total ? redondea((problema / total) * 100) : 0,
    pctPiso: total ? redondea((perdida / total) * 100) : 0, // % si se cobrara TODO el M1: lo que ya se perdió no se recupera
    meta,
    maxProblema,
    m1ARecuperar: Math.max(0, m1 - Math.max(0, m1Maximo)),
    alcanzable: m1Maximo >= 0,
    saldoVencidoM1: redondea(rows.filter((r) => r.estatus === 'M').reduce((a, r) => a + r.saldoVencido, 0), 2),
    sinTelefonoM1: rows.filter((r) => r.estatus === 'M' && r.sinTelefono).length,
  };

  const porVendedor = agrupar(rows, (r) => r.vendedor, ctx, () => ({})).map((g) => {
    const tipo = tiposPorVendedor.get(normalizarNombre(g.nombre)) || '';
    return { ...g, tipo };
  });
  const tablas = {
    subregiones: agrupar(rows, (r) => r.subregion, ctx),
    plazas: agrupar(rows, (r) => r.plaza, ctx),
    hubs: agrupar(rows, (r) => r.hub, ctx),
    vendedores: porVendedor,
    claves: agrupar(rows, (r) => r.login, ctx),
    paquetes: agrupar(rows, (r) => r.paquete, ctx),
    semanas: agrupar(rows, (r) => r.semana, ctx).sort((a, b) => String(a.nombre).split('/').reverse().join('').localeCompare(String(b.nombre).split('/').reverse().join(''))),
  };

  // Vendedor × plaza: dónde exactamente está el problema de cada vendedor (los de más cuentas en M1+Pérdida)
  const cruces = agrupar(rows, (r) => `${r.vendedor} — ${r.plaza}`, ctx).filter((g) => g.m1 + g.perdida > 0).slice(0, 25);

  // Urgencia: M1 por días que le quedan antes de pasar a Pérdida
  const m1Rows = rows.filter((r) => r.estatus === 'M');
  const cubeta = (lo, hi) => { const l = m1Rows.filter((r) => r.dias !== null && r.dias >= lo && r.dias <= hi); return { cuentas: l.length, saldoVencido: redondea(l.reduce((a, r) => a + r.saldoVencido, 0), 2) }; };
  const urgencia = {
    hoyOAntes: cubeta(-9999, 0), tres: cubeta(1, 3), siete: cubeta(4, 7), quince: cubeta(8, 15), mas: cubeta(16, 9999),
    sinFecha: m1Rows.filter((r) => r.dias === null).length,
  };
  const prioridad = m1Rows
    .filter((r) => r.dias !== null)
    .sort((a, b) => (a.dias - b.dias) || (b.saldoVencido - a.saldoVencido))
    .slice(0, 150)
    .map((r) => ({ cuenta: r.cuenta, cliente: r.cliente, telefono: r.telefono, vendedor: r.vendedor, plaza: r.plaza, dias: r.dias, saldoVencido: redondea(r.saldoVencido, 2) }));

  return { resumen, tablas, cruces, urgencia, prioridad, opciones, hallazgos: generarHallazgos({ resumen, tablas, cruces, urgencia }) };
}

function generarHallazgos({ resumen, tablas, cruces, urgencia }) {
  const h = [];
  const r = resumen;
  if (!r.total) return h;
  const fmt = (n) => Number(n).toLocaleString('es-MX');

  h.push({ tipo: 'meta', texto: `Estás en ${r.pct}% (${fmt(r.m1 + r.perdida)} de ${fmt(r.total)} cuentas entre M1 y pérdida). La meta de ${r.meta}% permite máximo ${fmt(r.maxProblema)}.` });
  if (r.pct <= r.meta) h.push({ tipo: 'ok', texto: 'Ya estás dentro de la meta.' });
  else if (r.alcanzable) h.push({ tipo: 'meta', texto: `Lo ya perdido (${fmt(r.perdida)}) no se recupera y pesa ${r.pctPiso}%. Para llegar a ${r.meta}% hay que cobrar ${fmt(r.m1ARecuperar)} de las ${fmt(r.m1)} cuentas en M1 (${r.m1 ? Math.round((r.m1ARecuperar / r.m1) * 100) : 0}%).` });
  else h.push({ tipo: 'alerta', texto: `Aunque se cobrara TODO el M1, solo bajarías a ${r.pctPiso}%: las pérdidas (${fmt(r.perdida)}) ya superan el máximo de ${r.meta}%. Esta cosecha ya no llega a la meta; lo que sigue es no empeorar y cuidar la siguiente.` });

  // Concentración por vendedor
  const conProblema = tablas.vendedores.filter((v) => v.m1 + v.perdida > 0).sort((a, b) => ((b.m1 + b.perdida) - (a.m1 + a.perdida)));
  const top3 = conProblema.slice(0, 3);
  const problema = r.m1 + r.perdida;
  if (top3.length && problema) {
    const suma = top3.reduce((a, v) => a + v.m1 + v.perdida, 0);
    h.push({ tipo: 'vendedor', texto: `Los 3 vendedores con más cuentas en riesgo (${top3.map((v) => `${v.nombre}: ${v.m1 + v.perdida}`).join(', ')}) ponen el ${Math.round((suma / problema) * 100)}% del problema.` });
  }
  const grandesSobreMeta = tablas.vendedores.filter((v) => !v.pocas && v.pct > r.meta).sort((a, b) => b.exceso - a.exceso).slice(0, 3);
  if (grandesSobreMeta.length) h.push({ tipo: 'vendedor', texto: `Con volumen y arriba de la meta: ${grandesSobreMeta.map((v) => `${v.nombre} (${v.pct}% de ${v.total})`).join('; ')}.` });
  const sinTel = tablas.vendedores.filter((v) => v.sinTelefonoM1 > 0).sort((a, b) => b.sinTelefonoM1 - a.sinTelefonoM1).slice(0, 3);
  if (r.sinTelefonoM1 > 0) h.push({ tipo: 'dato', texto: `${fmt(r.sinTelefonoM1)} cuentas en M1 no tienen teléfono, no se les puede llamar${sinTel.length ? ` (sobre todo ${sinTel.map((v) => `${v.nombre}: ${v.sinTelefonoM1}`).join(', ')})` : ''}.` });

  // Plaza y semana
  const plazaMala = tablas.plazas.filter((p) => !p.pocas && p.pct > r.meta)[0];
  if (plazaMala) h.push({ tipo: 'plaza', texto: `Plaza que más pesa: ${plazaMala.nombre} con ${plazaMala.pct}% (${plazaMala.m1} en M1 y ${plazaMala.perdida} perdidas de ${plazaMala.total}); bajarla a meta mueve el total ${plazaMala.puntos} puntos.` });
  const semanaMala = tablas.semanas.filter((s) => s.nombre !== 'SIN FECHA' && !s.pocas).sort((a, b) => b.pct - a.pct)[0];
  const semanasConFecha = tablas.semanas.filter((x) => x.nombre !== 'SIN FECHA');
  const esUltima = semanaMala && semanasConFecha.length > 1 && semanasConFecha[semanasConFecha.length - 1].nombre === semanaMala.nombre;
  if (semanaMala) h.push({ tipo: 'semana', texto: `La semana de instalación del ${semanaMala.nombre} es la peor: ${semanaMala.pct}% (${semanaMala.m1 + semanaMala.perdida} de ${semanaMala.total}). ${esUltima ? 'Ojo: es la semana más reciente y todavía tiene tiempo de cobrar, no todo es mala venta.' : 'Revisa qué se prometió o vendió esa semana.'}` });

  // Play
  const plays = tablas.paquetes.reduce((acc, p) => { const k = p.nombre.split(' · ')[0]; (acc[k] ||= { total: 0, problema: 0 }); acc[k].total += p.total; acc[k].problema += p.m1 + p.perdida; return acc; }, {});
  const ps = Object.entries(plays).filter(([, v]) => v.total >= 15).map(([k, v]) => ({ k, pct: (v.problema / v.total) * 100, total: v.total })).sort((a, b) => b.pct - a.pct);
  if (ps.length >= 2 && ps[0].pct - ps[ps.length - 1].pct >= 8) h.push({ tipo: 'paquete', texto: `Por tipo de paquete, ${ps[0].k} sale en ${Math.round(ps[0].pct)}% contra ${Math.round(ps[ps.length - 1].pct)}% de ${ps[ps.length - 1].k}.` });

  // Urgencia
  const pronto = urgencia.hoyOAntes.cuentas + urgencia.tres.cuentas;
  if (pronto > 0) h.push({ tipo: 'urgente', texto: `${fmt(pronto)} cuentas en M1 pasan a pérdida en 3 días o menos (${fmt(urgencia.tres.cuentas)} en 1-3 días${urgencia.hoyOAntes.cuentas ? `, ${fmt(urgencia.hoyOAntes.cuentas)} con fecha de hoy o vencida` : ''}). Ahí está el dinero que todavía se puede salvar.` });
  const cruce = cruces[0];
  if (cruce) h.push({ tipo: 'cruce', texto: `El punto más caliente es ${cruce.nombre}: ${cruce.m1} en M1 y ${cruce.perdida} perdidas de ${cruce.total}.` });
  return h;
}
