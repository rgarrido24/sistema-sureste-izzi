import mongoose from 'mongoose';

const m4MasterSchema = new mongoose.Schema({
  cuenta: {
    type: String,
    required: true,
    index: true
  },
  'Nº de cuenta': String,
  'Cuenta': String,
  'N° de cuenta': String,
  estado: {
    type: String,
    enum: ['Abierta', 'Completa', 'Cancelada', 'Not done'],
    default: 'Abierta'
  },
  origen: {
    type: String,
    enum: ['operacion', 'm1', 'm2', 'm3', 'm4'],
    default: 'm4'
  },
  fechaCreacion: Date,
  fechaActualizacion: Date,
}, {
  timestamps: true,
  strict: false
});

m4MasterSchema.index({ cuenta: 1, estado: 1 });
m4MasterSchema.index({ 'Nº de cuenta': 1 });
m4MasterSchema.index({ 'Cuenta': 1 });
// Optimiza listados (sort por createdAt/updatedAt) y cruces por cuenta
m4MasterSchema.index({ createdAt: -1 });
m4MasterSchema.index({ updatedAt: -1 });
m4MasterSchema.index({ cuenta: 1, createdAt: -1 });

export default mongoose.model('M4Master', m4MasterSchema, 'm4_master');

