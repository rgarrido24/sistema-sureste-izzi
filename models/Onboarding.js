import mongoose from 'mongoose';

// Estado de cada paso del arranque de un usuario de Redes Sociales.
// La definición de los pasos (título, tipo, reglas) vive en routes/arranque.js;
// aquí solo se guarda el avance, por clave de paso.
const pasoSchema = new mongoose.Schema({
  clave: { type: String, required: true },
  completado: { type: Boolean, default: false },
  completadoEn: { type: Date, default: null },
  completadoPor: { type: String, default: '' }, // 'usuario' | 'staff'
  completadoPorNombre: { type: String, default: '' },
  evidencias: { type: [String], default: [] }, // links que entregó como prueba
  nota: { type: String, default: '' },
}, { _id: false });

const onboardingSchema = new mongoose.Schema({
  usuarioId: { type: String, required: true, unique: true, index: true },
  usuarioUsername: { type: String, default: '' },
  usuarioNombre: { type: String, default: '' },
  reclutadorNombre: { type: String, default: '' },
  reclutadorId: { type: String, default: '', index: true }, // usuario con rol reclutador (para que vea a sus reclutados)
  // redes = hace el checklist completo de "Mi Arranque"; directa = venta directa (solo se le da seguimiento a capacitación y primer lead)
  perfil: { type: String, enum: ['redes', 'directa'], default: 'redes' },

  altaEn: { type: Date, default: Date.now },
  ultimoAvanceEn: { type: Date, default: Date.now }, // solo cuenta cuando se completa un paso

  pasos: { type: [pasoSchema], default: [] },

  atorado: {
    activo: { type: Boolean, default: false },
    mensaje: { type: String, default: '' },
    desde: { type: Date, default: null },
  },

  liberado: { type: Boolean, default: false }, // Mesa de Control lo libera si no avanza en el plazo
}, {
  timestamps: true,
});

export default mongoose.model('Onboarding', onboardingSchema, 'onboardings');
