import express from 'express';
import mongoose from 'mongoose';
import CapacitacionContenido from '../models/CapacitacionContenido.js';
import CapacitacionNivel from '../models/CapacitacionNivel.js';
import CapacitacionVista from '../models/CapacitacionVista.js';
import User from '../models/User.js';
import VendedorFactor from '../models/VendedorFactor.js';
import M1Master from '../models/M1Master.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { getItemVendedores } from '../src/utils/helpers.js';
import { normalizarNombre, estatusCobranza } from '../utils/comisionesCalc.js';
import { normalizarUrl } from '../utils/urls.js';

const router = express.Router();
router.use(requireAuth);

// Publicar/editar contenido y subir de nivel: dirección.
const CAN_EDIT = ['admin', 'admin_general', 'director'];
// Ver quién abrió y quién no (y ver todos los niveles): dirección, Mesa de Control y Marketing.
const CAN_TRACK = [...CAN_EDIT, 'mesa_control', 'marketing'];
// Roles que tienen la sección de capacitaciones de Izzi (la población "esperada" para saber quién no la abrió).
const ROLES_IZZI = ['director', 'mesa_control', 'regionales', 'supervisor', 'cobranza_mx', 'marketing', 'reclutador', 'vendedor', 'redes_sociales'];
const NIVEL_MAX = 5;
const idValido = (id) => mongoose.isValidObjectId(id);

// ---------- quién es quién ----------
async function cargarContexto() {
  const [usuarios, vendedores, niveles] = await Promise.all([
    User.find({}, { name: 1, username: 1, role: 1 }).lean(),
    VendedorFactor.find({}, { vendedor: 1, tipo: 1 }).lean(),
    CapacitacionNivel.find({}).lean(),
  ]);
  return {
    usuarios,
    tipoPorNombre: new Map(vendedores.map((v) => [normalizarNombre(v.vendedor), v.tipo || null])),
    nivelPorUsuario: new Map(niveles.map((n) => [String(n.usuarioId), n.nivel])),
  };
}

const idDe = (u) => String(u._id ?? u.id);
// Tipo (venta directa / distribuidor) según la base maestra de vendedores, por nombre
const tipoDe = (u, ctx) => (u.role === 'vendedor' ? ctx.tipoPorNombre.get(normalizarNombre(u.name)) || null : null);
// Miembro de "crecimiento": redes sociales, o vendedor marcado como venta directa en la base maestra.
// Los distribuidores NO entran.
const esMiembro = (u, ctx) => u.role === 'redes_sociales' || (u.role === 'vendedor' && tipoDe(u, ctx) === 'directa');
const nivelDe = (u, ctx) => ctx.nivelPorUsuario.get(idDe(u)) ?? 1;
const persona = (u, ctx) => ({ id: idDe(u), nombre: u.name || u.username, username: u.username, role: u.role, tipo: tipoDe(u, ctx) });
const yo = (req) => ({ id: req.user.id, name: req.user.name, role: req.user.role });

// Quiénes deberían abrir un contenido (para calcular "quién no"):
// izzi → todos los roles con la sección; crecimiento → miembros cuyo nivel ya alcanza ese contenido.
function poblacion(seccion, nivelItem, ctx) {
  const lista = seccion === 'izzi'
    ? ctx.usuarios.filter((u) => ROLES_IZZI.includes(u.role))
    : ctx.usuarios.filter((u) => esMiembro(u, ctx) && nivelDe(u, ctx) >= (nivelItem || 1));
  return lista.map((u) => persona(u, ctx));
}

// ---------- validación de datos ----------
function leerDatosItem(body, seccion, { parcial = false } = {}) {
  const datos = {};
  if (!parcial || body.titulo !== undefined) {
    const titulo = String(body.titulo ?? '').replace(/\s+/g, ' ').trim();
    if (!titulo) return { error: 'Falta el título' };
    datos.titulo = titulo.slice(0, 200);
  }
  if (!parcial || body.link !== undefined) {
    const link = normalizarUrl(body.link);
    if (!link) return { error: 'La liga no es válida (debe ser un link http o https)' };
    datos.link = link;
  }
  if (body.descripcion !== undefined) datos.descripcion = String(body.descripcion).trim().slice(0, 1000);
  if (seccion === 'crecimiento' && (!parcial || body.nivel !== undefined)) {
    const nivel = body.nivel === undefined || body.nivel === '' ? 1 : Number(body.nivel);
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > NIVEL_MAX) return { error: `El nivel debe ser de 1 a ${NIVEL_MAX}` };
    datos.nivel = nivel;
  }
  if (seccion === 'izzi' && body.fecha !== undefined && body.fecha !== '') {
    const s = String(body.fecha);
    const f = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00.000Z`) : new Date(s);
    if (isNaN(f.getTime())) return { error: 'Fecha no válida' };
    datos.fecha = f;
  }
  return { datos };
}

const quienPublica = (req) => ({
  actualizadoPorNombre: req.user?.name || req.user?.username || '',
  actualizadoPorUsername: req.user?.username || '',
});

// ====================== ADMINISTRAR CONTENIDO (ambas secciones) ======================

router.post('/item', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const seccion = req.body?.seccion;
    if (!['izzi', 'crecimiento'].includes(seccion)) return res.status(400).json({ error: 'Sección no válida' });
    const { datos, error } = leerDatosItem(req.body, seccion);
    if (error) return res.status(400).json({ error });
    const item = await CapacitacionContenido.create({ seccion, ...datos, ...quienPublica(req) });
    res.json(item);
  } catch (e) {
    console.error('Error creando contenido de capacitación:', e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/item/:id', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
    const item = await CapacitacionContenido.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    const { datos, error } = leerDatosItem(req.body || {}, item.seccion, { parcial: true });
    if (error) return res.status(400).json({ error });
    const actualizado = await CapacitacionContenido.findByIdAndUpdate(item._id, { $set: { ...datos, ...quienPublica(req) } }, { new: true });
    res.json(actualizado);
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/item/:id', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
    await CapacitacionContenido.findByIdAndDelete(req.params.id);
    await CapacitacionVista.deleteMany({ contenidoId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ====================== CAPACITACIONES DE IZZI (abiertas para todos) ======================

router.get('/izzi', async (req, res) => {
  try {
    res.json(await CapacitacionContenido.find({ seccion: 'izzi' }).sort({ fecha: -1, createdAt: -1 }).lean());
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ====================== CRECIMIENTO (venta directa + redes sociales, por niveles) ======================

router.get('/crecimiento/acceso', async (req, res) => {
  try {
    const ctx = await cargarContexto();
    const u = yo(req);
    const esStaff = CAN_TRACK.includes(u.role);
    const miembro = esMiembro(u, ctx);
    res.json({ permitido: esStaff || miembro, esStaff, nivel: miembro ? nivelDe(u, ctx) : null });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/crecimiento', async (req, res) => {
  try {
    const ctx = await cargarContexto();
    const u = yo(req);
    const esStaff = CAN_TRACK.includes(u.role);
    if (!esStaff && !esMiembro(u, ctx)) return res.status(403).json({ error: 'Esta sección es solo para venta directa y redes sociales' });

    const items = await CapacitacionContenido.find({ seccion: 'crecimiento' }).sort({ nivel: 1, createdAt: 1 }).lean();
    if (esStaff) return res.json({ esStaff: true, nivel: null, items, nivelesSuperiores: 0 });

    // Un miembro solo recibe lo de su nivel y los anteriores; de lo demás solo sabe que existe
    const nivel = nivelDe(u, ctx);
    const visibles = items.filter((i) => i.nivel <= nivel);
    res.json({ esStaff: false, nivel, items: visibles, nivelesSuperiores: items.length - visibles.length });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Miembros con su nivel y su desempeño (cuentas M1 y % M1 Total), para decidir quién sube de nivel
router.get('/miembros', requireRoles(CAN_TRACK), async (req, res) => {
  try {
    const ctx = await cargarContexto();
    const m1 = await M1Master.find({}).lean();
    const stats = new Map();
    for (const item of m1) {
      const nombre = getItemVendedores(item)[0];
      if (!nombre) continue;
      const k = normalizarNombre(nombre);
      const s = stats.get(k) || { total: 0, abiertas: 0 };
      s.total++;
      if (estatusCobranza(item)) s.abiertas++; // pérdida o M1 pendiente
      stats.set(k, s);
    }
    const miembros = ctx.usuarios
      .filter((u) => esMiembro(u, ctx))
      .map((u) => {
        const s = stats.get(normalizarNombre(u.name));
        return {
          ...persona(u, ctx),
          nivel: nivelDe(u, ctx),
          ventas: s ? s.total : 0,
          porcentajeM1: s && s.total > 0 ? Number(((s.abiertas / s.total) * 100).toFixed(1)) : null,
        };
      })
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    res.json({ nivelMax: NIVEL_MAX, miembros });
  } catch (e) {
    console.error('Error listando miembros de crecimiento:', e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/miembros/:usuarioId/nivel', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const nivel = Number(req.body?.nivel);
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > NIVEL_MAX) return res.status(400).json({ error: `El nivel debe ser de 1 a ${NIVEL_MAX}` });
    const ctx = await cargarContexto();
    const u = ctx.usuarios.find((x) => idDe(x) === req.params.usuarioId);
    if (!u || !esMiembro(u, ctx)) return res.status(404).json({ error: 'Esa persona no pertenece a esta sección' });
    await CapacitacionNivel.findOneAndUpdate(
      { usuarioId: idDe(u) },
      { usuarioId: idDe(u), usuarioNombre: u.name || '', usuarioUsername: u.username || '', nivel, ...quienPublica(req) },
      { upsert: true, new: true }
    );
    res.json({ success: true, nivel });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ====================== SEGUIMIENTO: quién abrió y quién no ======================

router.post('/item/:id/vista', async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
    const item = await CapacitacionContenido.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    if (item.seccion === 'crecimiento' && !CAN_TRACK.includes(req.user?.role)) {
      const ctx = await cargarContexto();
      const u = yo(req);
      if (!esMiembro(u, ctx) || nivelDe(u, ctx) < item.nivel) return res.status(403).json({ error: 'Sin acceso a este contenido' });
    }

    await CapacitacionVista.create({
      contenidoId: item._id,
      titulo: item.titulo,
      usuarioId: req.user?.id || '',
      usuarioUsername: req.user?.username || '',
      usuarioNombre: req.user?.name || req.user?.username || '',
      usuarioRole: req.user?.role || '',
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cuántos de los esperados han abierto cada contenido
router.get('/seguimiento/conteo', requireRoles(CAN_TRACK), async (req, res) => {
  try {
    const [items, ctx, vistas] = await Promise.all([
      CapacitacionContenido.find({}, { seccion: 1, nivel: 1 }).lean(),
      cargarContexto(),
      CapacitacionVista.find({ contenidoId: { $ne: null } }, { contenidoId: 1, usuarioId: 1 }).lean(),
    ]);
    const porItem = new Map();
    for (const v of vistas) {
      const k = String(v.contenidoId);
      if (!porItem.has(k)) porItem.set(k, new Set());
      porItem.get(k).add(String(v.usuarioId));
    }
    const resultado = {};
    for (const it of items) {
      const pob = poblacion(it.seccion, it.nivel, ctx);
      const ids = new Set(pob.map((p) => p.id));
      let abrieron = 0;
      for (const uid of porItem.get(String(it._id)) || []) if (ids.has(uid)) abrieron++;
      resultado[String(it._id)] = { abrieron, esperados: pob.length };
    }
    res.json(resultado);
  } catch (e) {
    console.error('Error en conteo de seguimiento:', e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Detalle de un contenido: quién abrió (y cuántas veces) y quién todavía no
router.get('/item/:id/seguimiento', requireRoles(CAN_TRACK), async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
    const item = await CapacitacionContenido.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    const [ctx, vistas] = await Promise.all([
      cargarContexto(),
      CapacitacionVista.find({ contenidoId: item._id }).lean(),
    ]);

    const grupos = new Map();
    for (const v of vistas) {
      const id = String(v.usuarioId);
      const g = grupos.get(id) || { id, nombre: v.usuarioNombre, username: v.usuarioUsername, role: v.usuarioRole, tipo: null, veces: 0, ultima: null };
      g.veces++;
      if (!g.ultima || v.createdAt > g.ultima) g.ultima = v.createdAt;
      grupos.set(id, g);
    }
    const porId = new Map(ctx.usuarios.map((u) => [idDe(u), u]));
    const abrieron = Array.from(grupos.values())
      .map((g) => (porId.has(g.id) ? { ...g, ...persona(porId.get(g.id), ctx) } : g))
      .sort((a, b) => new Date(b.ultima) - new Date(a.ultima));

    const pendientes = poblacion(item.seccion, item.nivel, ctx)
      .filter((p) => !grupos.has(p.id))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

    res.json({ titulo: item.titulo, seccion: item.seccion, abrieron, pendientes });
  } catch (e) {
    console.error('Error en seguimiento de contenido:', e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
