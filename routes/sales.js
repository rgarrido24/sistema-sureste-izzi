import express from 'express';
import SalesMaster from '../models/SalesMaster.js';
import { requireAuth } from '../middleware/auth.js';
import ActivityEvent from '../models/ActivityEvent.js';

const router = express.Router();
router.use(requireAuth);

// Obtener todos los registros
router.get('/', async (req, res) => {
  try {
    const sales = await SalesMaster.find();
    res.json(sales);
  } catch (error) {
    console.error('Error obteniendo sales:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener conteo
router.get('/count', async (req, res) => {
  try {
    const count = await SalesMaster.countDocuments();
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
      const nCuenta = item['Nº de cuenta'] || item.Cuenta || '';
      
      if (!nCuenta) continue;
      
      const existing = await SalesMaster.findOne({ 
        $or: [
          { 'Nº de cuenta': nCuenta },
          { Cuenta: nCuenta }
        ]
      });
      
      if (existing && updateExisting) {
        // Preservar campos importantes
        const updateData = {
          ...item,
          Vendedor: existing.Vendedor || item.Vendedor || '',
          VendedorAsignado: existing.VendedorAsignado || item.VendedorAsignado || '',
          createdAt: existing.createdAt,
          updatedAt: new Date()
        };
        await SalesMaster.findByIdAndUpdate(existing._id, updateData);
        updated++;
      } else if (!existing) {
        await SalesMaster.create({ ...item, createdAt: new Date() });
        created++;
      }
    }

    // Auditoría: registrar upload
    try {
      await ActivityEvent.create({
        type: 'upload',
        module: 'sales',
        userId: req.user?.id,
        username: req.user?.username || '',
        role: req.user?.role || '',
        region: req.user?.region || '',
        meta: { created, updated, total: data.length },
      });
    } catch (e) {
      console.warn('⚠️ No se pudo registrar ActivityEvent upload (sales):', e?.message || e);
    }

    res.json({ success: true, created, updated, total: data.length });
  } catch (error) {
    console.error('Error en bulk sales:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar todos
router.delete('/all', async (req, res) => {
  try {
    await SalesMaster.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando sales:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar registro específico
router.put('/:id', async (req, res) => {
  try {
    const updated = await SalesMaster.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando sale:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

