import mongoose from 'mongoose';

// Foto diaria de la cosecha M1 (conteos agrupados, sin datos de clientes) para ver la tendencia día con día.
const m1FotoSchema = new mongoose.Schema({
  fecha: { type: String, required: true, unique: true }, // YYYY-MM-DD (hora de Mérida)
  actualizadoEn: { type: Date, default: Date.now },
  filas: { type: [mongoose.Schema.Types.Mixed], default: [] }, // { region, subregion, hub, plaza, vendedor, total, corriente, m1, perdida }
}, { timestamps: true });

export default mongoose.model('M1Foto', m1FotoSchema, 'm1_fotos');
