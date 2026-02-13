import express from 'express';
import SalesMaster from '../models/SalesMaster.js';
import { requireAuth } from '../middleware/auth.js';
import ActivityEvent from '../models/ActivityEvent.js';
import OperacionDia from '../models/OperacionDia.js';
import { normalizeCuenta } from '../utils/cuentaHelper.js';
import { extractRegionFromRecord, normalizeRegion } from '../utils/regionAccess.js';

const router = express.Router();
router.use(requireAuth);

// Obtener todos los registros
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role;
    const isScopedByRegion = role === 'regionales' || role === 'cobranza_mx';
    const userRegion = role === 'regionales'
      ? normalizeRegion(req.user.region || '')
      : role === 'cobranza_mx'
        ? normalizeRegion('METROPOLITANA')
        : '';

    if (isScopedByRegion && !userRegion) {
      return res.status(403).json({ error: 'Usuario regional sin región asignada. Pide a Admin que la configure.' });
    }

    const sales = await SalesMaster.find();

    if (isScopedByRegion) {
      // Filtro robusto: si el registro no trae región, inferir por cuenta cruzando con OperacionDia (Hub/Plaza)
      const regionByCuenta = new Map();
      const missingCuentas = [];

      for (const doc of sales) {
        const cuenta = normalizeCuenta(doc) || doc?.cuenta || '';
        if (!cuenta) continue;
        const reg = extractRegionFromRecord(doc);
        if (reg) regionByCuenta.set(cuenta, reg);
        else missingCuentas.push(cuenta);
      }

      if (missingCuentas.length > 0) {
        const uniqueMissing = Array.from(new Set(missingCuentas)).slice(0, 50000);
        const opDocs = await OperacionDia.find(
          { cuenta: { $in: uniqueMissing } },
          { cuenta: 1, Hub: 1, HUB: 1, Plaza: 1, PLAZA: 1, REGION: 1, Region: 1, 'Región': 1, 'REGIÓN': 1, SUBREGION: 1, 'SUBREGION': 1 }
        ).lean();

        for (const od of opDocs) {
          const cuenta = od?.cuenta;
          if (!cuenta) continue;
          if (regionByCuenta.has(cuenta)) continue;
          const reg = extractRegionFromRecord(od);
          if (reg) regionByCuenta.set(cuenta, reg);
        }
      }

      const filtered = sales.filter(doc => {
        const cuenta = normalizeCuenta(doc) || doc?.cuenta || '';
        if (!cuenta) return false;
        const reg = regionByCuenta.get(cuenta) || extractRegionFromRecord(doc);
        return normalizeRegion(reg) === userRegion;
      });

      return res.json(filtered);
    }

    res.json(sales);
  } catch (error) {
    console.error('Error obteniendo sales:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener conteo
router.get('/count', async (req, res) => {
  try {
    const role = req.user?.role;
    const isScopedByRegion = role === 'regionales' || role === 'cobranza_mx';
    const userRegion = role === 'regionales'
      ? normalizeRegion(req.user.region || '')
      : role === 'cobranza_mx'
        ? normalizeRegion('METROPOLITANA')
        : '';

    if (isScopedByRegion) {
      if (!userRegion) {
        return res.status(403).json({ error: 'Usuario regional sin región asignada. Pide a Admin que la configure.' });
      }
      // Contar con el mismo filtro robusto que / (sin traer toda la colección al cliente)
      const sales = await SalesMaster.find().lean();

      const regionByCuenta = new Map();
      const missingCuentas = [];
      for (const doc of sales) {
        const cuenta = normalizeCuenta(doc) || doc?.cuenta || '';
        if (!cuenta) continue;
        const reg = extractRegionFromRecord(doc);
        if (reg) regionByCuenta.set(cuenta, reg);
        else missingCuentas.push(cuenta);
      }
      if (missingCuentas.length > 0) {
        const uniqueMissing = Array.from(new Set(missingCuentas)).slice(0, 50000);
        const opDocs = await OperacionDia.find(
          { cuenta: { $in: uniqueMissing } },
          { cuenta: 1, Hub: 1, HUB: 1, Plaza: 1, PLAZA: 1, REGION: 1, Region: 1, 'Región': 1, 'REGIÓN': 1, SUBREGION: 1, 'SUBREGION': 1 }
        ).lean();
        for (const od of opDocs) {
          const cuenta = od?.cuenta;
          if (!cuenta) continue;
          if (regionByCuenta.has(cuenta)) continue;
          const reg = extractRegionFromRecord(od);
          if (reg) regionByCuenta.set(cuenta, reg);
        }
      }

      let count = 0;
      for (const doc of sales) {
        const cuenta = normalizeCuenta(doc) || doc?.cuenta || '';
        if (!cuenta) continue;
        const reg = regionByCuenta.get(cuenta) || extractRegionFromRecord(doc);
        if (normalizeRegion(reg) === userRegion) count++;
      }
      return res.json({ count });
    }

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

