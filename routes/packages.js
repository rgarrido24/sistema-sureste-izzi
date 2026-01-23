import express from 'express';
import IzziPackage from '../models/IzziPackage.js';

const router = express.Router();

function normalizeNameForKey(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizePackageName(name) {
  const raw = String(name || '').replace(/\s+/g, ' ').trim();
  if (!raw) return raw;
  const parts = raw.split(' ').filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (out.length === 0) out.push(p);
    else if (out[out.length - 1] !== p) out.push(p);
  }
  return out.join(' ');
}

function guessMarca({ marca, codigo, name } = {}) {
  const m = String(marca || '').toUpperCase().trim();
  if (m === 'IZZI' || m === 'WIZZ') return m;
  const n = normalizeNameForKey(name);
  const c = String(codigo || '').toUpperCase().trim();
  if (n.startsWith('WIZZ') || n.includes(' WIZZ ') || c.startsWith('W')) return 'WIZZ';
  return 'IZZI';
}

// Obtener todos los paquetes
router.get('/', async (req, res) => {
  try {
    const { marca, tipo } = req.query;
    const query = {};
    if (marca) query.marca = String(marca).toUpperCase().trim();
    if (tipo) query.tipo = String(tipo).toUpperCase().trim();

    const packages = await IzziPackage.find(query)
      .sort({ marca: 1, tipo: 1, codigo: 1, name: 1 })
      .lean();

    res.json(packages);
  } catch (error) {
    console.error('Error obteniendo paquetes:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Reparar marca/nombres y eliminar duplicados (útil para limpiar WIZZ 60 60, etc.)
router.post('/dedupe', async (req, res) => {
  try {
    const all = await IzziPackage.find().lean();
    const toFixMarca = [];
    const toFixName = [];

    for (const p of all) {
      const guessed = guessMarca(p);
      const current = String(p.marca || '').toUpperCase().trim();
      if (current !== 'IZZI' && current !== 'WIZZ') {
        toFixMarca.push({ _id: p._id, marca: guessed });
      } else if (guessed === 'WIZZ' && current === 'IZZI') {
        // Caso típico: WIZZ viejo se guardó como IZZI por default
        toFixMarca.push({ _id: p._id, marca: 'WIZZ' });
      }

      const fixedName = normalizePackageName(p.name);
      if (fixedName && fixedName !== p.name) {
        toFixName.push({ _id: p._id, name: fixedName });
      }
    }

    const CHUNK = 500;
    if (toFixMarca.length > 0) {
      const ops = toFixMarca.map(u => ({
        updateOne: { filter: { _id: u._id }, update: { $set: { marca: u.marca } } }
      }));
      for (let i = 0; i < ops.length; i += CHUNK) {
        // eslint-disable-next-line no-await-in-loop
        await IzziPackage.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
      }
    }

    if (toFixName.length > 0) {
      const ops = toFixName.map(u => ({
        updateOne: { filter: { _id: u._id }, update: { $set: { name: u.name } } }
      }));
      for (let i = 0; i < ops.length; i += CHUNK) {
        // eslint-disable-next-line no-await-in-loop
        await IzziPackage.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
      }
    }

    const all2 = await IzziPackage.find().sort({ createdAt: 1 }).lean();
    const seen = new Map();
    const deleteIds = [];
    for (const p of all2) {
      const marcaFinal = guessMarca(p);
      const tipoFinal = String(p.tipo || '').toUpperCase().trim() || 'OTROS';
      const nameKey = normalizeNameForKey(normalizePackageName(p.name));
      const key = `${marcaFinal}::${tipoFinal}::${nameKey}`;
      if (!seen.has(key)) seen.set(key, String(p._id));
      else deleteIds.push(p._id);
    }

    if (deleteIds.length > 0) {
      await IzziPackage.deleteMany({ _id: { $in: deleteIds } });
    }

    res.json({
      success: true,
      marcaFixed: toFixMarca.length,
      nameFixed: toFixName.length,
      deletedDuplicates: deleteIds.length,
      totalBefore: all.length,
      totalAfter: all2.length - deleteIds.length,
    });
  } catch (error) {
    console.error('Error deduplicando paquetes:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear paquete
router.post('/', async (req, res) => {
  try {
    const { name, price, description, codigo, tipo, marca } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }
    
    const marcaFinal = (marca ? String(marca) : 'IZZI').toUpperCase().trim();

    const pkg = new IzziPackage({
      name: normalizePackageName(name),
      price: parseFloat(price),
      description: description || '',
      codigo: codigo || '',
      tipo: tipo || '',
      marca: marcaFinal || 'IZZI'
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
    const existingNames = new Set(
      existingPackages.map(p => `${guessMarca(p).toLowerCase()}::${normalizeNameForKey(p.name).toLowerCase()}`)
    );
    const existingCodigos = new Set(
      existingPackages
        .map(p => {
          const c = p.codigo ? String(p.codigo).toLowerCase() : '';
          const m = guessMarca(p).toLowerCase();
          return c ? `${m}::${c}` : '';
        })
        .filter(Boolean)
    );
    
    // Filtrar paquetes que no existen (por nombre o código)
    const newPackages = packages.filter(p => {
      const marcaKey = guessMarca(p).toLowerCase().trim();
      const nameKey = `${marcaKey}::${normalizeNameForKey(p.name).toLowerCase()}`;
      const codigoKey = p.codigo ? `${marcaKey}::${String(p.codigo).toLowerCase()}` : null;

      const nameExists = existingNames.has(nameKey);
      const codigoExists = codigoKey ? existingCodigos.has(codigoKey) : false;
      return !nameExists && !codigoExists;
    });
    
    // Preparar paquetes para insertar
    const packagesToInsert = newPackages.map(p => ({
      name: normalizePackageName(p.name),
      price: parseFloat(p.price) || 0,
      description: p.description || '',
      codigo: p.codigo || '',
      tipo: p.tipo || '',
      marca: guessMarca(p)
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

// Eliminar paquetes por marca (ej: WIZZ)
// Si marca=WIZZ, también borra "WIZZ" mal guardados sin marca / con marca IZZI.
router.delete('/marca/:marca', async (req, res) => {
  try {
    const marca = String(req.params.marca || '').toUpperCase().trim();
    if (!marca) return res.status(400).json({ error: 'Marca requerida' });

    let filter = { marca };
    if (marca === 'WIZZ') {
      filter = {
        $or: [
          { marca: 'WIZZ' },
          { name: { $regex: '^\\s*WIZZ\\b', $options: 'i' } },
          { codigo: { $regex: '^W', $options: 'i' } },
        ]
      };
    }

    const result = await IzziPackage.deleteMany(filter);
    res.json({ success: true, deletedCount: result.deletedCount, marca });
  } catch (error) {
    console.error('Error eliminando paquetes por marca:', error);
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

