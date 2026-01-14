import mongoose from 'mongoose';

const izziPromocionSchema = new mongoose.Schema({
  title: String,
  description: String,
  validFrom: Date,
  validTo: Date
}, {
  timestamps: true
});

export default mongoose.model('IzziPromocion', izziPromocionSchema, 'izzi_promociones');

