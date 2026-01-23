import mongoose from 'mongoose';

const m3MasterSchema = new mongoose.Schema({
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
    default: 'm3'
  },
  fechaCreacion: Date,
  fechaActualizacion: Date,
}, {
  timestamps: true,
  strict: false
});

m3MasterSchema.index({ cuenta: 1, estado: 1 });
m3MasterSchema.index({ 'Nº de cuenta': 1 });
m3MasterSchema.index({ 'Cuenta': 1 });
// Optimiza listados (sort por createdAt/updatedAt) y cruces por cuenta
m3MasterSchema.index({ createdAt: -1 });
m3MasterSchema.index({ updatedAt: -1 });
m3MasterSchema.index({ cuenta: 1, createdAt: -1 });

export default mongoose.model('M3Master', m3MasterSchema, 'm3_master');

