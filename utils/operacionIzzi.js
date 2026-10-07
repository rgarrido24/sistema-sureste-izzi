// Formato de la Operación del Día exportado del portal de Izzi:
// Num. Orden | Hub | Rpt | Referido | Portabilidad | Motivo Orden | Medio Verificación | Fecha Orden | Fecha Desconexion |
// Tipo Orden | Estado | Sub-Estado | Vendedor | cruce | Clave Técnico | Fecha Solicitada | Total | Estado Admisión | ...
// Aquí se traducen sus columnas a los nombres que el sistema ya usa (así el panel, la asignación por claves
// y los filtros por región siguen funcionando igual), sin quitar ninguna columna original.

const CLAVE_VENDEDOR = /^CVVEN[A-Z0-9]+$/i;

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const clave = (k) => sinAcentos(k).toLowerCase().replace(/[^a-z0-9]/g, '');

export function esClaveVendedor(valor) {
  return CLAVE_VENDEDOR.test(String(valor ?? '').trim());
}

// ¿La fila viene del formato de portal de Izzi?
export function esFilaPortalIzzi(item) {
  const ks = new Set(Object.keys(item || {}).map(clave));
  return ks.has('numorden') && (ks.has('subestado') || ks.has('estadocta') || ks.has('rpt'));
}

export function normalizarFilaOperacion(item) {
  if (!item || typeof item !== 'object' || !esFilaPortalIzzi(item)) return item;
  const porClave = new Map(Object.keys(item).map((k) => [clave(k), k]));
  const get = (c) => {
    const k = porClave.get(c);
    return k === undefined ? undefined : item[k];
  };
  const vacio = (v) => v === undefined || v === null || String(v).trim() === '';
  const out = { ...item };
  const pon = (campo, valor) => { if (vacio(out[campo]) && !vacio(valor)) out[campo] = valor; };

  pon('Nº de orden', get('numorden'));
  pon('No Orden', get('numorden'));
  pon('Estatus Ord', get('estado'));
  pon('Sub Estatus Ord', get('subestado'));
  pon('Fecha solicitada', get('fechasolicitada'));
  pon('Plaza', get('rpt')); // "MONTERREY"... sirve para ubicar la región cuando no hay columna Region

  // La columna "Vendedor" del portal trae la CLAVE (CVVEN...), no el nombre
  const vendedorRaw = get('vendedor');
  const cruceRaw = get('cruce');
  const claveVendedor = [vendedorRaw, cruceRaw, get('clavevendedor'), get('usuariovendedor')].find(esClaveVendedor);
  if (claveVendedor) {
    pon('Clave Vendedor', String(claveVendedor).trim().toUpperCase());
    pon('Usuario Vendedor', String(claveVendedor).trim().toUpperCase());
  }
  return out;
}
