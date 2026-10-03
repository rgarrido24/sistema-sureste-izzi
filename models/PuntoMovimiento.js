import mongoose from 'mongoose';

const puntoMovimientoSchema = new mongoose.Schema({
  vendedor: { type: String, required: true, trim: true, index: true },
  puntos: { type: Number, required: true },
  motivo: { type: String, default: '' },
  tipo: { type: String, default: '' },
  otorgadoPorId: { type: String, default: '' },
  otorgadoPorUsername: { type: String, default: '' },
  otorgadoPorNombre: { type: String, default: '' },
}, {
  timestamps: true,
});

puntoMovimientoSchema.index({ vendedor: 1, createdAt: -1 });

export default mongoose.model('PuntoMovimiento', puntoMovimientoSchema, 'puntos_movimientos');
