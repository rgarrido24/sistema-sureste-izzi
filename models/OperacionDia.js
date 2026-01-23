import mongoose from 'mongoose';

const operacionDiaSchema = new mongoose.Schema({
  // Número de cuenta - clave única para relaciones
  cuenta: {
    type: String,
    required: true,
    index: true
  },
  // Variaciones del campo cuenta
  'Nº de cuenta': String,
  'Cuenta': String,
  'N° de cuenta': String,
  'Nº de orden': String,
  'Orden': String,
  // Estado del registro
  estado: {
    type: String,
    enum: ['Abierta', 'Completa', 'Cancelada', 'Not done'],
    default: 'Abierta'
  },
  // Origen del registro
  origen: {
    type: String,
    enum: ['operacion', 'm1', 'm2', 'm3', 'm4'],
    default: 'operacion'
  },
  // Fecha de creación en el sistema
  fechaCreacion: Date,
  // Fecha de última actualización
  fechaActualizacion: Date,
  // Vendedor asignado
  VendedorAsignado: String,
  Vendedor: String,
}, {
  timestamps: true,
  strict: false // Permite campos adicionales del Excel
});

// Índices para búsquedas rápidas
operacionDiaSchema.index({ cuenta: 1, estado: 1 });
operacionDiaSchema.index({ 'Nº de cuenta': 1 });
operacionDiaSchema.index({ 'Cuenta': 1 });
operacionDiaSchema.index({ estado: 1 });
// Optimiza listados (sort por createdAt/updatedAt) y cruces por cuenta
operacionDiaSchema.index({ createdAt: -1 });
operacionDiaSchema.index({ updatedAt: -1 });
operacionDiaSchema.index({ cuenta: 1, createdAt: -1 });

export default mongoose.model('OperacionDia', operacionDiaSchema, 'operacion_dia');

