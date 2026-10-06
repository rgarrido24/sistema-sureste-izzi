// Misma regla que usa el portal del vendedor (src/utils/vendorFilter.js → matchVendorName) para decidir
// de quién son las cuentas que ve cada usuario: nombres iguales, o uno contenido en el otro
// (cuando ambos tienen más de 5 letras). Se usa para que nadie pueda crearse un usuario cuyo nombre
// le dé acceso a las cuentas de otra persona.
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');

export function coincideNombrePortal(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length > 5 && y.length > 5) return y.includes(x) || x.includes(y);
  return false;
}
