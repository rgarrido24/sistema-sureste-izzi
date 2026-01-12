import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear carpeta de uploads si no existe
const uploadsDir = path.join(__dirname, '../uploads/videos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar multer para videos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre único: timestamp + nombre original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// Filtrar solo archivos de video
const fileFilter = (req, file, cb) => {
  if (!file) {
    return cb(new Error('No se proporcionó archivo'));
  }
  
  const allowedTypes = /mp4|avi|mov|wmv|flv|webm|mkv/;
  const extname = allowedTypes.test(path.extname(file.originalname || '').toLowerCase());
  const mimetype = file.mimetype && (allowedTypes.test(file.mimetype) || file.mimetype.startsWith('video/'));

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de video (mp4, avi, mov, wmv, flv, webm, mkv)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB máximo
  },
  fileFilter: fileFilter
});

// Ruta para subir video
router.post('/video', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    // URL relativa para acceder al video
    const videoUrl = `/api/uploads/videos/${req.file.filename}`;
    
    res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: videoUrl,
      message: 'Video subido correctamente'
    });
  } catch (error) {
    console.error('Error subiendo video:', error);
    res.status(500).json({ error: 'Error del servidor al subir el video' });
  }
});

// Ruta para servir videos (sin mostrar información del servidor)
router.get('/videos/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  
  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video no encontrado' });
  }

  // Determinar el tipo de contenido
  const ext = path.extname(filename).toLowerCase();
  const contentTypeMap = {
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska'
  };

  const contentType = contentTypeMap[ext] || 'video/mp4';
  
  // Headers para ocultar información del servidor y permitir streaming
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="video${ext}"`); // Nombre genérico
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 año
  // Nota: res.removeHeader puede no estar disponible en todas las versiones de Express
  
  // Obtener estadísticas del archivo para Range requests (streaming)
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Soporte para Range requests (permite pausar/reanudar video)
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Ruta para eliminar video
router.delete('/videos/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video no encontrado' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'Video eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando video:', error);
    res.status(500).json({ error: 'Error al eliminar el video' });
  }
});

export default router;
