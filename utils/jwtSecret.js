import crypto from 'crypto';
import { HASHES_COMPROMETIDOS } from './credencialesComprometidas.js';

const POR_DEFECTO = 'dev-insecure-secret-change-me';
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const esProduccion = (env = process.env) => env.NODE_ENV === 'production' || !!env.RENDER;

// Decide qué secreto firma las sesiones. Si el configurado es inseguro (falta, es el de ejemplo, es corto o es uno que
// estuvo publicado en git), en producción se usa uno aleatorio solo en memoria: nadie puede fabricar sesiones, a costa de
// que al reiniciar el servidor haya que volver a entrar. La solución es poner un JWT_SECRET nuevo en Render.
export function resolverJwtSecret(env = process.env) {
  const valor = env.JWT_SECRET || '';
  const motivo = !valor ? 'no está configurado'
    : valor === POR_DEFECTO ? 'es el valor de ejemplo del código'
    : valor.length < 32 ? 'es demasiado corto (mínimo 32 caracteres)'
    : HASHES_COMPROMETIDOS.jwt.includes(sha256(valor)) ? 'es uno que estuvo publicado en el repositorio de git'
    : null;
  if (!motivo) return { secret: valor, efimero: false, motivo: null };
  if (esProduccion(env)) {
    return { secret: crypto.randomBytes(48).toString('hex'), efimero: true, motivo };
  }
  return { secret: valor || POR_DEFECTO, efimero: false, motivo }; // desarrollo local
}

export function contrasenaMongoComprometida(env = process.env) {
  try {
    const pw = decodeURIComponent(new URL(env.MONGODB_URI || '').password);
    return !!pw && HASHES_COMPROMETIDOS.mongoPassword.includes(sha256(pw));
  } catch {
    return false;
  }
}

// Avisos al arrancar (quedan en los logs de Render)
export function advertirCredencialesComprometidas(estado, env = process.env) {
  const barra = '='.repeat(78);
  if (estado.motivo && estado.efimero) {
    console.error(`\n${barra}\n🔐 SEGURIDAD: el JWT_SECRET ${estado.motivo}.\n   Se está usando un secreto TEMPORAL: las sesiones se cierran en cada reinicio.\n   Solución: en Render > Environment agrega JWT_SECRET con un valor nuevo de 48+ caracteres aleatorios.\n${barra}\n`);
  } else if (estado.motivo) {
    console.warn(`⚠️ JWT_SECRET ${estado.motivo} (solo se tolera fuera de producción).`);
  }
  if (contrasenaMongoComprometida(env)) {
    console.error(`\n${barra}\n🔐 SEGURIDAD: la contraseña de MongoDB en MONGODB_URI es una que estuvo publicada en git.\n   Cámbiala YA en Atlas (Database Access) y actualiza MONGODB_URI en Render.\n${barra}\n`);
  }
}
