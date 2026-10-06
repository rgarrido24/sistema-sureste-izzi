// Esquema de factor de comisión para VENTA DIRECTA y REDES SOCIALES (sin retención).
//   · Nacen en 1.5.
//   · Con la capacitación aprobada: 6 a 15 ventas en el mes → 1.8; 16 o más → 2.0.
//   · Sin la capacitación aprobada no suben de 1.5, sin importar cuántas ventas hagan.
// "Ventas del mes" = cuentas del vendedor en la cosecha de M1 cargada (la misma cifra del ranking).
export const ESQUEMA_DIRECTA = Object.freeze({
  base: 1.5,
  tramos: Object.freeze([
    Object.freeze({ desde: 16, factor: 2.0 }),
    Object.freeze({ desde: 6, factor: 1.8 }),
  ]),
});

export function factorDirecta(ventasMes, capacitacionAprobada) {
  if (!capacitacionAprobada) return ESQUEMA_DIRECTA.base;
  const n = Number(ventasMes) || 0;
  for (const t of ESQUEMA_DIRECTA.tramos) if (n >= t.desde) return t.factor;
  return ESQUEMA_DIRECTA.base;
}
