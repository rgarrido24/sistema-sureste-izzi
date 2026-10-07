import M0Master from '../models/M0Master.js';
import M1Master from '../models/M1Master.js';
import M2Master from '../models/M2Master.js';
import M3Master from '../models/M3Master.js';
import M4Master from '../models/M4Master.js';
import M5Master from '../models/M5Master.js';
import M6Master from '../models/M6Master.js';
import { normalizeCuenta } from './cuentaHelper.js';
import ActivityEvent from '../models/ActivityEvent.js';

const MODELS = [M0Master, M1Master, M2Master, M3Master, M4Master, M5Master, M6Master];

const CAMPOS_CONTACTO = [
  'Telefono1', 'Telefono2', 'notaContacto', 'Nota Contacto', 'fechaPromesaPago', 'Fecha Promesa Pago',
  'notaContactoPorId', 'notaContactoPorNombre', 'notaContactoPorUsername', 'notaContactoFecha',
];

// Antes de un reemplazo mensual: guarda lo que el equipo capturó a mano (teléfonos, notas, promesas) por cuenta.
export async function respaldarContacto(Model) {
  const proyeccion = Object.fromEntries(CAMPOS_CONTACTO.map((c) => [c, 1]).concat([['cuenta', 1]]));
  const docs = await Model.find({}, proyeccion).lean();
  const mapa = new Map();
  for (const d of docs) {
    if (!d.cuenta) continue;
    const previo = {};
    for (const c of CAMPOS_CONTACTO) if (d[c] !== undefined && d[c] !== null && d[c] !== '') previo[c] = d[c];
    if (Object.keys(previo).length) mapa.set(d.cuenta, previo);
  }
  return mapa;
}

// Devuelve el documento nuevo con lo capturado a mano encima (lo capturado gana sobre lo del archivo).
export function restaurarContacto(doc, mapa) {
  const previo = mapa?.get(doc?.cuenta);
  return previo ? { ...doc, ...previo } : doc;
}

export function buildContactoUpdate({ telefono, telefono2, notaContacto, fechaPromesaPago }) {
  const updateData = { fechaActualizacion: new Date() };

  if (telefono !== undefined) {
    updateData.Telefono1 = telefono;
  }
  if (telefono2 !== undefined) {
    updateData.Telefono2 = telefono2;
  }
  if (notaContacto !== undefined) {
    updateData.notaContacto = notaContacto;
    updateData['Nota Contacto'] = notaContacto;
  }
  if (fechaPromesaPago !== undefined) {
    updateData.fechaPromesaPago = fechaPromesaPago;
    updateData['Fecha Promesa Pago'] = fechaPromesaPago;
  }

  return updateData;
}

export async function syncContactoByCuenta(cuenta, updateData) {
  const c = String(cuenta || '').trim();
  if (!c) return;

  await Promise.all(MODELS.map(async (Model) => {
    try {
      await Model.updateMany({ cuenta: c }, { $set: updateData });
    } catch (err) {
      console.error('syncContactoByCuenta', Model.modelName, err.message);
    }
  }));
}

export async function updateContactoInModel(Model, id, body, user) {
  const updateData = buildContactoUpdate(body);
  if (body?.notaContacto !== undefined && user) {
    const ahora = new Date();
    updateData.notaContactoPorId = user.id || '';
    updateData.notaContactoPorNombre = user.name || user.username || '';
    updateData.notaContactoPorUsername = user.username || '';
    updateData.notaContactoFecha = ahora;
  }

  const doc = await Model.findByIdAndUpdate(id, updateData, { new: true });
  if (!doc) return null;

  const cuenta = normalizeCuenta(doc) || doc.cuenta;
  if (cuenta) {
    await syncContactoByCuenta(cuenta, updateData);
  }

  if (body?.notaContacto !== undefined && user) {
    try {
      await ActivityEvent.create({
        type: 'nota',
        module: String(Model.modelName || '').replace(/Master$/i, '').toLowerCase(),
        userId: user.id,
        username: user.username || '',
        role: user.role || '',
        region: user.region || '',
        meta: {
          cuenta: cuenta || '',
          nota: String(body.notaContacto || '').slice(0, 240),
        },
      });
    } catch (err) {
      console.warn('No se pudo registrar ActivityEvent nota:', err.message);
    }
  }

  return doc;
}
