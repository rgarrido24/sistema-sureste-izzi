import express from 'express';
import IzziPromocion from '../models/IzziPromocion.js';

const router = express.Router();

// Obtener todas las promociones
router.get('/', async (req, res) => {
  try {
    const promociones = await IzziPromocion.find().sort({ createdAt: -1 });
    res.json(promociones);
  } catch (error) {
    console.error('Error obteniendo promociones:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear promoción
router.post('/', async (req, res) => {
  try {
    const { title, description, validFrom, validTo } = req.body;
    
    const promocion = new IzziPromocion({
      title,
      description,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo ? new Date(validTo) : undefined
    });
    
    await promocion.save();
    res.json(promocion);
  } catch (error) {
    console.error('Error creando promoción:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar promoción
router.delete('/:id', async (req, res) => {
  try {
    await IzziPromocion.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando promoción:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

