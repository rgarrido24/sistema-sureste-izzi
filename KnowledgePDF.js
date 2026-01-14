import mongoose from 'mongoose';

const knowledgePDFSchema = new mongoose.Schema({
  name: String,
  url: String,
  description: String
}, {
  timestamps: true
});

export default mongoose.model('KnowledgePDF', knowledgePDFSchema, 'knowledge_pdfs');

