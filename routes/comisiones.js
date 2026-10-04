import express from 'express';
import mongoose from 'mongoose';
import ComisionPaquete from '../models/ComisionPaquete.js';
import VendedorFactor from '../models/VendedorFactor.js';
import M1Master from '../models/M1Master.js';
import OperacionDia from '../models/OperacionDia.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { getItemVendedores } from '../src/utils/helpers.js';
import { filterByAccessScope, isScopedRole } from '../utils/accessScope.js';
import { CATALOGO_COMISIONES } from '../utils/catalogoComisiones.js';
import { normalizarNombre, normalizarPaquete, construirIndicePaquetes, calcularComisiones } from '../utils/comisionesCalc.js';
import { planificarUpsert, parsearTipo, parsearFactor, parsearTelefono, parsearEmail, parsearFecha } from '../utils/vendedoresMaster.js';

const router = express.Router();
router.use(requireAuth);

// Ver: dirección y Mesa de Control (+ supervisores/regionales, limitados a su región/plazas en las pérdidas).
// Editar: solo admin/director. El vendedor NUNCA ve su factor (solo el monto en riesgo en /mi-riesgo).
const CAN_SEE = ['admin', 'admin_general', 'director', 'mesa_control', 'supervisor', 'regionales'];
const CAN_EDIT = ['admin', 'admin_general', 'director'];

// ---------- helpers ----------
async function cargarVendedoresMapa() {
  const docs = await VendedorFactor.find({}).lean();
  return new Map(docs.map((d) => [normalizarNombre(d.vendedor), d]));
}

async function cargarIndicePaquetes() {
  return construirIndicePaquetes(await ComisionPaquete.find({}).lean());
}

async function itemsM1Visibles(user) {
  const m1 = await M1Master.find({}).lean();
  return isScopedRole(user?.role) ? filterByAccessScope(m1, user, OperacionDia) : m1;
}

// Nombres de vendedor tal como vienen en la cobranza (con su número de cuentas)
async function nombresCobranzaConConteo() {
  const m1 = await M1Master.find({}).lean();
  const mapa = new Map();
  for (const item of m1) {
    const nombre = getItemVendedores(item)[0];
    if (!nombre) continue;
    const key = normalizarNombre(nombre);
    const prev = mapa.get(key) || { nombre, cuentas: 0 };
    prev.cuentas++;
    mapa.set(key, prev);
  }
  return mapa;
}

async function aplicarPlan(plan, user) {
  const quien = {
    actualizadoPorId: user?.id || '',
    actualizadoPorUsername: user?.username || '',
    actualizadoPorNombre: user?.name || user?.username || '',
  };
  const ops = [
    ...plan.crear.map((doc) => ({ insertOne: { document: { ...doc, ...quien } } })),
    ...plan.actualizar.map((u) => ({ updateOne: { filter: { _id: u.id }, update: { $set: { ...u.cambios, ...quien } } } })),
  ];
  if (ops.length) await VendedorFactor.bulkWrite(ops, { ordered: false });
}

// ====================== PAQUETES (comisión base) ======================

router.get('/paquetes', requireRoles(CAN_SEE), async (req, res) => {
  try {
    res.json(await ComisionPaquete.find({}).sort({ paquete: 1 }).lean());
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Carga/actualiza el catálogo vigente. No borra nada: los paquetes agregados a mano se conservan.
router.post('/paquetes/seed', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const ops = CATALOGO_COMISIONES.map((p) => ({
      updateOne: {
        filter: { paquete: p.paquete },
        update: { $set: { clave: p.clave, categoria: p.categoria, comisionBase: p.comisionBase } },
        upsert: true,
      },
    }));
    const r = await ComisionPaquete.bulkWrite(ops);
    res.json({ success: true, total: ops.length, nuevos: r.upsertedCount || 0, actualizados: r.modifiedCount || 0 });
  } catch (error) {
    console.error('Error sembrando paquetes:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/paquetes', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const { paquete, comisionBase, clave, categoria } = req.body || {};
    if (!paquete || comisionBase === undefined || !(Number(comisionBase) >= 0)) {
      return res.status(400).json({ error: 'Falta paquete o comisión base' });
    }
    const set = { paquete: String(paquete).trim(), comisionBase: Number(comisionBase) };
    if (clave !== undefined) set.clave = String(clave).trim();
    if (['triple', 'doble', 'single'].includes(categoria)) set.categoria = categoria;
    const doc = await ComisionPaquete.findOneAndUpdate({ paquete: set.paquete }, { $set: set }, { upsert: true, new: true });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Asignar a qué paquete del catálogo corresponde un nombre que viene en la cobranza
router.post('/paquetes/alias', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const alias = normalizarPaquete(req.body?.nombre);
    const { paqueteId } = req.body || {};
    if (!alias || !mongoose.isValidObjectId(paqueteId)) return res.status(400).json({ error: 'Datos no válidos' });

    const destino = await ComisionPaquete.findById(paqueteId);
    if (!destino) return res.status(404).json({ error: 'Paquete no encontrado' });

    // Un alias apunta a un solo paquete: si ya estaba en otro, se mueve
    await ComisionPaquete.updateMany({ alias }, { $pull: { alias } });
    await ComisionPaquete.updateOne({ _id: destino._id }, { $addToSet: { alias } });
    res.json({ success: true, paquete: destino.paquete });
  } catch (error) {
    console.error('Error asignando alias:', error);
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

// ====================== VENDEDORES (base maestra) ======================

router.get('/vendedores', requireRoles(CAN_SEE), async (req, res) => {
  try {
    res.json(await VendedorFactor.find({}).sort({ vendedor: 1 }).lean());
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Alta/actualización de uno (si ya existe por nombre, lo actualiza; no duplica)
router.post('/vendedores', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const b = req.body || {};
    const fila = {
      __fila: 1,
      Nombre: b.vendedor ?? b.nombre,
      Tipo: b.tipo,
      Factor: b.factor,
      Telefono: b.telefono,
      Correo: b.email,
      'Fecha de nacimiento': b.fechaNacimiento,
    };
    const plan = planificarUpsert([fila], await VendedorFactor.find({}).lean());
    if (plan.errores.length) return res.status(400).json({ error: plan.errores[0].mensaje });
    await aplicarPlan(plan, req.user);
    res.json({ success: true, creados: plan.resumen.creados, actualizados: plan.resumen.actualizados, advertencias: plan.advertencias });
  } catch (error) {
    console.error('Error guardando vendedor:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Edición completa de un registro (aquí sí se pueden vaciar datos)
router.put('/vendedores/:id', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
    const doc = await VendedorFactor.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'No encontrado' });

    const b = req.body || {};
    const set = {
      actualizadoPorId: req.user?.id || '',
      actualizadoPorUsername: req.user?.username || '',
      actualizadoPorNombre: req.user?.name || req.user?.username || '',
    };
    const unset = {};

    if (b.vendedor !== undefined) {
      const nombre = String(b.vendedor).replace(/\s+/g, ' ').trim().toUpperCase();
      if (!nombre) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
      if (normalizarNombre(nombre) !== normalizarNombre(doc.vendedor)) {
        const todos = await VendedorFactor.find({}, { vendedor: 1 }).lean();
        if (todos.some((d) => String(d._id) !== String(doc._id) && normalizarNombre(d.vendedor) === normalizarNombre(nombre))) {
          return res.status(400).json({ error: 'Ya existe un vendedor con ese nombre' });
        }
      }
      set.vendedor = nombre;
    }

    const campos = { tipo: parsearTipo, factor: parsearFactor, telefono: parsearTelefono, email: parsearEmail, fechaNacimiento: parsearFecha };
    for (const [campo, parser] of Object.entries(campos)) {
      if (b[campo] === undefined) continue;
      const r = parser(b[campo]);
      if (r.error) return res.status(400).json({ error: `${campo}: ${r.error}` });
      if (r.vacio) {
        if (campo === 'tipo' || campo === 'factor') unset[campo] = '';
        else set[campo] = '';
      } else {
        set[campo] = r.valor;
      }
    }
    if (set.tipo && set.tipo !== doc.tipo) {
      set.retencionPorcentaje = set.tipo === 'distribuidor' ? (Number(doc.retencionPorcentaje) > 0 ? Number(doc.retencionPorcentaje) : 10) : 0;
    }

    const update = { $set: set };
    if (Object.keys(unset).length) update.$unset = unset;
    const actualizado = await VendedorFactor.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(actualizado);
  } catch (error) {
    console.error('Error editando vendedor:', error);
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

// Carga masiva desde Excel/CSV: crea los que faltan y actualiza los existentes (por nombre, sin duplicar)
router.post('/vendedores/bulk', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'El archivo no trae filas' });
    if (rows.length > 5000) return res.status(400).json({ error: 'Máximo 5,000 filas por archivo' });

    const plan = planificarUpsert(rows, await VendedorFactor.find({}).lean());
    await aplicarPlan(plan, req.user);

    // Avisar si alguno de los nuevos no aparece en la cobranza (posible error de ortografía)
    const enCobranza = await nombresCobranzaConConteo();
    const creadosSinCobranza = plan.crear
      .filter((d) => !enCobranza.has(normalizarNombre(d.vendedor)))
      .map((d) => d.vendedor)
      .slice(0, 30);

    res.json({ success: true, ...plan.resumen, errores: plan.errores, advertencias: plan.advertencias, creadosSinCobranza });
  } catch (error) {
    console.error('Error en carga masiva de vendedores:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Agrega a la base todos los vendedores que aparecen en la cobranza y todavía no están (sin factor, para que lo definas)
router.post('/vendedores/sincronizar', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const enCobranza = await nombresCobranzaConConteo();
    const existentes = await VendedorFactor.find({}, { vendedor: 1 }).lean();
    const ya = new Set(existentes.map((d) => normalizarNombre(d.vendedor)));
    const nuevos = Array.from(enCobranza.values()).filter((n) => !ya.has(normalizarNombre(n.nombre)));

    if (nuevos.length) {
      await VendedorFactor.insertMany(
        nuevos.map((n) => ({
          vendedor: n.nombre,
          actualizadoPorId: req.user?.id || '',
          actualizadoPorUsername: req.user?.username || '',
          actualizadoPorNombre: req.user?.name || req.user?.username || '',
        })),
        { ordered: false }
      );
    }
    res.json({ success: true, creados: nuevos.length, yaExistian: enCobranza.size - nuevos.length, total: enCobranza.size });
  } catch (error) {
    console.error('Error sincronizando vendedores:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ====================== PÉRDIDAS POR VENDEDOR (decisiones) ======================
// comisión = base del paquete × factor real del vendedor · retención = comisión × 10% (solo distribuidores)

router.get('/perdidas', requireRoles(CAN_SEE), async (req, res) => {
  try {
    const [items, indice, vendedores] = await Promise.all([
      itemsM1Visibles(req.user),
      cargarIndicePaquetes(),
      cargarVendedoresMapa(),
    ]);
    const calculo = calcularComisiones({ items, indice, vendedores });
    res.json({
      resumen: calculo.resumen,
      paquetesSinBase: calculo.paquetesSinBase.slice(0, 40),
      vendedores: calculo.vendedores.map(({ cuentas, ...resto }) => resto),
    });
  } catch (error) {
    console.error('Error calculando pérdidas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/perdidas/detalle', requireRoles(CAN_SEE), async (req, res) => {
  try {
    const nombre = String(req.query.vendedor || '');
    const key = normalizarNombre(nombre);
    if (!key) return res.status(400).json({ error: 'Falta el vendedor' });

    const [visibles, indice, vendedores] = await Promise.all([itemsM1Visibles(req.user), cargarIndicePaquetes(), cargarVendedoresMapa()]);
    const items = visibles.filter((it) => normalizarNombre(getItemVendedores(it)[0]) === key);
    const v = calcularComisiones({ items, indice, vendedores }).vendedores[0];

    const cuentas = (v?.cuentas || []).sort(
      (a, b) => (a.estatus === b.estatus ? 0 : a.estatus === 'PERDIDA' ? -1 : 1) || ((b.comision || 0) - (a.comision || 0))
    );
    res.json({ vendedor: nombre, cuentas });
  } catch (error) {
    console.error('Error en detalle de pérdidas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ====================== MI RIESGO (distribuidor, nunca expone el factor) ======================
router.get('/mi-riesgo', async (req, res) => {
  try {
    const key = normalizarNombre(req.user?.name);
    if (!key) return res.json({ aplica: false });

    const vendedores = await cargarVendedoresMapa();
    const doc = vendedores.get(key);
    if (!doc || doc.tipo !== 'distribuidor' || !(Number(doc.factor) > 0)) return res.json({ aplica: false });

    const [m1, indice] = await Promise.all([M1Master.find({}).lean(), cargarIndicePaquetes()]);
    const items = m1.filter((it) => normalizarNombre(getItemVendedores(it)[0]) === key);
    const v = calcularComisiones({ items, indice, vendedores }).vendedores[0];

    res.json({
      aplica: true,
      montoEnRiesgo: Number(((v?.retencionPerdida || 0) + (v?.retencionPendiente || 0)).toFixed(2)),
      cuentasEnRiesgo: v ? v.perdidas + v.pendientes : 0,
    });
  } catch (error) {
    console.error('Error calculando mi riesgo:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
