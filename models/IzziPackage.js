import mongoose from 'mongoose';

const izziPackageSchema = new mongoose.Schema({
  codigo: {
    type: String,
    required: false,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  description: String,
  tipo: {
    type: String,
    enum: ['TRIPLE', 'DOBLE', 'SINGLE'],
    required: false
  }
}, {
  timestamps: true
});

export default mongoose.model('IzziPackage', izziPackageSchema, 'izzi_packages');

