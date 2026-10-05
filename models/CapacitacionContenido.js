import mongoose from 'mongoose';

// Contenido de dos secciones de capacitación:
//  - 'izzi': capacitaciones que manda Izzi directamente (constantes, abiertas para todos)
//  - 'crecimiento': contenido exclusivo de venta directa y redes sociales, organizado por niveles
const capacitacionContenidoSchema = new mongoose.Schema({
  seccion: { type: String, enum: ['izzi', 'crecimiento'], required: true, index: true },
  titulo: { type: String, required: true, trim: true },
  descripcion: { type: String, default: '' },
  link: { type: String, required: true, trim: true },
  nivel: { type: Number, default: 1, min: 1, max: 5 }, // solo 'crecimiento'
  fecha: { type: Date, default: Date.now }, // solo 'izzi': fecha de la capacitación / de cuando llegó

  actualizadoPorNombre: { type: String, default: '' },
  actualizadoPorUsername: { type: String, default: '' },
}, {
  timestamps: true,
});

capacitacionContenidoSchema.index({ seccion: 1, nivel: 1, createdAt: 1 });

export default mongoose.model('CapacitacionContenido', capacitacionContenidoSchema, 'capacitaciones_contenido');
