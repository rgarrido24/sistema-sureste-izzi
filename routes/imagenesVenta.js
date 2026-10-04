import express from 'express';
import multer from 'multer';
import ImagenVenta from '../models/ImagenVenta.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const CAN_MANAGE = ['admin', 'admin_general', 'director', 'marketing'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por imagen
  fileFilter: (req, file, cb) => {
    const ok = (file?.mimetype || '').startsWith('image/');
    if (!ok) return cb(new Error('Solo se permiten imágenes'));
    cb(null, true);
  }
});

// Listar (cualquier usuario autenticado puede ver/descargar). Incluye el base64
// para mostrar miniaturas reales en la galería (son imágenes de hasta 8MB, para
// un catálogo de material de venta esto es aceptable).
router.get('/', async (req, res) => {
  try {
    const imagenes = await ImagenVenta.find({})
      .sort({ createdAt: -1 })
      .lean();
    res.json(imagenes);
  } catch (error) {
    console.error('Error obteniendo imágenes de venta:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener una imagen completa (con su base64) para verla/descargarla
router.get('/:id', async (req, res) => {
  try {
    const imagen = await ImagenVenta.findById(req.params.id).lean();
    if (!imagen) return res.status(404).json({ error: 'No encontrada' });
    res.json(imagen);
  } catch (error) {
    console.error('Error obteniendo imagen:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Subir una nueva imagen
router.post('/', requireRoles(CAN_MANAGE), upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    const categoria = ['rgo', 'izzi', 'liga'].includes(req.body?.categoria) ? req.body.categoria : 'rgo';
    const imagen = await ImagenVenta.create({
      categoria,
      titulo: req.body?.titulo || req.file.originalname || 'Sin título',
      imagenBase64: dataUrl,
      mimetype: req.file.mimetype,
      tamanioBytes: req.file.size,
      subidoPorId: req.user?.id || '',
      subidoPorUsername: req.user?.username || '',
      subidoPorNombre: req.user?.name || req.user?.username || '',
    });

    const { imagenBase64, ...sinBase64 } = imagen.toObject();
    res.json(sinBase64);
  } catch (error) {
    console.error('Error subiendo imagen de venta:', error);
    res.status(500).json({ error: 'Error del servidor', message: error.message });
  }
});

router.post('/liga', requireRoles(CAN_MANAGE), async (req, res) => {
  try {
    const link = String(req.body?.link || '').trim();
    if (!link) return res.status(400).json({ error: 'La liga es requerida' });

    const imagen = await ImagenVenta.create({
      categoria: 'liga',
      titulo: String(req.body?.titulo || '').trim() || link,
      link,
      imagenBase64: '',
      subidoPorId: req.user?.id || '',
      subidoPorUsername: req.user?.username || '',
      subidoPorNombre: req.user?.name || req.user?.username || '',
    });

    res.json(imagen);
  } catch (error) {
    console.error('Error agregando liga de flyer:', error);
    res.status(500).json({ error: 'Error del servidor', message: error.message });
  }
});

router.delete('/:id', requireRoles(CAN_MANAGE), async (req, res) => {
  try {
    await ImagenVenta.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando imagen:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
