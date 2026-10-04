import { getItemVendedores } from '../src/utils/helpers.js';
import { getEstatusFPDM1 } from './estatusFPD.js';

export const quitarAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Para comparar nombres de personas: sin acentos, mayúsculas, sin signos, espacios únicos
export function normalizarNombre(s) {
  return quitarAcentos(s).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Para comparar paquetes (conserva el "+", que distingue "IZZI TV +" de otros)
export function normalizarPaquete(s) {
  return quitarAcentos(s).toUpperCase().replace(/[^A-Z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------- Resolver el paquete que viene en la cobranza contra el catálogo ----------
// En la cobranza el paquete viene como "IZZI 100 + IZZITV HD CON VIX PREMIUM", "IZZI 80",
// "Hasta 60 Megas", etc. No coincide letra por letra con el catálogo, así que se resuelve por
// tipo de plan (2P/3P), velocidad y si es "Negocios".

function claseDePaquete(nombreNorm) {
  const vel = nombreNorm.match(/\b(\d{2,4})\b/);
  if (!vel) return null; // single (solo TV): se resuelve por nombre
  return {
    categoria: /\+\s*IZZI\s*TV\s*HD|\+\s*IZZITV/.test(nombreNorm) ? 'triple' : 'doble',
    negocios: nombreNorm.includes('NEGOCIO'),
    velocidad: Number(vel[1]),
  };
}

export function construirIndicePaquetes(docs) {
  const porNombre = new Map();
  const alias = new Map();
  const porClase = new Map();
  for (const d of docs || []) {
    const nombre = normalizarPaquete(d.paquete);
    porNombre.set(nombre, d);
    for (const a of d.alias || []) alias.set(normalizarPaquete(a), d);
    const clase = claseDePaquete(nombre);
    if (clase) porClase.set(`${clase.categoria}|${clase.negocios ? 'N' : 'R'}|${clase.velocidad}`, d);
  }
  return { porNombre, alias, porClase };
}

// Palabra clave → nombre del single en el catálogo
const SINGLES = [
  ['LIGHT', 'IZZI TV LIGHT'],
  ['BASICO', 'IZZI TV + BASICO'],
  ['PREMIUM', 'IZZI TV + PREMIUM'],
  ['MINI', 'PACK TV MINI'],
  ['PACK TV PLUS', 'PACK TV PLUS'],
  ['PACK TV +', 'PACK TV PLUS'],
];

export function resolverPaquete(raw, play, indice) {
  const t = normalizarPaquete(raw);
  if (!t || /SIN PAQUETE|NO MATCH/.test(t)) return null;

  // 1) alias que tú asignaste desde el sistema, 2) nombre exacto
  const porAlias = indice.alias.get(t);
  if (porAlias) return porAlias;
  const exacto = indice.porNombre.get(t);
  if (exacto) return exacto;

  const vel = t.match(/\b(\d{2,4})\b/);

  // 3) sin velocidad = producto de TV suelto (single)
  if (!vel) {
    if (t.includes('OTT')) return null; // "IZZITV+ OTT WIZZ": no está en la tabla de comisiones
    for (const [palabra, canonico] of SINGLES) {
      if (t.includes(palabra)) return indice.porNombre.get(normalizarPaquete(canonico)) || null;
    }
    if (/\bTV HD\b/.test(t)) return indice.porNombre.get('IZZI TV HD') || null;
    if (/IZZITV\s*\+|IZZI TV \+/.test(t)) return indice.porNombre.get('IZZI TV +') || null;
    return null;
  }

  // 4) con velocidad: el play decide si es doble o triple
  const p = String(play || '').toUpperCase().trim();
  const tieneTV = /IZZITV|TV HD|\+\s*IZZI TV/.test(t);
  let categoria = p === '3P' ? 'triple' : p === '2P' ? 'doble' : null;
  if (!categoria) {
    // 1P o sin play: si el paquete dice TV, se vendió triple; si es solo velocidad en 1P es internet solo
    // y la tabla de comisiones no lo trae (queda como "sin comisión base" para que lo revises).
    if (p === '1P') categoria = tieneTV ? 'triple' : null;
    else categoria = tieneTV ? 'triple' : 'doble';
  }
  if (!categoria) return null;

  const negocios = /NEGOCIO/.test(t);
  return indice.porClase.get(`${categoria}|${negocios ? 'N' : 'R'}|${Number(vel[1])}`) || null;
}

// ---------- Estatus ----------
export function estatusCobranza(item) {
  const e = String(getEstatusFPDM1(item) || '').toUpperCase();
  if (e.includes('PÉRDIDA') || e.includes('PERDIDA')) return 'PERDIDA';
  if (e.includes('CORRIENTE')) return null; // ya pagó: no cuenta
  return 'M1'; // pendiente
}

const campo = (item, nombres) => {
  for (const n of nombres) {
    const v = item?.[n];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

// ---------- Cálculo de pérdidas por vendedor ----------
// comisión = base del paquete × factor del vendedor
// retención = comisión × retención% (solo distribuidores; venta directa no tiene retención)
export function calcularComisiones({ items, indice, vendedores }) {
  const porVendedor = new Map();
  const sinBase = new Map();
  const r = { cuentasPerdidas: 0, cuentasPendientes: 0, cuentasSinBase: 0, cuentasSinVendedor: 0 };

  for (const item of items) {
    const estatus = estatusCobranza(item);
    if (!estatus) continue;
    if (estatus === 'PERDIDA') r.cuentasPerdidas++; else r.cuentasPendientes++;

    const nombre = getItemVendedores(item)[0];
    if (!nombre) { r.cuentasSinVendedor++; continue; }

    const key = normalizarNombre(nombre);
    let v = porVendedor.get(key);
    if (!v) {
      v = {
        vendedor: nombre, tipo: null, factor: null, retencionPorcentaje: 0, sinFactor: false,
        perdidas: 0, pendientes: 0,
        comisionPerdida: 0, retencionPerdida: 0, comisionPendiente: 0, retencionPendiente: 0,
        sinBase: 0, cuentas: [],
      };
      const doc = vendedores.get(key);
      const factor = doc && Number(doc.factor) > 0 ? Number(doc.factor) : null;
      v.tipo = doc?.tipo || null;
      v.factor = factor;
      v.sinFactor = factor === null;
      v.retencionPorcentaje = doc?.tipo === 'distribuidor' ? (Number(doc.retencionPorcentaje) > 0 ? Number(doc.retencionPorcentaje) : 10) : 0;
      porVendedor.set(key, v);
    }

    const rawPaquete = campo(item, ['PAQUETE CONTRATADO', 'Paquete Contratado', 'PAQUETE', 'Paquete']);
    const play = campo(item, ['PLAY CONTRATADO', 'Play Contratado', 'PLAY', 'Play']);
    const paquete = resolverPaquete(rawPaquete, play, indice);
    const base = paquete ? Number(paquete.comisionBase) : null;

    if (base === null) {
      v.sinBase++;
      r.cuentasSinBase++;
      const k = rawPaquete || '(vacío)';
      const prev = sinBase.get(k) || { nombre: k, play, cuentas: 0 };
      prev.cuentas++;
      sinBase.set(k, prev);
    }

    const comision = base !== null && v.factor !== null ? base * v.factor : null;
    const retencion = comision !== null ? comision * (v.retencionPorcentaje / 100) : null;

    if (comision !== null) {
      if (estatus === 'PERDIDA') { v.comisionPerdida += comision; v.retencionPerdida += retencion; }
      else { v.comisionPendiente += comision; v.retencionPendiente += retencion; }
    }
    if (estatus === 'PERDIDA') v.perdidas++; else v.pendientes++;

    v.cuentas.push({
      cuenta: campo(item, ['cuenta', 'CUENTA', 'Cuenta']),
      cliente: campo(item, ['Cliente', 'CLIENTE', 'nombre']),
      paquete: rawPaquete, play,
      paqueteCatalogo: paquete?.paquete || '',
      base, comision, retencion, estatus,
    });
  }

  const lista = Array.from(porVendedor.values()).sort(
    (a, b) => (b.comisionPerdida - a.comisionPerdida) || (b.perdidas - a.perdidas) || (b.pendientes - a.pendientes)
  );
  const suma = (campoNombre) => lista.reduce((acc, v) => acc + v[campoNombre], 0);
  const evaluadas = r.cuentasPerdidas + r.cuentasPendientes;

  return {
    vendedores: lista,
    paquetesSinBase: Array.from(sinBase.values()).sort((a, b) => b.cuentas - a.cuentas),
    resumen: {
      ...r,
      cuentasEvaluadas: evaluadas,
      cobertura: evaluadas > 0 ? Number((((evaluadas - r.cuentasSinBase) / evaluadas) * 100).toFixed(1)) : 100,
      comisionPerdida: suma('comisionPerdida'),
      retencionPerdida: suma('retencionPerdida'),
      comisionPendiente: suma('comisionPendiente'),
      retencionPendiente: suma('retencionPendiente'),
      vendedoresSinFactor: lista.filter((v) => v.sinFactor).length,
      totalVendedores: lista.length,
    },
  };
}
