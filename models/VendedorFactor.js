import mongoose from 'mongoose';

const vendedorFactorSchema = new mongoose.Schema({
  vendedor: { type: String, required: true, unique: true, trim: true },
  tipo: { type: String, enum: ['directa', 'distribuidor'], required: true },
  factor: { type: Number, required: true }, // 1.5-2.0 venta directa, 2.4+ distribuidores
  retencionPorcentaje: { type: Number, default: 10 }, // solo aplica si tipo === 'distribuidor'

  actualizadoPorId: { type: String, default: '' },
  actualizadoPorUsername: { type: String, default: '' },
  actualizadoPorNombre: { type: String, default: '' },
}, {
  timestamps: true,
});

export default mongoose.model('VendedorFactor', vendedorFactorSchema, 'vendedor_factor');
