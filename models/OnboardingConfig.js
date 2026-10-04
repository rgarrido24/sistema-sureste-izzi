import mongoose from 'mongoose';

// Configuración del arranque (un solo documento, clave 'arranque')
const onboardingConfigSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true },
  grupoLink: { type: String, default: '' }, // liga del grupo de Mesa de Control (solo se muestra al desbloquear)
  responsableNombre: { type: String, default: '' }, // quién da seguimiento en el grupo
  diasMeta: { type: Number, default: 7 }, // plazo para el primer lead/venta

  actualizadoPorNombre: { type: String, default: '' },
  actualizadoPorUsername: { type: String, default: '' },
}, {
  timestamps: true,
});

export default mongoose.model('OnboardingConfig', onboardingConfigSchema, 'onboarding_config');
