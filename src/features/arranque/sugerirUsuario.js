// Sugiere un usuario a partir del nombre: "Juan Carlos Pérez López" → "juan.perez"
// (el servidor valida que sea único y que cumpla el formato).
export function sugerirUsuario(nombre) {
  const palabras = String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (palabras.length === 0) return '';
  if (palabras.length === 1) return palabras[0].slice(0, 30);
  const apellido = palabras.length >= 3 ? palabras[palabras.length - 2] : palabras[1];
  return `${palabras[0]}.${apellido}`.slice(0, 30);
}
