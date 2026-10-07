import mongoose from 'mongoose';

const imagenVentaSchema = new mongoose.Schema({
  // 'rgo' = material propio subido por RGO (comportamiento original, default para no romper lo ya subido)
  // 'izzi' = material que manda Izzi mes con mes
  // 'reclutamiento' = material para reclutar; solo lo ven supervisores, regionales, directores, reclutamiento y marketing
  // 'liga' = no es un archivo, es solo un link a un flyer digital externo
  categoria: { type: String, enum: ['rgo', 'izzi', 'liga', 'reclutamiento'], default: 'rgo' },

  titulo: { type: String, default: '' },
  imagenBase64: { type: String, default: '' }, // data URL completo; vacío si categoria === 'liga'
  link: { type: String, default: '' }, // solo para categoria === 'liga'
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
