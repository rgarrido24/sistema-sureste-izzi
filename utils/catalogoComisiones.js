// Catálogo vigente de comisión base por paquete (columna "Base" de la tabla de Izzi).
// La columna "1.5" de esa tabla se omite a propósito: la comisión real se calcula
// como base × factor de cada vendedor/sub.
export const CATALOGO_COMISIONES = [
  // ---- Planes triples ----
  { clave: 'TI60M', paquete: 'IZZI 60 MEGAS + IZZI TV HD', comisionBase: 539, categoria: 'triple' },
  { clave: 'TI80M', paquete: 'IZZI 80 MEGAS + IZZI TV HD', comisionBase: 630, categoria: 'triple' },
  { clave: 'TI100M2', paquete: 'IZZI 100 MEGAS + IZZI TV HD', comisionBase: 720, categoria: 'triple' },
  { clave: 'TI120M2', paquete: 'IZZI 120 MEGAS + IZZI TV HD', comisionBase: 720, categoria: 'triple' },
  { clave: 'TI150M', paquete: 'IZZI 150 MEGAS + IZZI TV HD', comisionBase: 790, categoria: 'triple' },
  { clave: 'TI200M2', paquete: 'IZZI 200 MEGAS + IZZI TV HD', comisionBase: 790, categoria: 'triple' },
  { clave: 'TI500M2', paquete: 'IZZI 500 MEGAS + IZZI TV HD', comisionBase: 790, categoria: 'triple' },
  { clave: 'TI1000M2', paquete: 'IZZI 1000 MEGAS + IZZI TV HD', comisionBase: 790, categoria: 'triple' },
  { clave: 'TIG30', paquete: 'IZZI NEGOCIOS 30 MEGAS + IZZI TV HD', comisionBase: 680, categoria: 'triple' },
  { clave: 'TIG40', paquete: 'IZZI NEGOCIOS 40 MEGAS + IZZI TV HD', comisionBase: 680, categoria: 'triple' },
  { clave: 'TIG50', paquete: 'IZZI NEGOCIOS 50 MEGAS + IZZI TV HD', comisionBase: 710, categoria: 'triple' },
  { clave: 'TIG60', paquete: 'IZZI NEGOCIOS 60 MEGAS + IZZI TV HD', comisionBase: 589, categoria: 'triple' },
  { clave: 'TIG80', paquete: 'IZZI NEGOCIOS 80 MEGAS + IZZI TV HD', comisionBase: 680, categoria: 'triple' },
  { clave: 'TIG100', paquete: 'IZZI NEGOCIOS 100 MEGAS + IZZI TV HD', comisionBase: 710, categoria: 'triple' },
  { clave: 'TIG120', paquete: 'IZZI NEGOCIOS 120 MEGAS + IZZI TV HD', comisionBase: 710, categoria: 'triple' },
  { clave: 'TIG150', paquete: 'IZZI NEGOCIOS 150 MEGAS + IZZI TV HD', comisionBase: 780, categoria: 'triple' },
  { clave: 'TIG200', paquete: 'IZZI NEGOCIOS 200 MEGAS + IZZI TV HD', comisionBase: 870, categoria: 'triple' },
  { clave: 'TIG500', paquete: 'IZZI NEGOCIOS 500 MEGAS + IZZI TV HD', comisionBase: 990, categoria: 'triple' },
  { clave: 'TIG1000', paquete: 'IZZI NEGOCIOS 1000 MEGAS + IZZI TV HD', comisionBase: 1190, categoria: 'triple' },

  // ---- Planes dobles ----
  { clave: 'DI60M', paquete: 'IZZI 60 MEGAS', comisionBase: 389, categoria: 'doble' },
  { clave: 'DI80M', paquete: 'IZZI 80 MEGAS', comisionBase: 480, categoria: 'doble' },
  { clave: 'DI100M', paquete: 'IZZI 100 MEGAS', comisionBase: 540, categoria: 'doble' },
  { clave: 'DI120M', paquete: 'IZZI 120 MEGAS', comisionBase: 540, categoria: 'doble' },
  { clave: 'DI150M', paquete: 'IZZI 150 MEGAS', comisionBase: 610, categoria: 'doble' },
  { clave: 'DI200M', paquete: 'IZZI 200 MEGAS', comisionBase: 610, categoria: 'doble' },
  { clave: 'DI500M', paquete: 'IZZI 500 MEGAS', comisionBase: 610, categoria: 'doble' },
  { clave: 'DI1000M', paquete: 'IZZI 1000 MEGAS', comisionBase: 610, categoria: 'doble' },
  { clave: 'DIN40', paquete: 'IZZI NEGOCIOS 40 MEGAS', comisionBase: 500, categoria: 'doble' },
  { clave: 'DIN60', paquete: 'IZZI NEGOCIOS 60 MEGAS', comisionBase: 439, categoria: 'doble' },
  { clave: 'DIN80', paquete: 'IZZI NEGOCIOS 80 MEGAS', comisionBase: 530, categoria: 'doble' },
  { clave: 'DIN100', paquete: 'IZZI NEGOCIOS 100 MEGAS', comisionBase: 560, categoria: 'doble' },
  { clave: 'DIN120', paquete: 'IZZI NEGOCIOS 120 MEGAS', comisionBase: 560, categoria: 'doble' },
  { clave: 'DIN150', paquete: 'IZZI NEGOCIOS 150 MEGAS', comisionBase: 630, categoria: 'doble' },
  { clave: 'DIN200', paquete: 'IZZI NEGOCIOS 200 MEGAS', comisionBase: 720, categoria: 'doble' },
  { clave: 'DIN500', paquete: 'IZZI NEGOCIOS 500 MEGAS', comisionBase: 840, categoria: 'doble' },
  { clave: 'DIN1000', paquete: 'IZZI NEGOCIOS 1000 MEGAS', comisionBase: 1040, categoria: 'doble' },

  // ---- Planes single ----
  { clave: 'SITVL', paquete: 'IZZI TV LIGHT', comisionBase: 199, categoria: 'single' },
  { clave: 'SPTVM', paquete: 'PACK TV MINI', comisionBase: 200, categoria: 'single' },
  { clave: 'SITVP', paquete: 'IZZI TV +', comisionBase: 249, categoria: 'single' },
  { clave: 'SITVPB', paquete: 'IZZI TV + BÁSICO', comisionBase: 299, categoria: 'single' },
  { clave: 'SITVPP', paquete: 'IZZI TV + PREMIUM', comisionBase: 499, categoria: 'single' },
  { clave: 'SPTVP', paquete: 'PACK TV PLUS', comisionBase: 240, categoria: 'single' },
  { clave: 'SIHD', paquete: 'IZZI TV HD', comisionBase: 340, categoria: 'single' },
];
