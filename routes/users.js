import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRoles, signAuthToken } from '../middleware/auth.js';
import ActivityEvent from '../models/ActivityEvent.js';

const router = express.Router();

// Hash simple de contraseña (compatible con el frontend)
function hashPassword(password) {
  return Buffer.from(password).toString('base64').split('').reverse().join('');
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = username.trim().toLowerCase();
    
    const user = await User.findOne({ username: cleanUsername });
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
    
    const passwordHash = hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }

    // Registrar último login (y evento)
    try {
      user.lastLoginAt = new Date();
      await user.save();
      await ActivityEvent.create({
        type: 'login',
        module: 'auth',
        userId: user._id,
        username: user.username,
        role: user.role,
        region: user.region || '',
        meta: {
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
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
    const { username, password, name, role, email, region } = req.body;
    const cleanUsername = username.trim().toLowerCase();
    
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'El usuario ya existe' });
    }
    
    const passwordHash = hashPassword(password);
    
    const user = new User({
      username: cleanUsername,
      passwordHash,
      name: name.trim(),
      role,
      email: email?.trim() || '',
      region: (role === 'regionales' && region) ? region.trim() : ''
    });
    
    await user.save();
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        region: user.region || ''
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
    
    const passwordHash = hashPassword(password);
    
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
    const { name, role, email, region } = req.body;
    const updateData = {};
    
    if (name) updateData.name = name.trim();
    if (role) updateData.role = role;
    if (email !== undefined) updateData.email = email.trim();
    if (region !== undefined) updateData.region = region.trim();
    
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
        region: user.region || ''
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

