// Teléfonos de una cuenta: sirve igual en el servidor y en el navegador (sin dependencias).
// Detecta columnas de teléfono aunque el encabezado del archivo se llame distinto
// ("Teléfono", "TELEFONO  N° 1", "Celular", "Tel. contacto"...) y aunque traigan varios números juntos.

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const claveCampo = (k) => sinAcentos(k).toUpperCase().replace(/[^A-Z0-9]/g, '');

const ES_COLUMNA_TEL = (k) => /(TEL|CEL|MOVIL|WHATSAPP)/.test(k) && !/(NOTA|FECHA|PROMESA|HORARIO|ESTATUS|ESTADO)/.test(k);

// "9991234567", "(999) 123-4567", "+52 999 123 4567", "52 9991234567 / 9997654321" → ['9991234567', ...]
export function separarTelefonos(valor) {
  if (valor === null || valor === undefined) return [];
  const texto = typeof valor === 'number' ? String(Math.trunc(valor)) : String(valor);
  const out = [];
  for (const trozo of texto.split(/[\/,;|\n]+|\s+y\s+/i)) {
    let d = trozo.replace(/\D/g, '');
    if (d.length < 10) continue;
    // Quita lada de país/celular (52, 044, 045) y se queda con 10 dígitos
    if (d.length > 10) d = d.slice(-10);
    if (/^0+$/.test(d)) continue;
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

// Todos los teléfonos que se puedan sacar de un registro, sin repetir. Los capturados en el sistema van primero.
export function telefonosDeRegistro(item) {
  if (!item || typeof item !== 'object') return [];
  const lista = [];
  const agrega = (v) => { for (const t of separarTelefonos(v)) if (!lista.includes(t)) lista.push(t); };
  agrega(item.Telefono1);
  agrega(item.Telefono2);
  for (const [k, v] of Object.entries(item)) {
    if (k === 'Telefono1' || k === 'Telefono2') continue;
    if (ES_COLUMNA_TEL(claveCampo(k))) agrega(v);
  }
  return lista;
}

// Para la carga: rellena Telefono1/Telefono2 desde la columna del archivo sin pisar lo que ya traiga.
export function conTelefonosNormalizados(item) {
  const tels = telefonosDeRegistro(item);
  if (!tels.length) return item;
  const out = { ...item };
  if (!separarTelefonos(out.Telefono1).length) out.Telefono1 = tels[0];
  if (!separarTelefonos(out.Telefono2).length) {
    const otro = tels.find((t) => t !== separarTelefonos(out.Telefono1)[0]);
    if (otro) out.Telefono2 = otro;
  }
  return out;
}
