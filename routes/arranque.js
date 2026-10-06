import express from 'express';
import mongoose from 'mongoose';
import Onboarding from '../models/Onboarding.js';
import OnboardingConfig from '../models/OnboardingConfig.js';
import User from '../models/User.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { notifyRoles } from '../utils/pushSender.js';
import { hashPassword } from '../utils/passwords.js';
import M1Master from '../models/M1Master.js';
import VendedorFactor from '../models/VendedorFactor.js';
import { getItemVendedores } from '../src/utils/helpers.js';
import { normalizarNombre } from '../utils/comisionesCalc.js';
import { coincideNombrePortal } from '../utils/nombresPortal.js';
import { parsearTelefono, parsearFecha } from '../utils/vendedoresMaster.js';

const router = express.Router();
router.use(requireAuth);

// Mesa de Control y dirección: confirman pasos, reabren, liberan, configuran el grupo
const STAFF_EDIT = ['admin', 'admin_general', 'director', 'mesa_control'];
// Pueden ver el tablero de seguimiento
const STAFF_VER = [...STAFF_EDIT, 'supervisor', 'regionales', 'marketing'];
// Marketing recibe los datos de reclutamiento y da de alta al usuario (solo rol redes_sociales)
const PUEDE_DAR_ALTA = [...STAFF_EDIT, 'marketing'];
const PUEDE_EDITAR_RECLUTADOR = [...STAFF_EDIT, 'marketing'];
// El reclutador también ve el tablero, pero solo con SUS reclutados
const VER_TABLERO = [...STAFF_VER, 'reclutador'];

const MS_DIA = 24 * 60 * 60 * 1000;

// Pasos del arranque, en orden.
// tipo 'staff'     → solo lo confirma Mesa de Control
// tipo 'evidencia' → el usuario entrega links como prueba
// tipo 'simple'    → el usuario lo marca
const PASOS = [
  {
    clave: 'capacitacion_vivo',
    titulo: 'Tomar la capacitación de nuevo ingreso en vivo',
    descripcion: 'Asiste a la capacitación en vivo (inducción y redes sociales). Marketing confirma tu asistencia.',
    tipo: 'staff',
    validaPor: 'marketing',
  },
  {
    clave: 'perfil_facebook',
    titulo: 'Crear tu perfil de Facebook',
    descripcion: 'Sigue la guía del Asistente IA para crear tu perfil desde cero. Pega aquí el link de tu perfil.',
    tipo: 'evidencia',
    minEvidencias: 1,
    dominios: ['facebook.com', 'fb.com', 'fb.me'],
    placeholder: 'https://www.facebook.com/tu.perfil',
  },
  {
    clave: 'primeros_posts',
    titulo: 'Publicar tus primeros 3 posts',
    descripcion: 'Usa las imágenes de la sección Imágenes. Pega el link de cada publicación, uno por línea.',
    tipo: 'evidencia',
    minEvidencias: 3,
    placeholder: 'https://...\nhttps://...\nhttps://...',
  },
  {
    clave: 'unido_grupo',
    titulo: 'Unirte al grupo de Mesa de Control',
    descripcion: 'Ya desbloqueaste el grupo. Únete para recibir seguimiento y resolver dudas.',
    tipo: 'simple',
  },
  {
    clave: 'primer_lead',
    titulo: 'Tu primer lead o primera venta',
    descripcion: 'Es la meta de tu primera semana. Mesa de Control lo confirma cuando lo registres.',
    tipo: 'staff',
    validaPor: 'mesa_control',
  },
];

// Con estos 3 pasos completos se desbloquea el link del grupo
const PASOS_GRUPO = ['capacitacion_vivo', 'perfil_facebook', 'primeros_posts'];
// Pasos que el usuario no puede hacer hasta cumplir otros (los de staff no se bloquean)
const REQUIERE = {
  primeros_posts: ['perfil_facebook'],
  unido_grupo: PASOS_GRUPO,
};

// Venta directa no hace el checklist de redes (perfil de Facebook, posts, grupo): solo se le da seguimiento
// a su capacitación en vivo (la valida Marketing) y a su primer lead (lo valida Mesa de Control).
const PASOS_DIRECTA = ['capacitacion_vivo', 'primer_lead'];
const pasosDe = (perfil) => (perfil === 'directa' ? PASOS.filter((p) => PASOS_DIRECTA.includes(p.clave)) : PASOS);

// Quién puede confirmar/reabrir cada paso de tipo "staff". Dirección siempre puede (por si falta alguien).
// La capacitación en vivo la valida Marketing (ellos la imparten); el primer lead, Mesa de Control.
const VALIDADORES = {
  marketing: ['marketing', 'admin', 'admin_general', 'director'],
  mesa_control: ['mesa_control', 'admin', 'admin_general', 'director'],
};
const ETIQUETA_VALIDADOR = { marketing: 'Marketing', mesa_control: 'Mesa de Control' };
const PUEDEN_VALIDAR = [...STAFF_EDIT, 'marketing'];
const puedeValidar = (role, def) => (VALIDADORES[def.validaPor] || STAFF_EDIT).includes(role);

// --- helpers ---

const tituloDe = (clave) => PASOS.find((p) => p.clave === clave)?.titulo || clave;
const estadoPaso = (pasos, clave) => (pasos || []).find((p) => p.clave === clave) || { clave, completado: false };
const estaCompleto = (pasos, clave) => !!estadoPaso(pasos, clave).completado;
const grupoDesbloqueado = (pasos) => PASOS_GRUPO.every((c) => estaCompleto(pasos, c));
const faltantes = (pasos, clave) => (REQUIERE[clave] || []).filter((c) => !estaCompleto(pasos, c));
const diaActual = (altaEn) => Math.floor((Date.now() - new Date(altaEn).getTime()) / MS_DIA) + 1;
const diasDesde = (fecha) => Math.floor((Date.now() - new Date(fecha).getTime()) / MS_DIA);
const idValido = (id) => mongoose.isValidObjectId(id);

async function getConfig() {
  return OnboardingConfig.findOneAndUpdate(
    { clave: 'arranque' },
    { $setOnInsert: { clave: 'arranque', grupoLink: '', responsableNombre: '', diasMeta: 7 } },
    { upsert: true, new: true }
  );
}

// Si se agregan pasos nuevos en el futuro, los registros viejos los reciben vacíos
function asegurarPasos(doc) {
  let cambio = false;
  for (const def of pasosDe(doc.perfil)) {
    if (!doc.pasos.some((p) => p.clave === def.clave)) {
      doc.pasos.push({ clave: def.clave });
      cambio = true;
    }
  }
  return cambio;
}

async function obtenerOCrear(user) {
  const usuarioId = String(user.id);
  let doc = await Onboarding.findOne({ usuarioId });
  if (!doc) {
    const u = await User.findById(usuarioId).lean();
    const alta = u?.createdAt || new Date();
    try {
      doc = await Onboarding.create({
        usuarioId,
        usuarioUsername: user.username || '',
        usuarioNombre: user.name || user.username || '',
        altaEn: alta,
        ultimoAvanceEn: alta,
        pasos: PASOS.map((p) => ({ clave: p.clave })),
      });
    } catch (e) {
      if (e?.code === 11000) doc = await Onboarding.findOne({ usuarioId }); // carrera entre dos requests
      else throw e;
    }
  }
  if (asegurarPasos(doc)) await doc.save();
  return doc;
}

function normalizarUrl(raw) {
  let t = String(raw || '').trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
  try {
    const u = new URL(t);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const hostCoincide = (url, dominios) => {
  const h = new URL(url).hostname.toLowerCase();
  return dominios.some((d) => h === d || h.endsWith('.' + d));
};

function vistaUsuario(doc, cfg) {
  const desbloqueado = grupoDesbloqueado(doc.pasos);
  const pasos = PASOS.map((def) => {
    const st = estadoPaso(doc.pasos, def.clave);
    const faltan = def.tipo === 'staff' ? [] : faltantes(doc.pasos, def.clave);
    return {
      clave: def.clave,
      titulo: def.titulo,
      descripcion: def.descripcion,
      tipo: def.tipo,
      validador: ETIQUETA_VALIDADOR[def.validaPor] || 'Mesa de Control',
      minEvidencias: def.minEvidencias || 0,
      placeholder: def.placeholder || '',
      completado: !!st.completado,
      completadoEn: st.completadoEn || null,
      completadoPor: st.completadoPor || '',
      evidencias: st.evidencias || [],
      bloqueado: !st.completado && faltan.length > 0,
      faltan: faltan.map(tituloDe),
    };
  });
  return {
    pasos,
    progreso: { completados: pasos.filter((p) => p.completado).length, total: pasos.length },
    dia: diaActual(doc.altaEn),
    diasMeta: cfg.diasMeta || 7,
    liberado: !!doc.liberado,
    atorado: { activo: !!doc.atorado?.activo, mensaje: doc.atorado?.mensaje || '', desde: doc.atorado?.desde || null },
    grupo: {
      desbloqueado,
      // El link NUNCA sale del servidor hasta que los pasos requeridos estén completos
      link: desbloqueado ? cfg.grupoLink || '' : '',
      configurado: !!cfg.grupoLink,
      responsable: cfg.responsableNombre || '',
      faltan: desbloqueado ? [] : PASOS_GRUPO.filter((c) => !estaCompleto(doc.pasos, c)).map(tituloDe),
    },
  };
}

// ====================== USUARIO (rol redes_sociales) ======================

router.get('/mi', requireRoles(['redes_sociales']), async (req, res) => {
  try {
    const [doc, cfg] = await Promise.all([obtenerOCrear(req.user), getConfig()]);
    res.json(vistaUsuario(doc, cfg));
  } catch (error) {
    console.error('Error obteniendo mi arranque:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/mi/paso/:clave', requireRoles(['redes_sociales']), async (req, res) => {
  try {
    const def = PASOS.find((p) => p.clave === req.params.clave);
    if (!def) return res.status(404).json({ error: 'Paso no encontrado' });
    if (def.tipo === 'staff') {
      return res.status(403).json({ error: 'Este paso lo confirma Mesa de Control.' });
    }

    const doc = await obtenerOCrear(req.user);
    const paso = doc.pasos.find((p) => p.clave === def.clave);
    if (paso.completado) return res.status(400).json({ error: 'Este paso ya está completado.' });

    const faltan = faltantes(doc.pasos, def.clave);
    if (faltan.length) {
      return res.status(400).json({ error: `Primero completa: ${faltan.map(tituloDe).join(', ')}.` });
    }

    let evidencias = [];
    if (def.tipo === 'evidencia') {
      const b = req.body?.evidencias;
      const crudas = Array.isArray(b) ? b : String(b || '').split(/\s+/);
      const limpias = crudas.map((c) => String(c || '').trim()).filter(Boolean);

      const normalizadas = [];
      for (const c of limpias) {
        const url = normalizarUrl(c);
        if (!url) return res.status(400).json({ error: `Este link no es válido: ${c}` });
        if (def.dominios && !hostCoincide(url, def.dominios)) {
          return res.status(400).json({ error: 'El link debe ser de Facebook (facebook.com).' });
        }
        if (!normalizadas.includes(url)) normalizadas.push(url);
      }

      if (normalizadas.length < def.minEvidencias) {
        return res.status(400).json({
          error: `Necesitas al menos ${def.minEvidencias} link(s) distinto(s). Llevas ${normalizadas.length}.`,
        });
      }
      evidencias = normalizadas.slice(0, 20);
    }

    paso.completado = true;
    paso.completadoEn = new Date();
    paso.completadoPor = 'usuario';
    paso.completadoPorNombre = req.user?.name || req.user?.username || '';
    paso.evidencias = evidencias;
    doc.ultimoAvanceEn = new Date();
    await doc.save();

    const cfg = await getConfig();
    res.json(vistaUsuario(doc, cfg));
  } catch (error) {
    console.error('Error completando paso de arranque:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/mi/atorado', requireRoles(['redes_sociales']), async (req, res) => {
  try {
    const doc = await obtenerOCrear(req.user);
    const mensaje = String(req.body?.mensaje || '').trim().slice(0, 500);
    const yaEstabaAtorado = !!doc.atorado?.activo;

    doc.atorado = { activo: true, mensaje, desde: yaEstabaAtorado ? doc.atorado.desde : new Date() };
    await doc.save();

    // Aviso solo a Mesa de Control/dirección, y solo la primera vez
    if (!yaEstabaAtorado) {
      notifyRoles(STAFF_EDIT, 'Reclutado atorado', `${doc.usuarioNombre}: ${mensaje || 'pide ayuda'}`, '/')
        .catch((e) => console.warn('No se pudo enviar push de atorado:', e?.message || e));
    }

    const cfg = await getConfig();
    res.json(vistaUsuario(doc, cfg));
  } catch (error) {
    console.error('Error marcando atorado:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/mi/atorado', requireRoles(['redes_sociales']), async (req, res) => {
  try {
    const doc = await obtenerOCrear(req.user);
    doc.atorado = { activo: false, mensaje: '', desde: null };
    await doc.save();
    const cfg = await getConfig();
    res.json(vistaUsuario(doc, cfg));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ====================== STAFF ======================

// Configuración: liga del grupo, responsable, plazo (las rutas /config van antes de /:id)
router.get('/config', requireRoles(STAFF_EDIT), async (req, res) => {
  try {
    const cfg = await getConfig();
    res.json({ grupoLink: cfg.grupoLink, responsableNombre: cfg.responsableNombre, diasMeta: cfg.diasMeta });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/config', requireRoles(STAFF_EDIT), async (req, res) => {
  try {
    const { grupoLink, responsableNombre, diasMeta } = req.body || {};
    const update = {
      actualizadoPorNombre: req.user?.name || req.user?.username || '',
      actualizadoPorUsername: req.user?.username || '',
    };

    if (grupoLink !== undefined) {
      const t = String(grupoLink).trim();
      if (t) {
        const url = normalizarUrl(t);
        if (!url) return res.status(400).json({ error: 'La liga del grupo no es válida' });
        update.grupoLink = url;
      } else {
        update.grupoLink = '';
      }
    }
    if (responsableNombre !== undefined) update.responsableNombre = String(responsableNombre).trim().slice(0, 120);
    if (diasMeta !== undefined) {
      const d = Number(diasMeta);
      if (!(d >= 1 && d <= 60)) return res.status(400).json({ error: 'El plazo debe ser entre 1 y 60 días' });
      update.diasMeta = d;
    }

    const cfg = await getConfig();
    const actualizado = await OnboardingConfig.findByIdAndUpdate(cfg._id, update, { new: true });
    res.json({ grupoLink: actualizado.grupoLink, responsableNombre: actualizado.responsableNombre, diasMeta: actualizado.diasMeta });
  } catch (error) {
    console.error('Error guardando config de arranque:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Tablero de seguimiento de todos los reclutados
router.get('/tablero', requireRoles(VER_TABLERO), async (req, res) => {
  try {
    // Un reclutador solo ve a SUS reclutados (los vinculados a su usuario)
    const filtro = req.user?.role === 'reclutador' ? { reclutadorId: String(req.user.id) } : {};
    const [docs, cfg] = await Promise.all([Onboarding.find(filtro).sort({ altaEn: -1 }).lean(), getConfig()]);
    const diasMeta = cfg.diasMeta || 7;

    const items = docs.map((d) => {
      const pasos = pasosDe(d.perfil).map((def) => {
        const st = estadoPaso(d.pasos, def.clave);
        return {
          clave: def.clave,
          titulo: def.titulo,
          tipo: def.tipo,
          validador: ETIQUETA_VALIDADOR[def.validaPor] || '',
          puedoValidar: puedeValidar(req.user?.role, def),
          completado: !!st.completado,
          completadoEn: st.completadoEn || null,
          completadoPor: st.completadoPor || '',
          completadoPorNombre: st.completadoPorNombre || '',
          evidencias: st.evidencias || [],
          nota: st.nota || '',
        };
      });
      const completados = pasos.filter((p) => p.completado).length;
      const etapa = pasos.find((p) => !p.completado) || null;
      const dia = diaActual(d.altaEn);

      return {
        id: d._id,
        usuarioNombre: d.usuarioNombre,
        usuarioUsername: d.usuarioUsername,
        reclutadorNombre: d.reclutadorNombre || '',
        reclutadorId: d.reclutadorId || '',
        perfil: d.perfil || 'redes',
        dia,
        diasSinAvance: diasDesde(d.ultimoAvanceEn || d.altaEn),
        completados,
        total: pasos.length,
        etapaActual: etapa ? { clave: etapa.clave, titulo: etapa.titulo } : null,
        pasos,
        grupoDesbloqueado: grupoDesbloqueado(d.pasos),
        atorado: { activo: !!d.atorado?.activo, mensaje: d.atorado?.mensaje || '', desde: d.atorado?.desde || null },
        liberado: !!d.liberado,
        vencido: !d.liberado && dia > diasMeta && !estaCompleto(d.pasos, 'primer_lead'),
      };
    });

    res.json({ diasMeta, items });
  } catch (error) {
    console.error('Error obteniendo tablero de arranque:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Usuarios con rol reclutador (para vincular a cada reclutado con quien lo reclutó)
router.get('/reclutadores', requireRoles(PUEDE_DAR_ALTA), async (req, res) => {
  try {
    const lista = await User.find({ role: 'reclutador' }, { name: 1, username: 1 }).sort({ name: 1 }).lean();
    res.json(lista.map((u) => ({ id: String(u._id), nombre: u.name, username: u.username })));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Dar de alta a una persona nueva (la hace Marketing con los datos que le pasa reclutamiento).
// Marketing solo puede crear estos DOS perfiles, y el rol sale del perfil, nunca de lo que mande el navegador:
//   redes   → rol redes_sociales (hace el checklist de "Mi Arranque")
//   directa → rol vendedor
// Los dos se registran en la base de vendedores como venta directa (cuentan en ranking, comisiones y crecimiento),
// sin factor: el factor lo define Dirección.
const PERFILES_ALTA = { redes: 'redes_sociales', directa: 'vendedor' };

router.post('/alta', requireRoles(PUEDE_DAR_ALTA), async (req, res) => {
  try {
    const perfil = String(req.body?.perfil || 'redes');
    if (!PERFILES_ALTA[perfil]) {
      return res.status(400).json({ error: 'Perfil no válido: solo redes sociales o venta directa' });
    }

    const nombre = String(req.body?.nombre || '').replace(/\s+/g, ' ').trim();
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const email = String(req.body?.email || '').trim();
    const reclutadorNombre = String(req.body?.reclutadorNombre || '').trim();

    if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    // Datos de contacto (se guardan en la base de vendedores)
    const telefono = parsearTelefono(req.body?.telefono);
    const nacimiento = parsearFecha(req.body?.fechaNacimiento);
    if (nacimiento.error) {
      return res.status(400).json({ error: `Fecha de nacimiento: ${nacimiento.error}` });
    }

    // Si viene reclutadorId, la persona queda vinculada a ese usuario (así el reclutador la ve en su tablero)
    const reclutadorIdIn = String(req.body?.reclutadorId || '').trim();
    let reclutadorId = '';
    let reclutadorNombreFinal = reclutadorNombre;
    if (reclutadorIdIn) {
      const rec = idValido(reclutadorIdIn)
        ? await User.findOne({ _id: reclutadorIdIn, role: 'reclutador' }, { name: 1 }).lean()
        : null;
      if (!rec) return res.status(400).json({ error: 'El reclutador seleccionado no es válido' });
      reclutadorId = String(rec._id);
      reclutadorNombreFinal = rec.name;
    }
    if (!reclutadorNombreFinal) return res.status(400).json({ error: 'Falta quién lo reclutó' });

    if (await User.findOne({ username })) {
      return res.status(400).json({ error: 'Ese usuario ya existe' });
    }

    // Marketing no ve cobranza, y el portal del vendedor decide qué cuentas mostrar POR NOMBRE. Si pudiera crear un
    // usuario con el nombre de otra persona (o uno que se le parezca), vería sus cuentas. Por eso, si el nombre
    // coincide con alguien que ya existe en el sistema, en la base de vendedores o en la cobranza, lo crea Dirección.
    if (!STAFF_EDIT.includes(req.user?.role)) {
      const [usuarios, maestro, m1] = await Promise.all([
        User.find({}, { name: 1 }).lean(),
        VendedorFactor.find({}, { vendedor: 1 }).lean(),
        M1Master.find({}).lean(),
      ]);
      const existentes = [...usuarios.map((u) => u.name), ...maestro.map((v) => v.vendedor)];
      const enCobranza = new Set();
      for (const it of m1) for (const n of getItemVendedores(it)) enCobranza.add(n);
      existentes.push(...enCobranza);
      if (existentes.some((n) => coincideNombrePortal(nombre, n))) {
        return res.status(400).json({
          error: 'Ese nombre coincide con una persona que ya existe en el sistema o en la cobranza. Para que no vea cuentas ajenas, pídele a Dirección que cree ese usuario.',
        });
      }
    }

    const user = await User.create({
      username,
      passwordHash: await hashPassword(password),
      name: nombre,
      role: PERFILES_ALTA[perfil],
      email,
    });

    // Ambos perfiles se registran en la base de vendedores como venta directa (sin factor) para que cuenten
    // en ranking, comisiones y crecimiento
    let enBaseMaestra = false;
    const maestro = await VendedorFactor.find({}, { vendedor: 1 }).lean();
    if (!maestro.some((v) => normalizarNombre(v.vendedor) === normalizarNombre(nombre))) {
      await VendedorFactor.create({
        vendedor: nombre.toUpperCase(),
        tipo: 'directa',
        retencionPorcentaje: 0,
        telefono: telefono.valor || '',
        email: email.toLowerCase(),
        fechaNacimiento: nacimiento.valor || '',
        actualizadoPorId: req.user?.id || '',
        actualizadoPorUsername: req.user?.username || '',
        actualizadoPorNombre: req.user?.name || req.user?.username || '',
      });
      enBaseMaestra = true;
    }

    const ahora = new Date();
    const doc = await Onboarding.create({
      usuarioId: String(user._id),
      usuarioUsername: user.username,
      usuarioNombre: user.name,
      perfil,
      reclutadorId,
      reclutadorNombre: reclutadorNombreFinal.slice(0, 120),
      altaEn: ahora,
      ultimoAvanceEn: ahora,
      pasos: pasosDe(perfil).map((p) => ({ clave: p.clave })),
    });

    res.json({
      success: true,
      perfil,
      usuario: { username: user.username, name: user.name },
      onboardingId: doc._id,
      enBaseMaestra,
      advertencias: telefono.advertencia ? [`Teléfono: ${telefono.advertencia}`] : [],
    });
  } catch (error) {
    console.error('Error dando de alta a persona nueva:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Confirmar un paso (Mesa de Control; puede marcar cualquiera, p. ej. asistencia o primer lead)
router.post('/:id/paso/:clave/confirmar', requireRoles(PUEDEN_VALIDAR), async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
    const def = PASOS.find((p) => p.clave === req.params.clave);
    if (!def) return res.status(404).json({ error: 'Paso no encontrado' });
    if (!puedeValidar(req.user?.role, def)) {
      return res.status(403).json({ error: `Este paso lo valida ${ETIQUETA_VALIDADOR[def.validaPor] || 'Mesa de Control'}.` });
    }

    const doc = await Onboarding.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    asegurarPasos(doc);

    if (!pasosDe(doc.perfil).some((p) => p.clave === def.clave)) {
      return res.status(400).json({ error: 'Ese paso no aplica a este perfil' });
    }
    const paso = doc.pasos.find((p) => p.clave === def.clave);
    if (paso.completado) return res.status(400).json({ error: 'Este paso ya está completado' });

    paso.completado = true;
    paso.completadoEn = new Date();
    paso.completadoPor = 'staff';
    paso.completadoPorNombre = req.user?.name || req.user?.username || '';
    paso.nota = String(req.body?.nota || '').trim().slice(0, 300);
    doc.ultimoAvanceEn = new Date();
    await doc.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error confirmando paso:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Reabrir un paso (p. ej. el link era falso). Solo reabre ese paso; si era requisito del grupo, se vuelve a bloquear.
router.post('/:id/paso/:clave/reabrir', requireRoles(PUEDEN_VALIDAR), async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
    const def = PASOS.find((p) => p.clave === req.params.clave);
    if (!def) return res.status(404).json({ error: 'Paso no encontrado' });
    if (!puedeValidar(req.user?.role, def)) {
      return res.status(403).json({ error: `Este paso lo valida ${ETIQUETA_VALIDADOR[def.validaPor] || 'Mesa de Control'}.` });
    }

    const doc = await Onboarding.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    asegurarPasos(doc);

    if (!pasosDe(doc.perfil).some((p) => p.clave === def.clave)) {
      return res.status(400).json({ error: 'Ese paso no aplica a este perfil' });
    }
    const paso = doc.pasos.find((p) => p.clave === def.clave);
    const motivo = String(req.body?.motivo || '').trim().slice(0, 300);
    paso.completado = false;
    paso.completadoEn = null;
    paso.completadoPor = '';
    paso.completadoPorNombre = '';
    paso.evidencias = [];
    paso.nota = `Reabierto por ${req.user?.name || req.user?.username || 'staff'}${motivo ? ': ' + motivo : ''}`;
    await doc.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error reabriendo paso:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Editar reclutador (Marketing y staff), liberar/reactivar y resolver atorado (solo staff)
router.put('/:id', requireRoles(PUEDE_EDITAR_RECLUTADOR), async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
    const doc = await Onboarding.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });

    const esStaff = STAFF_EDIT.includes(req.user?.role);
    const { reclutadorNombre, reclutadorId, liberado, atoradoResuelto } = req.body || {};

    if ((liberado !== undefined || atoradoResuelto) && !esStaff) {
      return res.status(403).json({ error: 'Solo Mesa de Control puede hacer esto' });
    }

    if (reclutadorId !== undefined) {
      const rid = String(reclutadorId || '').trim();
      if (rid) {
        const rec = idValido(rid) ? await User.findOne({ _id: rid, role: 'reclutador' }, { name: 1 }).lean() : null;
        if (!rec) return res.status(400).json({ error: 'El reclutador seleccionado no es válido' });
        doc.reclutadorId = String(rec._id);
        doc.reclutadorNombre = rec.name;
      } else {
        doc.reclutadorId = '';
        if (reclutadorNombre !== undefined) doc.reclutadorNombre = String(reclutadorNombre).trim().slice(0, 120);
      }
    } else if (reclutadorNombre !== undefined) {
      doc.reclutadorNombre = String(reclutadorNombre).trim().slice(0, 120);
    }
    if (liberado !== undefined) doc.liberado = !!liberado;
    if (atoradoResuelto) doc.atorado = { activo: false, mensaje: '', desde: null };

    await doc.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando arranque:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
