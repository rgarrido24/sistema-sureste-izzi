import mongoose from 'mongoose';

const m5MasterSchema = new mongoose.Schema({
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
    enum: ['operacion', 'm1', 'm2', 'm3', 'm4', 'm5'],
    default: 'm5'
  },
  fechaCreacion: Date,
  fechaActualizacion: Date,
}, {
  timestamps: true,
  strict: false
});

m5MasterSchema.index({ cuenta: 1, estado: 1 });
m5MasterSchema.index({ 'Nº de cuenta': 1 });
m5MasterSchema.index({ 'Cuenta': 1 });
m5MasterSchema.index({ createdAt: -1 });
m5MasterSchema.index({ updatedAt: -1 });
m5MasterSchema.index({ cuenta: 1, createdAt: -1 });

export default mongoose.model('M5Master', m5MasterSchema, 'm5_master');
