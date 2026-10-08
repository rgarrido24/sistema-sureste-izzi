import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { tokenValido } from './auth.js';

const VENTANA = 15 * 60 * 1000;
const responder429 = (mensaje) => (req, res) => res.status(429).json({ success: false, error: mensaje });

// Orígenes (páginas web) autorizados a usar la API desde un navegador. Agrega más con CORS_ORIGINS="https://a.com,https://b.com".
// Así, una copia de tu frontend publicada en otro dominio no puede hablar con tu servidor.
const ORIGENES_POR_DEFECTO = [
  'https://apprgo.agentia.software',
  'https://sistema-sureste-izzi.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];
const ORIGEN_PORTAL_IZZI = /^https:\/\/([a-z0-9-]+\.)*wizz\.mx$/i;
export function origenesPermitidos(env = process.env) {
  const extra = String(env.CORS_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  return [...ORIGENES_POR_DEFECTO, ...extra];
}

export function corsSeguro(env = process.env) {
  const permitidos = new Set(origenesPermitidos(env));
  const normal = { origin: (origin, cb) => cb(null, !origin || permitidos.has(origin)), allowedHeaders: ['Content-Type', 'Authorization'], maxAge: 600 };
  // La captura del portal de Izzi (marcador del celular) llama desde wizz.mx con su propia llave, solo a esta ruta
  const captura = { origin: (origin, cb) => cb(null, !origin || ORIGEN_PORTAL_IZZI.test(origin)), allowedHeaders: ['Content-Type', 'X-Integracion-Key'], methods: ['GET', 'POST', 'OPTIONS'], maxAge: 600 };
  return cors((req, cb) => cb(null, req.path.startsWith('/api/estatus/ingesta') ? captura : normal));
}

// Límite general generoso (oficinas enteras salen por una misma IP). Solo frena inundaciones.
export const limiteGeneral = rateLimit({
  windowMs: VENTANA,
  limit: 3000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || req.path === '/api/health',
  handler: responder429('Demasiadas peticiones. Espera unos minutos.'),
});

// Login: máximo 8 intentos FALLIDOS por usuario+IP cada 15 min (los exitosos no cuentan) y 60 por IP.
const MSG_LOGIN = 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.';
export const limitarLogin = rateLimit({
  windowMs: VENTANA,
  limit: 8,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || '')}|${String(req.body?.username ?? '').toLowerCase().trim().slice(0, 80)}`,
  handler: responder429(MSG_LOGIN),
});
export const limitarLoginPorIp = rateLimit({
  windowMs: VENTANA,
  limit: 60,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: responder429(MSG_LOGIN),
});

// Quita operadores de Mongo ($ne, $gt…) de la URL (?campo[$ne]=x) para que nadie los inyecte en un filtro.
function quitarOperadores(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (k.startsWith('$')) delete obj[k];
    else quitarOperadores(obj[k]);
  }
}
export function sanearConsulta(req, res, next) {
  quitarOperadores(req.query);
  next();
}

export function aplicarSeguridadBase(app, env = process.env) {
  app.set('trust proxy', Number(env.TRUST_PROXY_HOPS ?? 1)); // Render pone 1 proxy delante: así req.ip es el del cliente
  app.disable('x-powered-by');
  // crossOriginResourcePolicy abierto para que el frontend pueda mostrar imágenes/videos que sirve la API
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(corsSeguro(env));
  app.use(limiteGeneral);
  app.use(sanearConsulta);
}

// Puerta de entrada: sin una sesión válida NO se procesa nada de /api (ni se lee el cuerpo de la petición),
// salvo lo que debe ser público: iniciar sesión, el health check y la lectura de videos compartidos.
export function puertaDeEntrada(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  const ruta = req.path;
  if (!ruta.startsWith('/api')) return next();
  const lectura = req.method === 'GET' || req.method === 'HEAD';
  if (req.method === 'POST' && ruta === '/api/users/login') return next();
  if (lectura && ruta === '/api/health') return next();
  if (lectura && ruta.startsWith('/api/upload/videos/')) return next();
  // Captura del portal y chatbot: no usan sesión de usuario, validan su propia llave revocable en la ruta
  if (ruta.startsWith('/api/estatus/ingesta/') || ruta.startsWith('/api/estatus/bot/')) return next();
  const [tipo, token] = String(req.headers.authorization || '').split(' ');
  if (tipo === 'Bearer' && token && tokenValido(token)) return next();
  return res.status(401).json({ error: 'Sesión requerida' });
}

// Errores: nunca se devuelve el detalle interno (rutas de archivos, stack traces)
const MENSAJES = { 400: 'Solicitud no válida', 401: 'Sesión requerida', 403: 'Sin permisos', 404: 'No encontrado', 413: 'La petición es demasiado grande', 429: 'Demasiadas peticiones' };
export function manejarErrores(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = Number(err?.status || err?.statusCode) || 500;
  if (status >= 500) console.error('Error no controlado:', err);
  res.status(status).json({ error: status >= 500 ? 'Error del servidor' : MENSAJES[status] || 'Solicitud no válida' });
}
