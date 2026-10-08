import mongoose from 'mongoose';

// "Actualizar ahora": cuentas/órdenes que alguien pidió y que la persona con acceso al portal debe revisar.
const solicitudSchema = new mongoose.Schema({
  consulta: { type: String, required: true, index: true },
  tipo: { type: String, enum: ['cuenta', 'orden'], default: 'cuenta' },
  solicitadoPor: { type: String, default: '' },
  atendida: { type: Boolean, default: false, index: true },
  atendidaEn: { type: Date },
}, { timestamps: true });

export default mongoose.model('SolicitudEstatus', solicitudSchema, 'solicitudes_estatus');
