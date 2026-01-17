import mongoose from 'mongoose';

const aiUsageSchema = new mongoose.Schema(
  {
    // quién hizo la llamada
    userId: { type: String, default: '' },
    username: { type: String, default: '' },
    role: { type: String, default: '' },

    // contexto de la llamada
    endpoint: { type: String, default: 'assistant/chat' },
    model: { type: String, default: '' },

    // métricas
    promptChars: { type: Number, default: 0 },
    responseChars: { type: Number, default: 0 },
    promptTokenCount: { type: Number, default: 0 },
    candidatesTokenCount: { type: Number, default: 0 },
    totalTokenCount: { type: Number, default: 0 },

    // resultado
    success: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' }
  },
  { timestamps: true }
);

aiUsageSchema.index({ createdAt: -1 });
aiUsageSchema.index({ userId: 1, createdAt: -1 });
aiUsageSchema.index({ success: 1, createdAt: -1 });

export default mongoose.model('AiUsage', aiUsageSchema, 'ai_usage');

