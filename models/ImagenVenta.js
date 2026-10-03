import mongoose from 'mongoose';

const imagenVentaSchema = new mongoose.Schema({
  titulo: { type: String, default: '' },
  imagenBase64: { type: String, required: true }, // data URL completo (data:image/...;base64,...)
  mimetype: { type: String, default: 'image/png' },
  tamanioBytes: { type: Number, default: 0 },

  subidoPorId: { type: String, default: '' },
  subidoPorUsername: { type: String, default: '' },
  subidoPorNombre: { type: String, default: '' },
}, {
  timestamps: true,
});

imagenVentaSchema.index({ createdAt: -1 });

export default mongoose.model('ImagenVenta', imagenVentaSchema, 'imagenes_venta');
