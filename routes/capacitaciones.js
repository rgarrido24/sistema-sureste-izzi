import express from 'express';
import Capacitacion from '../models/Capacitacion.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const CAN_EDIT = ['admin', 'admin_general', 'director'];

// Cualquier usuario autenticado puede VER el calendario
router.get('/', async (req, res) => {
  try {
    const celdas = await Capacitacion.find({}).sort({ orden: 1, dia: 1 }).lean();
    res.json(celdas);
  } catch (error) {
    console.error('Error obteniendo capacitaciones:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear o actualizar una celda (upsert por horario+dia)
router.post('/', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const { horario, dia, titulo, color, link, orden } = req.body;
    if (!horario || !dia) {
      return res.status(400).json({ error: 'Falta horario o día' });
    }

    const celda = await Capacitacion.findOneAndUpdate(
      { horario, dia },
      {
        horario, dia,
        titulo: titulo || '',
        color: color || '#fde9c8',
        link: link || '',
        orden: orden ?? 0,
        actualizadoPorNombre: req.user?.name || req.user?.username || '',
        actualizadoPorUsername: req.user?.username || '',
      },
      { upsert: true, new: true }
    );

    res.json(celda);
  } catch (error) {
    console.error('Error guardando celda de capacitación:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/:id', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    await Capacitacion.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando celda de capacitación:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
