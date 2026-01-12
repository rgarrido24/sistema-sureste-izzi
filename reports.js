import express from 'express';
import SalesReport from '../models/SalesReport.js';

const router = express.Router();

// Obtener todos los reportes
router.get('/', async (req, res) => {
  try {
    const reports = await SalesReport.find().sort({ createdAt: -1 }).limit(50);
    res.json(reports);
  } catch (error) {
    console.error('Error obteniendo reportes:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear reporte
router.post('/', async (req, res) => {
  try {
    const { title, description, data, createdBy, module } = req.body;
    
    const report = new SalesReport({
      title,
      description,
      data,
      createdBy,
      module
    });
    
    await report.save();
    res.json(report);
  } catch (error) {
    console.error('Error creando reporte:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar todos los reportes
router.delete('/all', async (req, res) => {
  try {
    await SalesReport.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando reportes:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

