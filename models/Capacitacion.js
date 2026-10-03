import mongoose from 'mongoose';

const capacitacionSchema = new mongoose.Schema({
  horario: { type: String, required: true }, // ej. "09:30-11:00 AM"
  dia: {
    type: String,
    required: true,
    enum: ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'],
  },
  titulo: { type: String, default: '' }, // ej. "INDUCCION", "REDES", "IZZITV+"
  color: { type: String, default: '#fde9c8' }, // color de fondo de la celda
  link: { type: String, default: '' }, // liga de la capacitación (en vivo o pregrabada)
  orden: { type: Number, default: 0 }, // para ordenar los horarios de arriba a abajo

  actualizadoPorNombre: { type: String, default: '' },
  actualizadoPorUsername: { type: String, default: '' },
}, {
  timestamps: true,
});

capacitacionSchema.index({ dia: 1, orden: 1 });

export default mongoose.model('Capacitacion', capacitacionSchema, 'capacitaciones');
