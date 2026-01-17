import mongoose from 'mongoose';

const knowledgePDFSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Ruta/URL del archivo (si aplica)
  url: { type: String, default: '', trim: true },
  description: { type: String, default: '', trim: true },

  // Conocimiento extraído del PDF (texto plano)
  extractedText: { type: String, default: '' },
  // Fragmentos para búsqueda (RAG simple)
  chunks: [
    {
      idx: Number,
      text: String
    }
  ],

  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export default mongoose.model('KnowledgePDF', knowledgePDFSchema, 'knowledge_pdfs');

