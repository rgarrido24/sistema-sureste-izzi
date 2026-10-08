import VendedorFactor from '../models/VendedorFactor.js';
import { normalizarNombre } from './comisionesCalc.js';
import { coincideNombrePortal } from './nombresPortal.js';

// Tipo del vendedor ('distribuidor' | 'directa' | null) según la base máster de Comisiones.
// Se compara igual que el portal reparte las cuentas: nombre igual, o uno contenido en el otro.
// Se guarda en memoria 60 s para no consultar la base en cada clic.
let cache = { hasta: 0, lista: [] };

export function limpiarCacheTipoVendedor() { cache = { hasta: 0, lista: [] }; }

async function cargarLista() {
  if (Date.now() < cache.hasta) return cache.lista;
  const docs = await VendedorFactor.find({}, { vendedor: 1, tipo: 1 }).lean();
  cache = { hasta: Date.now() + 60_000, lista: docs };
  return docs;
}

export async function tipoDeVendedor(nombre) {
  const key = normalizarNombre(nombre);
  if (!key) return null;
  const lista = await cargarLista();
  const exacto = lista.find((d) => normalizarNombre(d.vendedor) === key);
  if (exacto) return exacto.tipo || null;
  const parecido = lista.find((d) => coincideNombrePortal(nombre, d.vendedor));
  return parecido?.tipo || null;
}
