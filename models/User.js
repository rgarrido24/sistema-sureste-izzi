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
    enum: ['admin', 'user', 'vendedor', 'director', 'usuarios', 'mesa_control', 'regionales']
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
  }
}, {
  timestamps: true
});

export default mongoose.model('User', userSchema);

