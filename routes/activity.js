import express from 'express';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import ActivityEvent from '../models/ActivityEvent.js';
import User from '../models/User.js';
import M1Master from '../models/M1Master.js';
import M2Master from '../models/M2Master.js';
import M3Master from '../models/M3Master.js';
import M4Master from '../models/M4Master.js';
import SalesMaster from '../models/SalesMaster.js';

const router = express.Router();
router.use(requireAuth);

async function fallbackCobranzaLastUploads() {
  // Si todavía no hay ActivityEvents (primera vez después de deploy),
  // inferir "última actualización" por colección.
  const sources = [
    { module: 'm1', model: M1Master },
    { module: 'm2', model: M2Master },
    { module: 'm3', model: M3Master },
    { module: 'm4', model: M4Master },
    { module: 'sales', model: SalesMaster },
  ];

  const results = [];
  for (const s of sources) {
    const doc = await s.model
      .findOne({}, { updatedAt: 1, createdAt: 1, fechaActualizacion: 1, fechaCreacion: 1 })
      .sort({ updatedAt: -1, createdAt: -1, fechaActualizacion: -1, fechaCreacion: -1 })
      .lean();
    const lastAt = doc?.updatedAt || doc?.fechaActualizacion || doc?.createdAt || doc?.fechaCreacion || null;
    results.push({ _id: s.module, lastAt, byUsername: '', byRole: '', meta: { inferred: true } });
  }
  return results;
}

// Log de WhatsApp (se llama desde frontend antes de abrir el link)
router.post('/whatsapp', async (req, res) => {
  try {
    // Seguridad extra: directores no pueden enviar WhatsApp
    if (req.user?.role === 'director') {
      return res.status(403).json({ error: 'El rol director no puede enviar WhatsApp.' });
    }

    const { module = 'cobranza', status = '', cuenta = '', phone = '' } = req.body || {};

    // Enmascarar teléfono (no guardar el número completo)
    const phoneStr = String(phone || '').replace(/[^\d+]/g, '');
    const maskedPhone =
      phoneStr.length >= 6
        ? `${phoneStr.slice(0, 2)}***${phoneStr.slice(-2)}`
        : (phoneStr ? '***' : '');

    await ActivityEvent.create({
      type: 'whatsapp',
      module: String(module || 'cobranza'),
      userId: req.user?.id,
      username: req.user?.username || '',
      role: req.user?.role || '',
      region: req.user?.region || '',
      meta: {
        status: String(status || ''),
        cuenta: String(cuenta || ''),
        phone: maskedPhone,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error registrando evento WhatsApp:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Dashboard de actividad (solo admin)
router.get('/admin/summary', requireRoles(['admin', 'admin_general']), async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 }).lean();

    const userIds = users.map(u => u._id);

    // Último upload de cobranza por usuario (M1-M4 y SalesMaster)
    const cobranzaModules = ['m1', 'm2', 'm3', 'm4', 'sales'];
    const lastUploadByUser = await ActivityEvent.aggregate([
      { $match: { type: 'upload', module: { $in: cobranzaModules }, userId: { $in: userIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$userId',
          lastCobranzaUploadAt: { $first: '$createdAt' },
          lastCobranzaUploadModule: { $first: '$module' },
          lastCobranzaUploadMeta: { $first: '$meta' },
        },
      },
    ]);
    const lastUploadMap = new Map(lastUploadByUser.map(r => [String(r._id), r]));

    // WhatsApp eventos (solo cobranza) por usuario
    const whatsappByUser = await ActivityEvent.aggregate([
      { $match: { type: 'whatsapp', module: 'cobranza', userId: { $in: userIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$userId',
          lastWhatsAppAt: { $first: '$createdAt' },
          whatsappCount: { $sum: 1 },
        },
      },
    ]);
    const whatsappMap = new Map(whatsappByUser.map(r => [String(r._id), r]));

    // Última actualización global de cobranza por módulo
    const lastUploadByModule = await ActivityEvent.aggregate([
      { $match: { type: 'upload', module: { $in: cobranzaModules } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$module',
          lastAt: { $first: '$createdAt' },
          byUsername: { $first: '$username' },
          byRole: { $first: '$role' },
          meta: { $first: '$meta' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const lastUploadByModuleFinal =
      Array.isArray(lastUploadByModule) && lastUploadByModule.length > 0
        ? lastUploadByModule
        : await fallbackCobranzaLastUploads();

    const rows = users.map(u => {
      const upload = lastUploadMap.get(String(u._id));
      const wa = whatsappMap.get(String(u._id));
      return {
        id: String(u._id),
        username: u.username,
        name: u.name,
        role: u.role,
        region: u.region || '',
        lastLoginAt: u.lastLoginAt || null,
        lastCobranzaUploadAt: upload?.lastCobranzaUploadAt || null,
        lastCobranzaUploadModule: upload?.lastCobranzaUploadModule || null,
        lastCobranzaUploadMeta: upload?.lastCobranzaUploadMeta || null,
        lastWhatsAppAt: wa?.lastWhatsAppAt || null,
        whatsappCount: wa?.whatsappCount || 0,
      };
    });

    res.json({
      users: rows,
      cobranzaLastUploads: lastUploadByModuleFinal,
    });
  } catch (error) {
    console.error('Error obteniendo dashboard de actividad:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Para mostrar "Última actualización" (visible para todos)
router.get('/cobranza/last-update', async (req, res) => {
  try {
    const cobranzaModules = ['m1', 'm2', 'm3', 'm4', 'sales'];
    const lastUploadByModule = await ActivityEvent.aggregate([
      { $match: { type: 'upload', module: { $in: cobranzaModules } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$module',
          lastAt: { $first: '$createdAt' },
          byUsername: { $first: '$username' },
          byRole: { $first: '$role' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    if (!lastUploadByModule || lastUploadByModule.length === 0) {
      const inferred = await fallbackCobranzaLastUploads();
      return res.json({ cobranzaLastUploads: inferred });
    }
    res.json({ cobranzaLastUploads: lastUploadByModule });
  } catch (error) {
    console.error('Error obteniendo last-update cobranza:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

