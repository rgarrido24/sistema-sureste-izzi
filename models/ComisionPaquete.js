import mongoose from 'mongoose';

const comisionPaqueteSchema = new mongoose.Schema({
  paquete: { type: String, required: true, unique: true, trim: true },
  clave: { type: String, default: '' }, // Cve de la tabla de Izzi (ej. TI100M2)
  categoria: { type: String, enum: ['triple', 'doble', 'single'] },
  comisionBase: { type: Number, required: true },
  // Cómo aparece este paquete en la cobranza cuando no coincide con el catálogo
  // (se asigna desde el sistema, en "Paquetes sin comisión base")
  alias: { type: [String], default: [] },
}, {
  timestamps: true,
});

export default mongoose.model('ComisionPaquete', comisionPaqueteSchema, 'comisiones_paquete');
