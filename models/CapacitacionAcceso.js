import mongoose from 'mongoose';

// Cada intento de desbloquear las pregrabadas con código (correcto o fallido)
const capacitacionAccesoSchema = new mongoose.Schema({
  usuarioId: { type: String, required: true, index: true },
  usuarioUsername: { type: String, default: '' },
  usuarioNombre: { type: String, default: '' },
  usuarioRole: { type: String, default: '' },

  exito: { type: Boolean, required: true },
  version: { type: Number, default: 1 }, // versión del código con la que se intentó
  expiraEn: { type: Date, default: null }, // solo para intentos exitosos
}, {
  timestamps: true,
});

capacitacionAccesoSchema.index({ usuarioId: 1, exito: 1, createdAt: -1 });

export default mongoose.model('CapacitacionAcceso', capacitacionAccesoSchema, 'capacitaciones_accesos');
