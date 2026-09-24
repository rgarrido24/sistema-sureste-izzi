import M0Master from '../models/M0Master.js';
import M1Master from '../models/M1Master.js';
import M2Master from '../models/M2Master.js';
import M3Master from '../models/M3Master.js';
import M4Master from '../models/M4Master.js';
import M5Master from '../models/M5Master.js';
import M6Master from '../models/M6Master.js';
import { normalizeCuenta } from './cuentaHelper.js';

const MODELS = [M0Master, M1Master, M2Master, M3Master, M4Master, M5Master, M6Master];

export function buildContactoUpdate({ telefono, notaContacto, fechaPromesaPago }) {
  const updateData = { fechaActualizacion: new Date() };

  if (telefono !== undefined) {
    updateData.Telefono1 = telefono;
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

export async function updateContactoInModel(Model, id, body) {
  const updateData = buildContactoUpdate(body);
  const doc = await Model.findByIdAndUpdate(id, updateData, { new: true });
  if (!doc) return null;

  const cuenta = normalizeCuenta(doc) || doc.cuenta;
  if (cuenta) {
    await syncContactoByCuenta(cuenta, updateData);
  }

  return doc;
}
