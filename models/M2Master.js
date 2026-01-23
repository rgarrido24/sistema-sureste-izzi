import mongoose from 'mongoose';

const m2MasterSchema = new mongoose.Schema({
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
    default: 'm2'
  },
  fechaCreacion: Date,
  fechaActualizacion: Date,
}, {
  timestamps: true,
  strict: false
});

m2MasterSchema.index({ cuenta: 1, estado: 1 });
m2MasterSchema.index({ 'Nº de cuenta': 1 });
m2MasterSchema.index({ 'Cuenta': 1 });
// Optimiza listados (sort por createdAt/updatedAt) y cruces por cuenta
m2MasterSchema.index({ createdAt: -1 });
m2MasterSchema.index({ updatedAt: -1 });
m2MasterSchema.index({ cuenta: 1, createdAt: -1 });

export default mongoose.model('M2Master', m2MasterSchema, 'm2_master');

