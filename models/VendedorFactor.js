import mongoose from 'mongoose';

// Base maestra de vendedores/subs: factor de comisión + datos de contacto.
// tipo y factor son opcionales: un vendedor puede existir en la base sin factor definido todavía.
const vendedorFactorSchema = new mongoose.Schema({
  vendedor: { type: String, required: true, unique: true, trim: true },
  tipo: { type: String, enum: ['directa', 'distribuidor'] },
  factor: { type: Number }, // 1.5-2.0 venta directa, 2.4+ distribuidores
  retencionPorcentaje: { type: Number, default: 10 }, // solo aplica si tipo === 'distribuidor'

  telefono: { type: String, default: '' },
  email: { type: String, default: '' },
  fechaNacimiento: { type: String, default: '' }, // YYYY-MM-DD

  actualizadoPorId: { type: String, default: '' },
  actualizadoPorUsername: { type: String, default: '' },
  actualizadoPorNombre: { type: String, default: '' },
}, {
  timestamps: true,
});

export default mongoose.model('VendedorFactor', vendedorFactorSchema, 'vendedor_factor');
