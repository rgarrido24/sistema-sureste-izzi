import express from 'express';
import KnowledgePDF from '../models/KnowledgePDF.js';

const router = express.Router();

// Obtener todos los PDFs
router.get('/', async (req, res) => {
  try {
    const pdfs = await KnowledgePDF.find().sort({ createdAt: -1 });
    res.json(pdfs);
  } catch (error) {
    console.error('Error obteniendo PDFs:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear PDF
router.post('/', async (req, res) => {
  try {
    const { name, url, description } = req.body;
    
    const pdf = new KnowledgePDF({
      name,
      url,
      description: description || ''
    });
    
    await pdf.save();
    res.json(pdf);
  } catch (error) {
    console.error('Error creando PDF:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar PDF
router.delete('/:id', async (req, res) => {
  try {
    await KnowledgePDF.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando PDF:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

