import express from 'express';
import crypto from 'crypto';
import Capacitacion from '../models/Capacitacion.js';
import CapacitacionVista from '../models/CapacitacionVista.js';
import RecursoCapacitacion from '../models/RecursoCapacitacion.js';
import CapacitacionConfig from '../models/CapacitacionConfig.js';
import CapacitacionAcceso from '../models/CapacitacionAcceso.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const CAN_EDIT = ['admin', 'admin_general', 'director'];
const CAN_VER_VISTAS = ['admin', 'admin_general', 'director', 'marketing'];

// --- Candado de pregrabadas: se desbloquean con un código que se da al final de cada capacitación en vivo ---
// Roles que no necesitan código (administran o supervisan el contenido)
const EXENTOS_CODIGO = ['admin', 'admin_general', 'director', 'marketing'];
const MAX_INTENTOS_FALLIDOS = 5;
const VENTANA_BLOQUEO_MIN = 15;

const normalizarCodigo = (s) => String(s || '').trim().toUpperCase();
const hashCodigo = (s) => crypto.createHash('sha256').update(String(s)).digest();
const codigosIguales = (a, b) => crypto.timingSafeEqual(hashCodigo(a), hashCodigo(b));

async function getConfigPregrabadas() {
  return CapacitacionConfig.findOneAndUpdate(
    { clave: 'pregrabadas' },
    { $setOnInsert: { clave: 'pregrabadas', codigo: '', version: 1, horasAcceso: 24 } },
    { upsert: true, new: true }
  );
}

// ¿Este usuario puede ver los links de las pregrabadas ahorita?
async function accesoPregrabadas(user) {
  if (EXENTOS_CODIGO.includes(user?.role)) return { ok: true, exento: true, expiraEn: null };
  const cfg = await getConfigPregrabadas();
  if (!cfg.codigo) return { ok: false, exento: false, expiraEn: null };
  const acceso = await CapacitacionAcceso.findOne({
    usuarioId: String(user?.id || ''),
    exito: true,
    version: cfg.version,
    expiraEn: { $gt: new Date() },
  }).sort({ expiraEn: -1 }).lean();
  return acceso
    ? { ok: true, exento: false, expiraEn: acceso.expiraEn }
    : { ok: false, exento: false, expiraEn: null };
}

// Cualquier usuario autenticado puede VER el calendario
router.get('/', async (req, res) => {
  try {
    const celdas = await Capacitacion.find({}).sort({ orden: 1, dia: 1 }).lean();
    res.json(celdas);
  } catch (error) {
    console.error('Error obteniendo capacitaciones:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear o actualizar una celda (upsert por horario+dia)
router.post('/', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const { horario, dia, titulo, color, link, orden } = req.body;
    if (!horario || !dia) {
      return res.status(400).json({ error: 'Falta horario o día' });
    }

    const celda = await Capacitacion.findOneAndUpdate(
      { horario, dia },
      {
        horario, dia,
        titulo: titulo || '',
        color: color || '#fde9c8',
        link: link || '',
        orden: orden ?? 0,
        actualizadoPorNombre: req.user?.name || req.user?.username || '',
        actualizadoPorUsername: req.user?.username || '',
      },
      { upsert: true, new: true }
    );

    res.json(celda);
  } catch (error) {
    console.error('Error guardando celda de capacitación:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Registrar que un usuario abrió el link de una celda (cualquier autenticado)
router.post('/:id/vista', async (req, res) => {
  try {
    const celda = await Capacitacion.findById(req.params.id).lean();
    if (!celda) return res.status(404).json({ error: 'No encontrada' });

    await CapacitacionVista.create({
      capacitacionId: celda._id,
      horario: celda.horario,
      dia: celda.dia,
      titulo: celda.titulo,
      usuarioId: req.user?.id || '',
      usuarioUsername: req.user?.username || '',
      usuarioNombre: req.user?.name || req.user?.username || '',
      usuarioRole: req.user?.role || '',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error registrando vista de capacitación:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Conteo de vistas por celda (para mostrar el ojito con número)
router.get('/vistas/conteo', requireRoles(CAN_VER_VISTAS), async (req, res) => {
  try {
    const conteos = await CapacitacionVista.aggregate([
      { $group: { _id: '$capacitacionId', total: { $sum: 1 } } }
    ]);
    const resultado = {};
    conteos.forEach(c => { resultado[c._id.toString()] = c.total; });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Quién vio una celda específica
router.get('/:id/vistas', requireRoles(CAN_VER_VISTAS), async (req, res) => {
  try {
    const vistas = await CapacitacionVista.find({ capacitacionId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(vistas);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// --- RECURSOS: pregrabadas y exámenes (links sueltos, fuera del calendario semanal) ---

// Estado del candado para el usuario actual (para mostrar el mensaje correcto en pantalla)
router.get('/recursos/estado', async (req, res) => {
  try {
    const cfg = await getConfigPregrabadas();
    const acceso = await accesoPregrabadas(req.user);
    res.json({
      exento: !!acceso.exento,
      desbloqueado: acceso.ok,
      expiraEn: acceso.expiraEn,
      codigoConfigurado: !!cfg.codigo,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Desbloquear pregrabadas con el código de la capacitación en vivo
router.post('/recursos/desbloquear', async (req, res) => {
  try {
    const usuarioId = String(req.user?.id || '');
    const cfg = await getConfigPregrabadas();
    if (!cfg.codigo) {
      return res.status(400).json({ error: 'El acceso a las pregrabadas todavía no está activado. Contacta al administrador.' });
    }

    const desde = new Date(Date.now() - VENTANA_BLOQUEO_MIN * 60 * 1000);
    const fallos = await CapacitacionAcceso.countDocuments({ usuarioId, exito: false, createdAt: { $gte: desde } });
    if (fallos >= MAX_INTENTOS_FALLIDOS) {
      return res.status(429).json({ error: `Demasiados intentos fallidos. Espera ${VENTANA_BLOQUEO_MIN} minutos o contacta al administrador.` });
    }

    const base = {
      usuarioId,
      usuarioUsername: req.user?.username || '',
      usuarioNombre: req.user?.name || req.user?.username || '',
      usuarioRole: req.user?.role || '',
      version: cfg.version,
    };

    const intento = normalizarCodigo(req.body?.codigo);
    // OJO: no usar 401 aquí, el frontend cierra la sesión con cualquier 401.
    if (!intento || !codigosIguales(intento, cfg.codigo)) {
      await CapacitacionAcceso.create({ ...base, exito: false });
      return res.status(403).json({ error: 'Código incorrecto. El código se da al final de cada capacitación en vivo.' });
    }

    const expiraEn = new Date(Date.now() + (cfg.horasAcceso || 24) * 60 * 60 * 1000);
    await CapacitacionAcceso.create({ ...base, exito: true, expiraEn });
    res.json({ success: true, expiraEn });
  } catch (error) {
    console.error('Error desbloqueando pregrabadas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Ver el código vigente y la duración del acceso (solo admin/director)
router.get('/recursos/config', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const cfg = await getConfigPregrabadas();
    res.json({ codigo: cfg.codigo, version: cfg.version, horasAcceso: cfg.horasAcceso });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Cambiar el código y/o la duración. Si cambia el código, se cancelan todos los accesos vigentes.
router.put('/recursos/config', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const { codigo, horasAcceso } = req.body || {};
    const cfg = await getConfigPregrabadas();
    const update = {
      actualizadoPorNombre: req.user?.name || req.user?.username || '',
      actualizadoPorUsername: req.user?.username || '',
    };

    if (codigo !== undefined) {
      const nuevo = normalizarCodigo(codigo);
      if (nuevo.length < 4) return res.status(400).json({ error: 'El código debe tener al menos 4 caracteres' });
      if (nuevo !== cfg.codigo) {
        update.codigo = nuevo;
        update.version = (cfg.version || 1) + 1;
      }
    }
    if (horasAcceso !== undefined) {
      const h = Number(horasAcceso);
      if (!(h >= 1 && h <= 720)) return res.status(400).json({ error: 'La duración debe ser entre 1 y 720 horas' });
      update.horasAcceso = h;
    }

    const actualizado = await CapacitacionConfig.findByIdAndUpdate(cfg._id, update, { new: true });
    res.json({ codigo: actualizado.codigo, version: actualizado.version, horasAcceso: actualizado.horasAcceso });
  } catch (error) {
    console.error('Error guardando config de pregrabadas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Últimos intentos de desbloqueo (quién entró y quién falló)
router.get('/recursos/accesos', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const accesos = await CapacitacionAcceso.find({}).sort({ createdAt: -1 }).limit(100).lean();
    res.json(accesos);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/recursos', async (req, res) => {
  try {
    const recursos = await RecursoCapacitacion.find({}).sort({ tipo: 1, orden: 1, createdAt: 1 }).lean();
    const acceso = await accesoPregrabadas(req.user);
    // El link de las pregrabadas NUNCA sale del servidor si el usuario no ha desbloqueado
    const resultado = recursos.map((r) => {
      if (r.tipo === 'pregrabada' && !acceso.ok) {
        const { link, ...resto } = r;
        return { ...resto, bloqueado: true };
      }
      return r;
    });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/recursos', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const { tipo, titulo, link, descripcion, orden } = req.body;
    if (!tipo || !titulo || !link) {
      return res.status(400).json({ error: 'Falta tipo, título o liga' });
    }
    const recurso = await RecursoCapacitacion.create({
      tipo, titulo, link, descripcion: descripcion || '', orden: orden ?? 0,
      actualizadoPorNombre: req.user?.name || req.user?.username || '',
      actualizadoPorUsername: req.user?.username || '',
    });
    res.json(recurso);
  } catch (error) {
    console.error('Error creando recurso de capacitación:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/recursos/:id', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    const { titulo, link, descripcion, orden } = req.body;
    const update = {};
    if (titulo !== undefined) update.titulo = titulo;
    if (link !== undefined) update.link = link;
    if (descripcion !== undefined) update.descripcion = descripcion;
    if (orden !== undefined) update.orden = orden;
    update.actualizadoPorNombre = req.user?.name || req.user?.username || '';
    update.actualizadoPorUsername = req.user?.username || '';

    const recurso = await RecursoCapacitacion.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!recurso) return res.status(404).json({ error: 'No encontrado' });
    res.json(recurso);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/recursos/:id', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    await RecursoCapacitacion.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Registrar vista de un recurso (cualquier autenticado)
router.post('/recursos/:id/vista', async (req, res) => {
  try {
    const recurso = await RecursoCapacitacion.findById(req.params.id).lean();
    if (!recurso) return res.status(404).json({ error: 'No encontrado' });

    if (recurso.tipo === 'pregrabada') {
      const acceso = await accesoPregrabadas(req.user);
      if (!acceso.ok) return res.status(403).json({ error: 'Acceso bloqueado' });
    }

    await CapacitacionVista.create({
      recursoId: recurso._id,
      titulo: recurso.titulo,
      usuarioId: req.user?.id || '',
      usuarioUsername: req.user?.username || '',
      usuarioNombre: req.user?.name || req.user?.username || '',
      usuarioRole: req.user?.role || '',
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Conteo de vistas por recurso
router.get('/recursos/vistas/conteo', requireRoles(CAN_VER_VISTAS), async (req, res) => {
  try {
    const conteos = await CapacitacionVista.aggregate([
      { $match: { recursoId: { $ne: null } } },
      { $group: { _id: '$recursoId', total: { $sum: 1 } } }
    ]);
    const resultado = {};
    conteos.forEach(c => { resultado[c._id.toString()] = c.total; });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Quién vio un recurso específico
router.get('/recursos/:id/vistas', requireRoles(CAN_VER_VISTAS), async (req, res) => {
  try {
    const vistas = await CapacitacionVista.find({ recursoId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(vistas);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/:id', requireRoles(CAN_EDIT), async (req, res) => {
  try {
    await Capacitacion.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando celda de capacitación:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
