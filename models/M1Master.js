import mongoose from 'mongoose';

const m1MasterSchema = new mongoose.Schema({
  // Número de cuenta - clave única para relaciones
  cuenta: {
    type: String,
    required: true,
    index: true
  },
  // Variaciones del campo cuenta para búsqueda flexible
  'Nº de cuenta': String,
  'Cuenta': String,
  'N° de cuenta': String,
  // Estado del registro
  estado: {
    type: String,
    enum: ['Abierta', 'Completa', 'Cancelada', 'Not done'],
    default: 'Abierta'
  },
  // Origen del registro (de dónde viene)
  origen: {
    type: String,
    enum: ['operacion', 'm1', 'm2', 'm3', 'm4'],
    default: 'm1'
  },
  // Fecha de creación en el sistema
  fechaCreacion: Date,
  // Fecha de última actualización
  fechaActualizacion: Date,
  // Campos dinámicos del Excel
}, {
  timestamps: true,
  strict: false // Permite campos adicionales del Excel
});

// Índice compuesto para búsquedas rápidas
m1MasterSchema.index({ cuenta: 1, estado: 1 });
m1MasterSchema.index({ 'Nº de cuenta': 1 });
m1MasterSchema.index({ 'Cuenta': 1 });
// Optimiza listados (sort por createdAt/updatedAt) y cruces por cuenta
m1MasterSchema.index({ createdAt: -1 });
m1MasterSchema.index({ updatedAt: -1 });
m1MasterSchema.index({ cuenta: 1, createdAt: -1 });

export default mongoose.model('M1Master', m1MasterSchema, 'm1_master');

