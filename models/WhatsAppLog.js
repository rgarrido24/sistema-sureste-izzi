import mongoose from 'mongoose';

const whatsappLogSchema = new mongoose.Schema({
  cuenta: { type: String, index: true },
  telefono: String,
  modulo: { type: String, enum: ['m0', 'm1', 'm2', 'm3', 'm4'], index: true },
  templateName: String,
  languageCode: String,
  status: {
    type: String,
    enum: ['enviado', 'error', 'omitido_sin_telefono'],
    default: 'enviado',
    index: true
  },
  providerMessageId: String,
  errorMessage: String,
  sentBy: String, // username de quien disparó el envío masivo
  batchId: { type: String, index: true }, // agrupa todos los envíos de una misma corrida
}, {
  timestamps: true
});

whatsappLogSchema.index({ createdAt: -1 });
whatsappLogSchema.index({ batchId: 1, status: 1 });

export default mongoose.model('WhatsAppLog', whatsappLogSchema, 'whatsapp_logs');
