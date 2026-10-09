import M1Master from '../models/M1Master.js';
import M1Foto from '../models/M1Foto.js';
import { fotoDeItems } from './analisisM1.js';
import { diaMerida } from './estatusOrdenes.js';

// Guarda (o actualiza) la foto de HOY. Si se llama varias veces en el día, la última gana.
export async function guardarFotoM1(items = null) {
  const m1 = items || await M1Master.find({}).lean();
  if (!m1.length) return null; // no se guarda una foto vacía (p. ej. mientras se reemplaza la cosecha)
  const fecha = diaMerida();
  await M1Foto.updateOne({ fecha }, { $set: { filas: fotoDeItems(m1), actualizadoEn: new Date() } }, { upsert: true });
  return fecha;
}
