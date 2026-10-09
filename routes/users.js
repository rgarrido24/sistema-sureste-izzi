import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRoles, signAuthToken } from '../middleware/auth.js';
import ActivityEvent from '../models/ActivityEvent.js';
import M1Master from '../models/M1Master.js';
import OperacionDia from '../models/OperacionDia.js';
import VendedorFactor from '../models/VendedorFactor.js';
import { normalizarNombre } from '../utils/comisionesCalc.js';
import { hashPassword, verificarPasswordUsuario, simularVerificacionPassword } from '../utils/passwords.js';

const router = express.Router();


// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > 100 || password.length > 200) {
      return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
    }
    const cleanUsername = username.trim().toLowerCase();
    
    const user = await User.findOne({ username: cleanUsername });
    
    if (!user) {
      await simularVerificacionPassword(password);
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
    
    const passwordOk = await verificarPasswordUsuario(user, password);
    if (!passwordOk) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }

    // Registrar último login (y evento)
    try {
      user.lastLoginAt = new Date();
      await user.save();

    // Un vendedor se da de alta ya clasificado: venta directa o distribuidor/subdistribuidor (queda en Comisiones → Base de vendedores)
    if (role === 'vendedor' && ['directa', 'distribuidor'].includes(tipoVendedor)) {
      try {
        const nombreLimpio = user.name.replace(/\s+/g, ' ').trim().toUpperCase();
        const clave = normalizarNombre(nombreLimpio);
        const existentes = await VendedorFactor.find({}, { vendedor: 1 }).lean();
        const previo = existentes.find((d) => normalizarNombre(d.vendedor) === clave);
        const quien = { actualizadoPorId: req.user?.id || '', actualizadoPorUsername: req.user?.username || '', actualizadoPorNombre: req.user?.name || req.user?.username || '' };
        if (previo) await VendedorFactor.updateOne({ _id: previo._id }, { $set: { tipo: tipoVendedor, ...quien } });
        else await VendedorFactor.create({ vendedor: nombreLimpio, tipo: tipoVendedor, retencionPorcentaje: tipoVendedor === 'distribuidor' ? 10 : 0, ...quien });
      } catch (err) {
        console.error('No se pudo clasificar al vendedor nuevo:', err?.message || err);
      }
    }
      await ActivityEvent.create({
        type: 'login',
        module: 'auth',
        userId: user._id,
        username: user.username,
        role: user.role,
        region: user.region || '',
        meta: {
          ip: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        },
      });
    } catch (e) {
      // No bloquear login por un fallo de auditoría
      console.warn('⚠️ No se pudo registrar evento de login:', e?.message || e);
    }
    
    const token = signAuthToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email || '',
        region: user.region || '',
        plazas: Array.isArray(user.plazas) ? user.plazas : [],
        lastLoginAt: user.lastLoginAt || null,
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

// Crear usuario
router.post('/create', requireAuth, requireRoles(['admin', 'admin_general', 'usuarios']), async (req, res) => {
  try {
    const { username, password, name, role, email, region, plazas, tipoVendedor } = req.body;
    const cleanUsername = username.trim().toLowerCase();
    
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    if (role === 'supervisor' && (!Array.isArray(plazas) || plazas.length === 0) && !String(region || '').trim()) {
      return res.status(400).json({ success: false, error: 'Selecciona al menos una plaza (o toda la región) para el supervisor' });
    }
    
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'El usuario ya existe' });
    }
    
    const passwordHash = await hashPassword(password);
    
    const user = new User({
      username: cleanUsername,
      passwordHash,
      name: name.trim(),
      role,
      email: email?.trim() || '',
      region: ((role === 'regionales' || role === 'supervisor') && region) ? region.trim() : '',
      plazas: (role === 'supervisor' && Array.isArray(plazas)) ? plazas.map(p => String(p).trim()).filter(Boolean) : []
    });
    
    await user.save();
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        region: user.region || '',
        plazas: user.plazas || []
      }
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    console.error('Detalles del error:', error.message);
    console.error('Stack:', error.stack);
    // Si es un error de validación de Mongoose, devolver mensaje más específico
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, error: `Error de validación: ${errors}` });
    }
    // Si es un error de duplicado
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'El usuario ya existe' });
    }
    res.status(500).json({ success: false, error: 'Error del servidor: ' + error.message });
  }
});

// Lista de plazas disponibles, para el selector múltiple al crear un supervisor
router.get('/plazas-disponibles', requireAuth, requireRoles(['admin', 'admin_general', 'usuarios']), async (req, res) => {
  try {
    const [plazasM1, plazasOperacion] = await Promise.all([
      M1Master.distinct('PLAZA'),
      OperacionDia.distinct('Plaza'),
    ]);
    const set = new Set();
    [...(plazasM1 || []), ...(plazasOperacion || [])].forEach(p => {
      const v = String(p || '').trim().toUpperCase();
      if (v) set.add(v);
    });
    res.json(Array.from(set).sort());
  } catch (error) {
    console.error('Error obteniendo plazas disponibles:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener todos los usuarios
router.get('/', requireAuth, requireRoles(['admin', 'admin_general', 'usuarios', 'mesa_control']), async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 });
    const usersWithRegion = users.map(user => {
      const obj = user.toObject ? user.toObject() : user;
      return { ...obj, region: obj.region || '' };
    });
    res.json(usersWithRegion);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Eliminar usuario
router.delete('/:id', requireAuth, requireRoles(['admin', 'admin_general', 'usuarios']), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar contraseña de usuario
router.put('/:id/password', requireAuth, requireRoles(['admin', 'admin_general', 'usuarios']), async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    const passwordHash = await hashPassword(password);
    
    await User.findByIdAndUpdate(req.params.id, { passwordHash });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

// Actualizar usuario (nombre, role, email)
router.put('/:id', requireAuth, requireRoles(['admin', 'admin_general', 'usuarios']), async (req, res) => {
  try {
    const { name, role, email, region, plazas } = req.body;
    const updateData = {};
    
    if (name) updateData.name = name.trim();
    if (role) updateData.role = role;
    if (email !== undefined) updateData.email = email.trim();
    if (region !== undefined) updateData.region = region.trim();
    if (plazas !== undefined) {
      updateData.plazas = Array.isArray(plazas) ? plazas.map(p => String(p).trim()).filter(Boolean) : [];
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email || '',
        region: user.region || '',
        plazas: user.plazas || []
      }
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, error: `Error de validación: ${errors}` });
    }
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

export default router;

