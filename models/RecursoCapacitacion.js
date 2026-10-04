import mongoose from 'mongoose';

const recursoCapacitacionSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['pregrabada', 'examen'], required: true },
  titulo: { type: String, required: true, trim: true },
  link: { type: String, required: true, trim: true },
  descripcion: { type: String, default: '' },
  orden: { type: Number, default: 0 },

  actualizadoPorNombre: { type: String, default: '' },
  actualizadoPorUsername: { type: String, default: '' },
}, {
  timestamps: true,
});

recursoCapacitacionSchema.index({ tipo: 1, orden: 1 });

export default mongoose.model('RecursoCapacitacion', recursoCapacitacionSchema, 'recursos_capacitacion');
