import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'user', 'vendedor', 'director', 'usuarios', 'mesa_control', 'regionales', 'cobranza_mx', 'coordinador_claves', 'supervisor']
  },
  email: {
    type: String,
    default: '',
    trim: true
  },
  region: {
    type: String,
    default: '',
    trim: true
  },
  plazas: {
    type: [String],
    default: []
  },
  lastLoginAt: {
    type: Date,
    default: null,
  }
}, {
  timestamps: true
});

export default mongoose.model('User', userSchema);


