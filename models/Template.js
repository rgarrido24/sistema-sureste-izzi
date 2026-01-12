import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true
    // Permitir cualquier módulo: M1, M2, M3, M4, operacion, general, etc.
  },
  content: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    default: ''
  },
  variables: [{
    type: String // Variables disponibles como {nombre}, {cuenta}, {monto}, etc.
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    default: 'admin'
  }
}, {
  timestamps: true
});

export default mongoose.model('Template', templateSchema, 'templates');

