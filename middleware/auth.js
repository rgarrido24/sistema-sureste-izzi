import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

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
      region: user.region || ''
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

