import express from 'express';
import Capacitacion from '../models/Capacitacion.js';
import CapacitacionVista from '../models/CapacitacionVista.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const CAN_EDIT = ['admin', 'admin_general', 'director'];
const CAN_VER_VISTAS = ['admin', 'admin_general', 'director', 'marketing'];

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

// Registrar que un usuario abrió el link de una celda (cualquier autenticado)
router.post('/:id/vista', async (req, res) => {
  try {
    const celda = await Capacitacion.findById(req.params.id).lean();
    if (!celda) return res.status(404).json({ error: 'No encontrada' });

    await CapacitacionVista.create({
      capacitacionId: celda._id,
      horario: celda.horario,
      dia: celda.dia,
      titulo: celda.titulo,
      usuarioId: req.user?.id || '',
      usuarioUsername: req.user?.username || '',
      usuarioNombre: req.user?.name || req.user?.username || '',
      usuarioRole: req.user?.role || '',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error registrando vista de capacitación:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Conteo de vistas por celda (para mostrar el ojito con número)
router.get('/vistas/conteo', requireRoles(CAN_VER_VISTAS), async (req, res) => {
  try {
    const conteos = await CapacitacionVista.aggregate([
      { $group: { _id: '$capacitacionId', total: { $sum: 1 } } }
    ]);
    const resultado = {};
    conteos.forEach(c => { resultado[c._id.toString()] = c.total; });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Quién vio una celda específica
router.get('/:id/vistas', requireRoles(CAN_VER_VISTAS), async (req, res) => {
  try {
    const vistas = await CapacitacionVista.find({ capacitacionId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(vistas);
  } catch (error) {
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
