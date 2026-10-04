import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';

const COSTO_BCRYPT = 10;
const RE_BCRYPT = /^\$2[aby]\$/;

// Formato ANTERIOR: base64 al revés (reversible, no es un hash de verdad).
// Solo se conserva para verificar contraseñas viejas y migrarlas. Nada nuevo se guarda así.
const hashLegacy = (password) =>
  Buffer.from(String(password)).toString('base64').split('').reverse().join('');

export const esBcrypt = (hash) => typeof hash === 'string' && RE_BCRYPT.test(hash);

export function decodificarLegacy(hash) {
  return Buffer.from(String(hash).split('').reverse().join(''), 'base64').toString('utf8');
}

// Hash seguro para guardar contraseñas nuevas o cambiadas
export async function hashPassword(password) {
  return bcrypt.hash(String(password), COSTO_BCRYPT);
}

/**
 * Verifica la contraseña de un usuario. Acepta el formato nuevo (bcrypt) y el viejo.
 * Si entra con el formato viejo y la contraseña es correcta, la convierte a bcrypt
 * en ese mismo momento (el usuario no nota nada).
 */
export async function verificarPasswordUsuario(user, password) {
  const almacenado = user?.passwordHash;
  if (!almacenado) return false;

  if (esBcrypt(almacenado)) {
    return bcrypt.compare(String(password), almacenado);
  }

  const esperado = Buffer.from(hashLegacy(password));
  const real = Buffer.from(String(almacenado));
  const ok = esperado.length === real.length && crypto.timingSafeEqual(esperado, real);

  if (ok) {
    hashPassword(password)
      .then((nuevo) =>
        // Solo si nadie cambió la contraseña entre tanto
        User.updateOne({ _id: user._id, passwordHash: almacenado }, { $set: { passwordHash: nuevo } })
      )
      .catch((e) => console.warn('⚠️ No se pudo actualizar el hash de contraseña:', e?.message || e));
  }
  return ok;
}

// Convierte un hash viejo a bcrypt. Devuelve null si no es del formato viejo (no se toca).
export async function convertirLegacyABcrypt(hashViejo) {
  if (!hashViejo || esBcrypt(hashViejo)) return null;
  const plano = decodificarLegacy(hashViejo);
  if (!plano || hashLegacy(plano) !== hashViejo) return null;
  return hashPassword(plano);
}

// Migración única (idempotente): pasa TODAS las contraseñas viejas a bcrypt, incluso
// de usuarios que no han vuelto a entrar. Se ejecuta al arrancar el servidor.
export async function migrarPasswordsLegacy() {
  const pendientes = await User.find({ passwordHash: { $not: RE_BCRYPT } }, { passwordHash: 1 }).lean();
  let migradas = 0;
  let omitidas = 0;

  for (const u of pendientes) {
    try {
      const nuevo = await convertirLegacyABcrypt(u.passwordHash);
      if (!nuevo) { omitidas++; continue; }
      const r = await User.updateOne(
        { _id: u._id, passwordHash: u.passwordHash },
        { $set: { passwordHash: nuevo } }
      );
      if (r.modifiedCount) migradas++; else omitidas++;
    } catch (e) {
      omitidas++;
      console.warn('⚠️ No se pudo migrar una contraseña:', e?.message || e);
    }
  }
  return { total: pendientes.length, migradas, omitidas };
}
