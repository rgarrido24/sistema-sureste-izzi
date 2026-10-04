import express from 'express';
import PuntoMovimiento from '../models/PuntoMovimiento.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const CAN_OTORGAR = ['admin', 'admin_general', 'director'];
const CAN_VER_TODOS = ['admin', 'admin_general', 'director', 'supervisor', 'regionales', 'mesa_control'];

router.get('/mis-puntos', async (req, res) => {
  try {
    const nombre = String(req.user?.name || '').trim();
    if (!nombre) return res.json({ total: 0, movimientos: [] });

    const movimientos = await PuntoMovimiento.find({
      vendedor: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    }).sort({ createdAt: -1 }).lean();

    const total = movimientos.reduce((sum, m) => sum + (Number(m.puntos) || 0), 0);
    res.json({ total, movimientos });
  } catch (error) {
    console.error('Error obteniendo mis puntos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/todos', async (req, res) => {
  try {
    if (!CAN_VER_TODOS.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const agregados = await PuntoMovimiento.aggregate([
      { $group: { _id: { $toUpper: { $trim: { input: '$vendedor' } } }, total: { $sum: '$puntos' }, vendedor: { $last: '$vendedor' } } },
      { $project: { _id: 0, vendedor: 1, total: 1 } },
      { $sort: { total: -1 } },
    ]);
    res.json(agregados);
  } catch (error) {
    console.error('Error obteniendo puntos de todos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!CAN_OTORGAR.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sin permisos para otorgar puntos' });
    }

    const vendedor = String(req.body?.vendedor || '').trim();
    const puntos = Number(req.body?.puntos);
    const motivo = String(req.body?.motivo || '').trim();
    const tipo = String(req.body?.tipo || '').trim();

    if (!vendedor || !Number.isFinite(puntos) || puntos === 0) {
      return res.status(400).json({ error: 'Vendedor y puntos distintos de cero son requeridos' });
    }

    const mov = await PuntoMovimiento.create({
      vendedor,
      puntos,
      motivo,
      tipo,
      otorgadoPorId: req.user?.id || '',
      otorgadoPorUsername: req.user?.username || '',
      otorgadoPorNombre: req.user?.name || '',
    });

    res.json(mov);
  } catch (error) {
    console.error('Error otorgando puntos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
