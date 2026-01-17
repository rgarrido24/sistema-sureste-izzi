import express from 'express';
import KnowledgePDF from '../models/KnowledgePDF.js';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const ok = file?.mimetype === 'application/pdf' || (file?.originalname || '').toLowerCase().endsWith('.pdf');
    if (!ok) return cb(new Error('Solo se permiten archivos PDF'));
    cb(null, true);
  }
});

function chunkText(text, { chunkSize = 1400, overlap = 150 } = {}) {
  const clean = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  if (!clean) return [];
  const chunks = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + chunkSize, clean.length);
    const slice = clean.slice(i, end);
    chunks.push(slice);
    if (end >= clean.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

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
router.post('/', requireRoles(['admin', 'admin_general', 'mesa_control']), async (req, res) => {
  try {
    const { name, url, description } = req.body;
    
    const pdf = new KnowledgePDF({
      name,
      url,
      description: description || '',
      isActive: true
    });
    
    await pdf.save();
    res.json(pdf);
  } catch (error) {
    console.error('Error creando PDF:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Subir PDF (archivo) y extraer conocimiento (RAG)
router.post('/upload', requireRoles(['admin', 'admin_general', 'mesa_control']), upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    const name = (req.body?.name || file?.originalname || 'PDF').toString().trim();
    const description = (req.body?.description || '').toString().trim();

    if (!file) {
      return res.status(400).json({ error: 'No se recibió archivo PDF' });
    }

    const parsed = await pdfParse(file.buffer);
    const extractedText = (parsed?.text || '').trim();
    const chunksRaw = chunkText(extractedText);
    const chunks = chunksRaw.slice(0, 300).map((t, idx) => ({ idx, text: t })); // cap de seguridad

    const doc = await KnowledgePDF.create({
      name,
      url: '',
      description,
      extractedText,
      chunks,
      isActive: true
    });

    res.json({
      success: true,
      pdf: doc,
      stats: { chars: extractedText.length, chunks: chunks.length }
    });
  } catch (error) {
    console.error('Error subiendo/extrayendo PDF:', error);
    res.status(500).json({ error: error.message || 'Error del servidor' });
  }
});

// Activar/desactivar PDF de conocimiento
router.put('/:id', requireRoles(['admin', 'admin_general', 'mesa_control']), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, name, description } = req.body || {};

    const update = {};
    if (typeof isActive === 'boolean') update.isActive = isActive;
    if (name !== undefined) update.name = String(name).trim();
    if (description !== undefined) update.description = String(description).trim();

    const updated = await KnowledgePDF.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return res.status(404).json({ error: 'PDF no encontrado' });
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando PDF:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar PDF
router.delete('/:id', requireRoles(['admin', 'admin_general', 'mesa_control']), async (req, res) => {
  try {
    await KnowledgePDF.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando PDF:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

