import mongoose from 'mongoose';

const capacitacionVistaSchema = new mongoose.Schema({
  capacitacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Capacitacion', required: true, index: true },
  horario: { type: String, default: '' },
  dia: { type: String, default: '' },
  titulo: { type: String, default: '' },

  usuarioId: { type: String, default: '' },
  usuarioUsername: { type: String, default: '' },
  usuarioNombre: { type: String, default: '' },
  usuarioRole: { type: String, default: '' },
}, {
  timestamps: true,
});

capacitacionVistaSchema.index({ capacitacionId: 1, createdAt: -1 });

export default mongoose.model('CapacitacionVista', capacitacionVistaSchema, 'capacitaciones_vistas');
