import mongoose from 'mongoose';

// Llaves propias (distintas de la sesión de un usuario) para la captura del portal y para el chatbot.
// Solo se guarda el hash: la llave se muestra una vez al crearla. Se revoca poniendo activa=false.
const integracionSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  tipo: { type: String, enum: ['captura', 'bot'], required: true },
  hash: { type: String, required: true, unique: true },
  prefijo: { type: String, default: '' },
  activa: { type: Boolean, default: true },
  ultimoUso: { type: Date },
  creadaPor: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('IntegracionEstatus', integracionSchema, 'integraciones_estatus');
