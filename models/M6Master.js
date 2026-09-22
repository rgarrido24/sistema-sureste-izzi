import mongoose from 'mongoose';

const m6MasterSchema = new mongoose.Schema({
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
    enum: ['operacion', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'],
    default: 'm6'
  },
  fechaCreacion: Date,
  fechaActualizacion: Date,
}, {
  timestamps: true,
  strict: false
});

m6MasterSchema.index({ cuenta: 1, estado: 1 });
m6MasterSchema.index({ 'Nº de cuenta': 1 });
m6MasterSchema.index({ 'Cuenta': 1 });
m6MasterSchema.index({ createdAt: -1 });
m6MasterSchema.index({ updatedAt: -1 });
m6MasterSchema.index({ cuenta: 1, createdAt: -1 });

export default mongoose.model('M6Master', m6MasterSchema, 'm6_master');
