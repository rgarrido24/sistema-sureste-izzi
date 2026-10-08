import mongoose from 'mongoose';

// Bitácora de lo que se pregunta al chatbot (quién, qué número) y límite diario por teléfono.
const consultaSchema = new mongoose.Schema({
  telefono: { type: String, index: true },
  vendedor: { type: String, default: '' },
  consulta: { type: String, default: '' }, // cuenta u orden preguntada
  encontrada: { type: Boolean, default: false },
  dia: { type: String, index: true }, // YYYY-MM-DD (hora de Mérida)
}, { timestamps: true });

export default mongoose.model('ConsultaEstatus', consultaSchema, 'consultas_estatus');
