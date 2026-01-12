import express from 'express';
import IzziPackage from '../models/IzziPackage.js';

const router = express.Router();

// Obtener todos los paquetes
router.get('/', async (req, res) => {
  try {
    const packages = await IzziPackage.find();
    res.json(packages);
  } catch (error) {
    console.error('Error obteniendo paquetes:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear paquete
router.post('/', async (req, res) => {
  try {
    const { name, price, description, codigo, tipo } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }
    
    const pkg = new IzziPackage({
      name,
      price: parseFloat(price),
      description: description || '',
      codigo: codigo || '',
      tipo: tipo || ''
    });
    
    await pkg.save();
    res.json(pkg);
  } catch (error) {
    console.error('Error creando paquete:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear múltiples paquetes
router.post('/bulk', async (req, res) => {
  try {
    const { packages } = req.body;
    
    if (!Array.isArray(packages)) {
      return res.status(400).json({ error: 'Se espera un array de paquetes' });
    }
    
    const existingPackages = await IzziPackage.find();
    const existingNames = new Set(existingPackages.map(p => p.name.toLowerCase()));
    const existingCodigos = new Set(existingPackages.map(p => p.codigo?.toLowerCase()).filter(c => c));
    
    // Filtrar paquetes que no existen (por nombre o código)
    const newPackages = packages.filter(p => {
      const nameExists = existingNames.has(p.name.toLowerCase());
      const codigoExists = p.codigo && existingCodigos.has(p.codigo.toLowerCase());
      return !nameExists && !codigoExists;
    });
    
    // Preparar paquetes para insertar
    const packagesToInsert = newPackages.map(p => ({
      name: p.name,
      price: parseFloat(p.price) || 0,
      description: p.description || '',
      codigo: p.codigo || '',
      tipo: p.tipo || ''
    }));
    
    if (packagesToInsert.length > 0) {
      await IzziPackage.insertMany(packagesToInsert);
    }
    
    res.json({ success: true, created: packagesToInsert.length, total: packages.length, skipped: packages.length - packagesToInsert.length });
  } catch (error) {
    console.error('Error creando paquetes en bulk:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar paquete
router.delete('/:id', async (req, res) => {
  try {
    await IzziPackage.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando paquete:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

