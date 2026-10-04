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

  isActive: { type: Boolean, default: true },

  // A quién se le muestra este conocimiento en el Asistente IA.
  // 'todos' = todos los perfiles (comportamiento de siempre, ej. precios/promociones).
  // 'redes_sociales' = solo usuarios con rol redes_sociales.
  // 'venta_directa' = solo vendedores marcados como "Venta directa" en Comisiones → Vendedores.
  // Un documento puede tener varias audiencias a la vez.
  audiencias: {
    type: [String],
    enum: ['todos', 'redes_sociales', 'venta_directa'],
    default: ['todos']
  }
}, {
  timestamps: true
});

export default mongoose.model('KnowledgePDF', knowledgePDFSchema, 'knowledge_pdfs');

