import express from 'express';
import ComisionPaquete from '../models/ComisionPaquete.js';
import VendedorFactor from '../models/VendedorFactor.js';
import M1Master from '../models/M1Master.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { getItemVendedores } from '../src/utils/helpers.js';

const router = express.Router();
router.use(requireAuth);

// Solo roles de dirección pueden ver/editar el factor y las comisiones — nunca el vendedor
const CAN_SEE = ['admin', 'admin_general', 'director', 'supervisor', 'regionales'];
const CAN_EDIT = ['admin', 'admin_general', 'director'];

// Tabla de comisión base por paquete (columna "Base" de la tabla que compartiste)
const SEED_PAQUETES = [
  { paquete: 'IZZI 60 MEGAS + IZZI TV HD', comisionBase: 539.00 },
  { paquete: 'IZZI 80 MEGAS + IZZI TV HD', comisionBase: 690.00 },
  { paquete: 'IZZI 100 MEGAS + IZZI TV HD', comisionBase: 720.00 },
  { paquete: 'IZZI 120 MEGAS + IZZI TV HD', comisionBase: 690.00 },
  { paquete: 'IZZI 150 MEGAS + IZZI TV HD', comisionBase: 790.00 },
  { paquete: 'IZZI 200 MEGAS + IZZI TV HD', comisionBase: 790.00 },
  { paquete: 'IZZI 500 MEGAS + IZZI TV HD', comisionBase: 790.00 },
  { paquete: 'IZZI 1000 MEGAS + IZZI TV HD', comisionBase: 790.00 },
  { paquete: 'IZZI NEGOCIOS 30 MEGAS + IZZI TV HD', comisionBase: 680.00 },
  { paquete: 'IZZI NEGOCIOS 40 MEGAS + IZZI TV HD', comisionBase: 680.00 },
  { paquete: 'IZZI NEGOCIOS 50 MEGAS + IZZI TV HD', comisionBase: 710.00 },
  { paquete: 'IZZI NEGOCIOS 60 MEGAS + IZZI TV HD', comisionBase: 680.00 },
  { paquete: 'IZZI NEGOCIOS 80 MEGAS + IZZI TV HD', comisionBase: 680.00 },
  { paquete: 'IZZI NEGOCIOS 100 MEGAS + IZZI TV HD', comisionBase: 710.00 },
  { paquete: 'IZZI NEGOCIOS 125 MEGAS + IZZI TV HD', comisionBase: 780.00 },
  { paquete: 'IZZI NEGOCIOS 150 MEGAS + IZZI TV HD', comisionBase: 780.00 },
  { paquete: 'IZZI NEGOCIOS 200 MEGAS + IZZI TV HD', comisionBase: 870.00 },
  { paquete: 'IZZI NEGOCIOS 500 MEGAS + IZZI TV HD', comisionBase: 990.00 },
  { paquete: 'IZZI 60 MEGAS', comisionBase: 389.00 },
  { paquete: 'IZZI 80 MEGAS', comisionBase: 510.00 },
  { paquete: 'IZZI 100 MEGAS', comisionBase: 540.00 },
  { paquete: 'IZZI 120 MEGAS', comisionBase: 540.00 },
  { paquete: 'IZZI 150 MEGAS', comisionBase: 610.00 },
  { paquete: 'IZZI 200 MEGAS', comisionBase: 610.00 },
  { paquete: 'IZZI 500 MEGAS', comisionBase: 610.00 },
  { paquete: 'IZZI 1000 MEGAS', comisionBase: 610.00 },
  { paquete: 'IZZI NEGOCIOS 40 MEGAS', comisionBase: 500.00 },
  { paquete: 'IZZI NEGOCIOS 60 MEGAS', comisionBase: 530.00 },
  { paquete: 'IZZI NEGOCIOS 80 MEGAS', comisionBase: 530.00 },
  { paquete: 'IZZI NEGOCIOS 100 MEGAS', comisionBase: 560.00 },
  { paquete: 'IZZI NEGOCIOS 150 MEGAS', comisionBase: 630.00 },
  { paquete: 'IZZI NEGOCIOS 200 MEGAS', comisionBase: 720.00 },
  { paquete: 'IZZI NEGOCIOS 500 MEGAS', comisionBase: 840.00 },
  { paquete: 'IZZI NEGOCIOS 1000 MEGAS', comisionBase: 1040.00 },
  { paquete: 'IZZI TV LIGHT', comisionBase: 199.00 },
  { paquete: 'PACK TV MINI', comisionBase: 200.00 },
  { paquete: 'IZZI TV +', comisionBase: 249.00 },
  { paquete: 'IZZI TV + BÁSICO', comisionBase: 299.00 },
  { paquete: 'IZZI TV + PREMIUM', comisionBase: 499.00 },
  { paquete: 'PACK TV PLUS', comisionBase: 240.00 },
  { paquete: 'IZZI TV HD', comisionBase: 340.00 },
];

// --- PAQUETES ---
router.get('/paquetes', requireRoles(CAN_SEE), async (req, res) => {
  try {
    const paquetes = await ComisionPaquete.find({}).sort({ paquete: 1 }).lean();
    res.json(paquetes);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/paquetes/seed', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const ops = SEED_PAQUETES.map(p => ({
      updateOne: { filter: { paquete: p.paquete }, update: { $set: p }, upsert: true }
    }));
    await ComisionPaquete.bulkWrite(ops);
    res.json({ success: true, total: SEED_PAQUETES.length });
  } catch (error) {
    console.error('Error sembrando paquetes:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/paquetes', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const { paquete, comisionBase } = req.body;
    if (!paquete || comisionBase === undefined) {
      return res.status(400).json({ error: 'Falta paquete o comisión base' });
    }
    const doc = await ComisionPaquete.findOneAndUpdate(
      { paquete: paquete.trim() },
      { paquete: paquete.trim(), comisionBase: Number(comisionBase) },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/paquetes/:id', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    await ComisionPaquete.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// --- VENDEDORES (factor) ---
router.get('/vendedores', requireRoles(CAN_SEE), async (req, res) => {
  try {
    const vendedores = await VendedorFactor.find({}).sort({ vendedor: 1 }).lean();
    res.json(vendedores);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/vendedores', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const { vendedor, tipo, factor, retencionPorcentaje } = req.body;
    if (!vendedor || !tipo || factor === undefined) {
      return res.status(400).json({ error: 'Falta vendedor, tipo o factor' });
    }
    const doc = await VendedorFactor.findOneAndUpdate(
      { vendedor: vendedor.trim() },
      {
        vendedor: vendedor.trim(),
        tipo,
        factor: Number(factor),
        retencionPorcentaje: tipo === 'distribuidor' ? (retencionPorcentaje ?? 10) : 0,
        actualizadoPorId: req.user?.id || '',
        actualizadoPorUsername: req.user?.username || '',
        actualizadoPorNombre: req.user?.name || req.user?.username || '',
      },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/vendedores/:id', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    await VendedorFactor.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// --- MI RIESGO (el propio vendedor/sub distribuidor) ---
// Solo aplica a tipo 'distribuidor' (retención). Venta directa no tiene este concepto.
// Nunca se expone el factor ni el tipo, solo el monto final en pesos.
router.get('/mi-riesgo', async (req, res) => {
  try {
    const nombre = String(req.user?.name || '').trim();
    if (!nombre) return res.json({ aplica: false });

    const vf = await VendedorFactor.findOne({
      vendedor: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    }).lean();

    if (!vf || vf.tipo !== 'distribuidor') {
      return res.json({ aplica: false });
    }

    const paquetes = await ComisionPaquete.find({}).lean();
    const comisionPorPaquete = new Map(paquetes.map(p => [p.paquete.trim().toUpperCase(), p.comisionBase]));

    const m1 = await M1Master.find({}).lean();
    let montoEnRiesgo = 0;
    let cuentasEnRiesgo = 0;

    for (const item of m1) {
      const vendedores = getItemVendedores(item);
      if (!vendedores.some(v => v.trim().toUpperCase() === nombre.toUpperCase())) continue;

      const estatus = String(item['Estatus FPD'] || item.EstatusFPD || '').toUpperCase();
      const enRiesgo = estatus.includes('PÉRDIDA') || estatus.includes('PERDIDA') || !estatus.includes('CORRIENTE');
      if (!enRiesgo) continue;

      const paqueteNombre = String(item['PAQUETE CONTRATADO'] || item['Paquete Contratado'] || '').trim().toUpperCase();
      const base = comisionPorPaquete.get(paqueteNombre) || 0;
      const comisionReal = base * vf.factor;
      const retencion = comisionReal * ((vf.retencionPorcentaje || 10) / 100);

      montoEnRiesgo += retencion;
      cuentasEnRiesgo++;
    }

    res.json({
      aplica: true,
      montoEnRiesgo: Number(montoEnRiesgo.toFixed(2)),
      cuentasEnRiesgo,
    });
  } catch (error) {
    console.error('Error calculando mi riesgo:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
