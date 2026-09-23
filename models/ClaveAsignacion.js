import mongoose from 'mongoose';

const claveAsignacionSchema = new mongoose.Schema({
  // Identificador único de la clave/vendedor dentro del lote (para poder actualizar sin duplicar)
  claveId: { type: String, index: true },

  // De qué hoja del Excel vino (MX NORTE, MX CENTRO, MX SUR, etc.)
  hojaOrigen: { type: String, default: '' },

  // Auditoría: quién subió este registro y cuándo
  batchId: { type: String, index: true },
  subidoPorId: { type: String, default: '' },
  subidoPorUsername: { type: String, default: '' },
  subidoPorNombre: { type: String, default: '' },

  // Todas las columnas del Excel (REGION, SUBREGION, HUB, PLAZA, NOMBRE DEL VENDEDOR,
  // DISTRIBUIDOR, CLAVES, FECHA ALTA, FECHA BAJA, etc.) se guardan tal cual vienen.
}, {
  timestamps: true,
  strict: false,
});

claveAsignacionSchema.index({ batchId: 1 });
claveAsignacionSchema.index({ createdAt: -1 });

export default mongoose.model('ClaveAsignacion', claveAsignacionSchema, 'claves_asignacion');
