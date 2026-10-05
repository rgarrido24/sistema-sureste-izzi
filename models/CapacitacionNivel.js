import mongoose from 'mongoose';

// Nivel de cada persona de venta directa / redes sociales en la sección de crecimiento.
// Sin registro = nivel 1. Lo sube Dirección según ventas y calidad.
const capacitacionNivelSchema = new mongoose.Schema({
  usuarioId: { type: String, required: true, unique: true, index: true },
  usuarioNombre: { type: String, default: '' },
  usuarioUsername: { type: String, default: '' },
  nivel: { type: Number, default: 1, min: 1, max: 5 },

  actualizadoPorNombre: { type: String, default: '' },
  actualizadoPorUsername: { type: String, default: '' },
}, {
  timestamps: true,
});

export default mongoose.model('CapacitacionNivel', capacitacionNivelSchema, 'capacitaciones_niveles');
