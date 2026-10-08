import crypto from 'crypto';
import IntegracionEstatus from '../models/IntegracionEstatus.js';

export const hashLlave = (llave) => crypto.createHash('sha256').update(String(llave)).digest('hex');
export const generarLlave = () => `rgo_${crypto.randomBytes(24).toString('hex')}`;

// Autentica con la llave propia de la integración (cabecera X-Integracion-Key), no con la sesión de un usuario.
export const requerirLlave = (tipo) => async (req, res, next) => {
  try {
    const llave = String(req.headers['x-integracion-key'] || '').trim();
    if (!llave) return res.status(401).json({ error: 'Llave requerida' });
    const reg = await IntegracionEstatus.findOne({ hash: hashLlave(llave), activa: true, tipo });
    if (!reg) return res.status(401).json({ error: 'Llave no válida o revocada' });
    req.integracion = { id: String(reg._id), nombre: reg.nombre };
    IntegracionEstatus.updateOne({ _id: reg._id }, { ultimoUso: new Date() }).catch(() => {});
    next();
  } catch {
    res.status(503).json({ error: 'No disponible' });
  }
};
