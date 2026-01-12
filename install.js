import express from 'express';
import InstallMaster from '../models/InstallMaster.js';

const router = express.Router();

// Obtener todos los registros
router.get('/', async (req, res) => {
  try {
    const installs = await InstallMaster.find();
    res.json(installs);
  } catch (error) {
    console.error('Error obteniendo installs:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener conteo
router.get('/count', async (req, res) => {
  try {
    const count = await InstallMaster.countDocuments();
    res.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear o actualizar múltiples registros
router.post('/bulk', async (req, res) => {
  try {
    const { data, updateExisting = true } = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Se espera un array de datos' });
    }
    
    let created = 0;
    let updated = 0;
    
    for (const item of data) {
      const nOrden = item['Nº de orden'] || item.Orden || '';
      
      if (!nOrden) continue;
      
      const existing = await InstallMaster.findOne({ 
        $or: [
          { 'Nº de orden': nOrden },
          { Orden: nOrden }
        ]
      });
      
      if (existing && updateExisting) {
        const updateData = {
          ...item,
          VendedorAsignado: existing.VendedorAsignado || item.VendedorAsignado || '',
          createdAt: existing.createdAt,
          updatedAt: new Date()
        };
        await InstallMaster.findByIdAndUpdate(existing._id, updateData);
        updated++;
      } else if (!existing) {
        await InstallMaster.create({ ...item, createdAt: new Date() });
        created++;
      }
    }
    
    res.json({ success: true, created, updated, total: data.length });
  } catch (error) {
    console.error('Error en bulk installs:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar todos
router.delete('/all', async (req, res) => {
  try {
    await InstallMaster.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando installs:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar registro específico
router.put('/:id', async (req, res) => {
  try {
    const updated = await InstallMaster.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando install:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

