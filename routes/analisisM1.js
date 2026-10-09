import express from 'express';
import M1Master from '../models/M1Master.js';
import VendedorFactor from '../models/VendedorFactor.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import M1Foto from '../models/M1Foto.js';
import { analizarM1, serieTendencia, META_POR_DEFECTO } from '../utils/analisisM1.js';
import { guardarFotoM1 } from '../utils/fotoM1.js';
import { diaMerida } from '../utils/estatusOrdenes.js';
import { normalizarNombre } from '../utils/comisionesCalc.js';

// Solo Admin: es información de Dirección para decidir quién nos está afectando.
const router = express.Router();
router.use(requireAuth, requireRoles(['admin', 'admin_general']));

router.get('/', async (req, res) => {
  try {
    const txt = (v) => String(v ?? '').trim().slice(0, 120);
    const meta = Math.min(100, Math.max(1, Number(req.query.meta) || META_POR_DEFECTO));
    const [m1, vendedores] = await Promise.all([M1Master.find({}).lean(), VendedorFactor.find({}, { vendedor: 1, tipo: 1 }).lean()]);
    const tiposPorVendedor = new Map(vendedores.filter((v) => v.tipo).map((v) => [normalizarNombre(v.vendedor), v.tipo]));
    // Si todavía no hay foto de hoy, se guarda al abrir el análisis (así la tendencia no depende de que alguien suba el archivo)
    M1Foto.exists({ fecha: diaMerida() }).then((hay) => { if (!hay) return guardarFotoM1(m1); }).catch(() => {});
    const r = analizarM1(m1, { region: txt(req.query.region), subregion: txt(req.query.subregion), plaza: txt(req.query.plaza), meta, tiposPorVendedor });
    res.json({ success: true, generadoEn: new Date().toISOString(), ...r });
  } catch (e) {
    console.error('analisis-m1:', e?.message || e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Tendencia día con día (con las fotos guardadas)
router.get('/tendencia', async (req, res) => {
  try {
    const txt = (v) => String(v ?? '').trim().slice(0, 120);
    const fotos = await M1Foto.find({}).sort({ fecha: -1 }).limit(120).lean();
    res.json({ success: true, ...serieTendencia(fotos, { region: txt(req.query.region), subregion: txt(req.query.subregion), plaza: txt(req.query.plaza) }) });
  } catch (e) {
    console.error('analisis-m1 tendencia:', e?.message || e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Guardar la foto de hoy a mano
router.post('/foto', async (req, res) => {
  try { res.json({ success: true, fecha: await guardarFotoM1() }); }
  catch (e) { res.status(500).json({ error: 'Error del servidor' }); }
});

export default router;
