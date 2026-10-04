import mongoose from 'mongoose';

const capacitacionVistaSchema = new mongoose.Schema({
  // Exactamente uno de los dos: celda del calendario semanal, o recurso (pregrabada/examen)
  capacitacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Capacitacion', index: true },
  recursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecursoCapacitacion', index: true },
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
