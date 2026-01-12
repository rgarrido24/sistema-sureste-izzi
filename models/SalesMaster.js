import mongoose from 'mongoose';

const salesMasterSchema = new mongoose.Schema({
  // Campos dinámicos - MongoDB permite campos flexibles
  // Se guardarán todos los campos que vengan del Excel
}, {
  timestamps: true,
  strict: false // Permite campos adicionales
});

export default mongoose.model('SalesMaster', salesMasterSchema, 'sales_master');

