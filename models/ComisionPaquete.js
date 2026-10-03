import mongoose from 'mongoose';

const comisionPaqueteSchema = new mongoose.Schema({
  paquete: { type: String, required: true, unique: true, trim: true },
  comisionBase: { type: Number, required: true },
}, {
  timestamps: true,
});

export default mongoose.model('ComisionPaquete', comisionPaqueteSchema, 'comisiones_paquete');
