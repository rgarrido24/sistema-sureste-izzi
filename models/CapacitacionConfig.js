import mongoose from 'mongoose';

// Configuración del candado de las capacitaciones pregrabadas (un solo documento, clave 'pregrabadas')
const capacitacionConfigSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true },
  codigo: { type: String, default: '' }, // código vigente (siempre en mayúsculas); vacío = acceso no activado
  version: { type: Number, default: 1 }, // sube cada vez que cambia el código → cancela accesos anteriores
  horasAcceso: { type: Number, default: 24 }, // cuánto dura el acceso una vez que meten el código correcto

  actualizadoPorNombre: { type: String, default: '' },
  actualizadoPorUsername: { type: String, default: '' },
}, {
  timestamps: true,
});

export default mongoose.model('CapacitacionConfig', capacitacionConfigSchema, 'capacitaciones_config');
