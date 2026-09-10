import mongoose from 'mongoose';

const m0MasterSchema = new mongoose.Schema({
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
    enum: ['operacion', 'm0', 'm1', 'm2', 'm3', 'm4'],
    default: 'm0'
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
m0MasterSchema.index({ cuenta: 1, estado: 1 });
m0MasterSchema.index({ 'Nº de cuenta': 1 });
m0MasterSchema.index({ 'Cuenta': 1 });
m0MasterSchema.index({ createdAt: -1 });
m0MasterSchema.index({ updatedAt: -1 });
m0MasterSchema.index({ cuenta: 1, createdAt: -1 });

export default mongoose.model('M0Master', m0MasterSchema, 'm0_master');
