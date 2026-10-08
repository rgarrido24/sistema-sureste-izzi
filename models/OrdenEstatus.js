import mongoose from 'mongoose';

// Estatus de una orden en el portal de distribuidores de Izzi, capturado por una persona (extensión/marcador).
// NO guarda datos del cliente (nombre, teléfono, dirección): solo lo necesario para responder el estatus.
const cambioSchema = new mongoose.Schema({
  en: { type: Date, default: Date.now },
  fuente: { type: String, default: '' }, // 'detalle' | 'ruta'
  estado: { type: String, default: '' },
  estadoAdmision: { type: String, default: '' },
  motivoCancelacion: { type: String, default: '' },
  fechaSolicitada: { type: String, default: '' },
  horario: { type: String, default: '' },
  posicionEnRuta: { type: String, default: '' },
  pendienteEnRuta: { type: Boolean, default: null },
}, { _id: false });

const ordenEstatusSchema = new mongoose.Schema({
  numOrden: { type: String, required: true, unique: true, trim: true },
  cuenta: { type: String, default: '', index: true },
  hub: { type: String, default: '' },
  rpt: { type: String, default: '' },
  tipoOrden: { type: String, default: '' },
  referido: { type: String, default: '' },
  fechaOrden: { type: String, default: '' },
  estado: { type: String, default: '' },
  vendedorCodigo: { type: String, default: '' },
  fechaSolicitada: { type: String, default: '' },
  total: { type: String, default: '' },
  motivoOrden: { type: String, default: '' },
  motivoCancelacion: { type: String, default: '' },
  medioVerificacion: { type: String, default: '' },
  estadoAdmision: { type: String, default: '' },
  horario: { type: String, default: '' },
  posicionEnRuta: { type: String, default: '' },
  pendienteEnRuta: { type: Boolean, default: null },

  actualizadoEn: { type: Date, default: Date.now },
  capturadoPor: { type: String, default: '' },
  historial: { type: [cambioSchema], default: [] },
}, { timestamps: true });

export default mongoose.model('OrdenEstatus', ordenEstatusSchema, 'ordenes_estatus');
