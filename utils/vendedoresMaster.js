import { normalizarNombre } from './comisionesCalc.js';

// ---------- Encabezados que aceptamos al subir un archivo ----------
const ENCABEZADOS = {
  nombre: ['NOMBRE', 'NOMBRE DEL VENDEDOR', 'NOMBRE COMPLETO', 'VENDEDOR', 'VENDEDOR SUB', 'SUBDISTRIBUIDOR', 'SUB', 'SUBDISTRIBUIDOR VENDEDOR'],
  tipo: ['TIPO', 'TIPO DE VENDEDOR', 'TIPO VENDEDOR'],
  factor: ['FACTOR'],
  telefono: ['TELEFONO', 'TEL', 'CELULAR', 'WHATSAPP', 'TELEFONO CELULAR', 'NUMERO CELULAR', 'TEL CELULAR'],
  email: ['CORREO', 'EMAIL', 'E MAIL', 'CORREO ELECTRONICO'],
  fechaNacimiento: ['FECHA DE NACIMIENTO', 'FECHA NACIMIENTO', 'NACIMIENTO', 'CUMPLEANOS', 'FECHA DE CUMPLEANOS', 'FECHA CUMPLEANOS'],
};

export function mapearEncabezado(k) {
  const n = normalizarNombre(k);
  for (const [campo, lista] of Object.entries(ENCABEZADOS)) {
    if (lista.includes(n)) return campo;
  }
  return null;
}

const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

// ---------- Parsers (devuelven { vacio } | { valor, advertencia? } | { error }) ----------
export function parsearFecha(v) {
  if (vacio(v)) return { vacio: true };
  let y, m, d;

  if (typeof v === 'number') {
    // Número serial de Excel
    if (!(v > 1 && v < 80000)) return { error: 'fecha no válida' };
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
  } else {
    const s = String(v).trim();
    let mm = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (mm) {
      y = +mm[1]; m = +mm[2]; d = +mm[3];
    } else {
      // Texto: se asume día/mes/año (como se escribe en México)
      mm = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
      if (!mm) return { error: 'formato de fecha no reconocido' };
      d = +mm[1]; m = +mm[2]; y = +mm[3];
      if (mm[3].length === 2) {
        const yy = new Date().getFullYear() % 100;
        y = y > yy ? 1900 + y : 2000 + y;
      }
    }
  }

  const diasDelMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (m < 1 || m > 12 || d < 1 || d > diasDelMes) return { error: 'fecha inexistente' };
  const anioActual = new Date().getFullYear();
  if (y < 1930 || y > anioActual - 14) return { error: `fecha de nacimiento poco creíble (${y})` };

  const pad = (n) => String(n).padStart(2, '0');
  return { valor: `${y}-${pad(m)}-${pad(d)}` };
}

export function parsearTelefono(v) {
  if (vacio(v)) return { vacio: true };
  let d = String(typeof v === 'number' ? Math.round(v) : v).replace(/\D/g, '');
  if (!d) return { vacio: true };
  if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  else if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  return d.length === 10 ? { valor: d } : { valor: d, advertencia: `teléfono con ${d.length} dígitos` };
}

export function parsearEmail(v) {
  if (vacio(v)) return { vacio: true };
  const s = String(v).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? { valor: s } : { error: 'correo no válido' };
}

export function parsearFactor(v) {
  if (vacio(v)) return { vacio: true };
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n < 0.5 || n > 5) return { error: 'factor fuera de rango (0.5 a 5)' };
  return { valor: Math.round(n * 100) / 100 };
}

export function parsearTipo(v) {
  if (vacio(v)) return { vacio: true };
  const n = normalizarNombre(v);
  if (n.includes('DIRECT')) return { valor: 'directa' };
  if (n.includes('DISTRIB') || /\bSUB/.test(n)) return { valor: 'distribuidor' };
  return { error: 'tipo no reconocido (usa Venta directa o Distribuidor)' };
}

const PARSERS = { tipo: parsearTipo, factor: parsearFactor, telefono: parsearTelefono, email: parsearEmail, fechaNacimiento: parsearFecha };

// Convierte una fila cruda (con los encabezados del archivo) en campos limpios
export function normalizarFila(row) {
  const crudo = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (k === '__fila') continue;
    const campo = mapearEncabezado(k);
    if (campo && crudo[campo] === undefined && !vacio(v)) crudo[campo] = v;
  }

  const salida = { advertencias: [] };
  const nombre = String(crudo.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (!nombre) return { ...salida, error: 'falta el nombre' };
  salida.nombre = nombre.toUpperCase();

  for (const [campo, parser] of Object.entries(PARSERS)) {
    if (crudo[campo] === undefined) continue;
    const r = parser(crudo[campo]);
    if (r.error) salida.advertencias.push(`${campo}: ${r.error} (se omitió ese dato)`);
    else if (!r.vacio) {
      salida[campo] = r.valor;
      if (r.advertencia) salida.advertencias.push(`${campo}: ${r.advertencia}`);
    }
  }
  return salida;
}

// ---------- Plan de actualización: crea los que faltan, actualiza los que existen, nunca duplica ----------
// Regla: un dato vacío en el archivo NUNCA borra lo que ya está capturado.
export function planificarUpsert(rows, existentes) {
  const mapa = new Map();
  for (const d of existentes || []) mapa.set(normalizarNombre(d.vendedor), { ...d });

  const crear = new Map(); // clave normalizada → doc nuevo
  const actualizar = new Map(); // id → cambios acumulados
  const errores = [];
  const advertencias = [];
  const resumen = { creados: 0, actualizados: 0, sinCambios: 0, omitidos: 0, repetidosEnArchivo: 0, tipoInferido: 0 };

  (rows || []).forEach((row, idx) => {
    const fila = row?.__fila ?? idx + 2;
    const n = normalizarFila(row);
    n.advertencias.forEach((mensaje) => advertencias.push({ fila, mensaje }));
    if (n.error) {
      resumen.omitidos++;
      errores.push({ fila, mensaje: n.error });
      return;
    }

    const key = normalizarNombre(n.nombre);
    const actual = mapa.get(key);
    const campos = {};
    for (const c of ['telefono', 'email', 'fechaNacimiento', 'factor', 'tipo']) {
      if (n[c] !== undefined) campos[c] = n[c];
    }

    // Si trae factor pero no tipo, se infiere con los rangos acordados (directa ≤ 2.0, distribuidor ≥ 2.4)
    if (campos.tipo === undefined && !actual?.tipo && campos.factor !== undefined) {
      if (campos.factor <= 2.0) { campos.tipo = 'directa'; resumen.tipoInferido++; }
      else if (campos.factor >= 2.4) { campos.tipo = 'distribuidor'; resumen.tipoInferido++; }
      else advertencias.push({ fila, mensaje: `factor ${campos.factor}: no se pudo inferir el tipo, defínelo a mano` });
    }

    // En venta directa/redes el factor es automático (por ventas y capacitación). Si el archivo trae uno, queda FIJO.
    if ((campos.tipo ?? actual?.tipo) === 'directa' && campos.factor !== undefined) {
      advertencias.push({ fila, mensaje: 'venta directa/redes: ese factor queda FIJO y no subirá solo por ventas; déjalo vacío para que sea automático' });
    }

    // Al fijar o cambiar el tipo, la retención queda coherente (solo distribuidores, 10% por default)
    if (campos.tipo !== undefined && campos.tipo !== actual?.tipo) {
      campos.retencionPorcentaje = campos.tipo === 'distribuidor'
        ? (Number(actual?.retencionPorcentaje) > 0 ? Number(actual.retencionPorcentaje) : 10)
        : 0;
    }

    if (actual) {
      const cambios = {};
      for (const [c, val] of Object.entries(campos)) if (actual[c] !== val) cambios[c] = val;
      if (Object.keys(cambios).length === 0) { resumen.sinCambios++; return; }
      Object.assign(actual, cambios); // el mapa local refleja filas repetidas del mismo archivo
      if (actual._id) {
        const id = String(actual._id);
        actualizar.set(id, { ...(actualizar.get(id) || {}), ...cambios });
      } else {
        resumen.repetidosEnArchivo++; // es un vendedor nuevo que ya venía antes en el mismo archivo
      }
    } else {
      const doc = { vendedor: n.nombre, ...campos };
      crear.set(key, doc);
      mapa.set(key, doc);
    }
  });

  resumen.creados = crear.size;
  resumen.actualizados = actualizar.size;

  return {
    crear: Array.from(crear.values()),
    actualizar: Array.from(actualizar, ([id, cambios]) => ({ id, cambios })),
    resumen,
    errores: errores.slice(0, 50),
    advertencias: advertencias.slice(0, 50),
  };
}
