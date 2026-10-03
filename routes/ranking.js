import express from 'express';
import M1Master from '../models/M1Master.js';
import { requireAuth } from '../middleware/auth.js';
import { getItemVendedores } from '../src/utils/helpers.js';

const router = express.Router();
router.use(requireAuth);

// Misma lógica de Estatus FPD usada en el resto del sistema para M1
function getEstatusFPDServer(item) {
  const raw = String(item?.['Estatus FPD'] || item?.EstatusFPD || '').toUpperCase().trim();
  if (raw.includes('PÉRDIDA') || raw.includes('PERDIDA') || raw.includes('PERDIDO')) return 'FPD PÉRDIDA';
  if (raw.includes('CORRIENTE')) return 'FPD CORRIENTE';
  return 'M1';
}

router.get('/venta-directa', async (req, res) => {
  try {
    const m1 = await M1Master.find({}).lean();

    const porVendedor = new Map(); // nombre -> { total, m1, perdidas, plazas: Map }

    for (const item of m1) {
      const vendedores = getItemVendedores(item);
      if (vendedores.length === 0) continue;
      const nombre = vendedores[0];

      if (!porVendedor.has(nombre)) {
        porVendedor.set(nombre, { total: 0, m1: 0, perdidas: 0, plazas: new Map() });
      }
      const s = porVendedor.get(nombre);
      s.total++;

      const e = getEstatusFPDServer(item);
      if (e === 'FPD PÉRDIDA') s.perdidas++;
      else if (e !== 'FPD CORRIENTE') s.m1++;

      const plaza = String(item.PLAZA || item['PLAZA'] || item.Plaza || '').trim();
      if (plaza) s.plazas.set(plaza, (s.plazas.get(plaza) || 0) + 1);
    }

    const ranking = Array.from(porVendedor.entries()).map(([nombre, s]) => {
      let plazaPrincipal = '';
      let maxCount = 0;
      for (const [p, c] of s.plazas) {
        if (c > maxCount) { maxCount = c; plazaPrincipal = p; }
      }
      const porcentajeM1Total = s.total > 0 ? ((s.m1 + s.perdidas) / s.total * 100) : 0;
      return {
        nombre,
        volumen: s.total,
        porcentajeM1Total: Number(porcentajeM1Total.toFixed(1)),
        plaza: plazaPrincipal || 'Sin dato',
      };
    }).sort((a, b) => b.volumen - a.volumen);

    res.json(ranking);
  } catch (error) {
    console.error('Error obteniendo ranking de venta directa:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
