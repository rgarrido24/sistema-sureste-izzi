// Corta con 403 a ciertos roles aunque llamen la API directo (ocultar un botón en pantalla no basta).
// Va DESPUÉS de requireAuth: app.use('/api/x', requireAuth, bloquearRoles([...]), router)
export const bloquearRoles = (roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? res.status(403).json({ error: 'Sin acceso a este módulo' }) : next();
