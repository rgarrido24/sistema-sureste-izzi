import { tipoDeVendedor } from '../utils/tipoVendedor.js';

// Los distribuidores no ven Ranking ni Puntos. Ocultar la pestaña no basta: aquí se corta con 403
// aunque llamen la API directo. Va DESPUÉS de requireAuth. Solo aplica a cuentas de vendedor.
export const bloquearDistribuidores = async (req, res, next) => {
  try {
    const rol = req.user?.role;
    if (rol !== 'vendedor' && rol !== 'user') return next();
    if ((await tipoDeVendedor(req.user?.name)) === 'distribuidor') {
      return res.status(403).json({ error: 'Sin acceso a este módulo' });
    }
    next();
  } catch (error) {
    console.error('bloquearDistribuidores:', error);
    next(); // si falla la consulta no se tumba el servicio; el dato sigue protegido por el filtro de cada ruta
  }
};
