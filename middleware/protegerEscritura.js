import { requireAuth, requireRoles } from './auth.js';

// Protege un router completo:
//  - Lecturas (GET/HEAD): piden sesión; o quedan públicas con lecturaPublica = true (ej. ligas de videos que se comparten).
//  - Todo lo demás (crear, importar, borrar): sesión + uno de los roles indicados.
//  - OPTIONS (preflight de CORS) siempre pasa.
export function protegerEscritura({ roles, lecturaPublica = false }) {
  const soloRoles = requireRoles(roles);
  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const esLectura = req.method === 'GET' || req.method === 'HEAD';
    if (esLectura && lecturaPublica) return next();
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (esLectura) return next();
      soloRoles(req, res, next);
    });
  };
}
