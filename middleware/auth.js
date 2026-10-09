import jwt from 'jsonwebtoken';
import { resolverJwtSecret, advertirCredencialesComprometidas } from '../utils/jwtSecret.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const estadoSecreto = resolverJwtSecret();
const JWT_SECRET = estadoSecreto.secret;
advertirCredencialesComprometidas(estadoSecreto);

export function signAuthToken(user) {
  const payload = {
    sub: String(user._id),
    username: user.username,
    role: user.role,
    region: user.region || ''
  };

  // 7 días (se puede ajustar)
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  try {
    // Si la DB no está lista, responder rápido (evita que Render/Cloudflare termine en 502)
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Base de datos no disponible',
        message: 'El servidor no puede validar tu sesión porque MongoDB no está conectado. Revisa MONGODB_URI en Render.',
      });
    }

    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded?.sub;
    if (!userId) return res.status(401).json({ error: 'Token inválido' });

    // Cargar usuario actual (por si cambió el rol/region)
    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    req.user = {
      id: String(user._id),
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email || '',
      region: user.region || '',
      plazas: Array.isArray(user.plazas) ? user.plazas : [],
      hubs: Array.isArray(user.hubs) ? user.hubs : []
    };

    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireRoles(roles = []) {
  const allowed = new Set(roles);
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.has(role)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    next();
  };
}

// Verificación liviana (solo la firma, sin base de datos) para la puerta de entrada
export function tokenValido(token) {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}
