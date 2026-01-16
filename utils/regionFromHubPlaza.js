function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function includesAny(text, list) {
  if (!text) return false;
  const t = normalizeText(text);
  return list.some(item => {
    const n = normalizeText(item);
    return t === n || t.includes(n) || n.includes(t);
  });
}

// Nota: estas listas deben alinearse con lo que usa el frontend para reportes/filtrado.
const REGIONS = {
  METROPOLITANA: {
    hubs: [
      'HUB ARBOLEDAS', 'HUB VALLEJO', 'HUB SATELITE', 'HUB POLANCO', 'HUB SANTA FE',
      'HUB TOLUCA', 'HUB ECATEPEC', 'HUB CUAUTITLAN', 'HUB MELCHOR OCAMPO', 'HUB TIZAYUCA',
      'HUB VALLE', 'HUB TULA', 'HUB TULANCINGO', 'HUB TEPEJI DEL RIO', 'HUB PACHUCA',
      'HUB ARAGON', 'HUB CENTRO', 'HUB CENTRO DE ACOPIO', 'HUB CHIMALHUACAN', 'HUB IZTAPALAPA',
      'HUB ROJO GOMEZ', 'HUB IXTAPALUCA', 'HUB SARATOGA', 'HUB TLALPAN', 'HUB CUAUTLA',
      'HUB CUERNAVACA', 'HUB YAUTEPEC'
    ],
    plazas: [
      'ARBOLEDAS', 'VALLEJO', 'SATELITE', 'POLANCO', 'SANTA FE', 'TOLUCA', 'ECATEPEC',
      'CUAUTITLAN', 'MELCHOR OCAMPO', 'TIZAYUCA', 'TULA', 'TULANCINGO', 'TEPEJI DEL RIO',
      'PACHUCA', 'ARAGON', 'CENTRO', 'CHIMALHUACAN', 'IZTAPALAPA', 'ROJO GOMEZ',
      'IXTAPALUCA', 'SARATOGA', 'TLALPAN', 'CUAUTLA', 'CUERNAVACA', 'YAUTEPEC'
    ]
  },
  NORESTE: {
    hubs: [
      'HUB CELAYA', 'HUB IRAPUATO', 'HUB LINARES', 'HUB MANTE', 'HUB MATAMOROS',
      'HUB MATEHUALA', 'HUB MONTERREY', 'HUB NUEVO LAREDO', 'HUB QUERETARO', 'HUB REYNOSA',
      'HUB SALAMANCA', 'HUB SALTILLO', 'HUB SAN LUIS', 'HUB TAMPICO', 'HUB VALLES', 'HUB VICTORIA'
    ],
    plazas: [
      'CELAYA', 'IRAPUATO', 'LINARES', 'MANTE', 'MATAMOROS', 'MATEHUALA', 'MONTERREY',
      'NUEVO LAREDO', 'QUERETARO', 'QUERÉTARO', 'REYNOSA', 'SALAMANCA', 'SALTILLO',
      'SAN LUIS', 'TAMPICO', 'VALLES', 'VICTORIA'
    ]
  },
  OCCIDENTE: {
    hubs: [
      'HUB GUADALAJARA', 'HUB TLAJOMULCO', 'HUB TLAQUEPAQUE', 'HUB TONALA',
      'HUB ZAPOPAN NORTE', 'HUB ZAPOPAN SUR', 'HUB MANZANILLO', 'HUB OAXACA',
      'HUB CHILPANCINGO', 'HUB ACAPULCO', 'HUB AGUASCALIENTES', 'HUB PUERTO VALLARTA', 'HUB IGUALA'
    ],
    plazas: [
      'GUADALAJARA', 'TLAJOMULCO', 'TLAQUEPAQUE', 'TONALA', 'TONALÁ', 'ZAPOPAN',
      'MANZANILLO', 'OAXACA', 'CHILPANCINGO', 'ACAPULCO', 'AGUASCALIENTES', 'PUERTO VALLARTA', 'IGUALA'
    ]
  },
  PACIFICO: {
    hubs: [
      'HUB NOGALES', 'HUB JUAREZ', 'HUB CHIHUAHUA', 'HUB DURANGO', 'HUB SAN LUIS RIO COLORADO',
      'HUB TIJUANA', 'HUB ENSENADA', 'HUB MAZATLAN', 'HUB CUAUHTEMOC CHIH', 'HUB TEPIC',
      'HUB MEXICALI', 'HUB PARRAL', 'HUB GUADALUPE', 'HUB LA PAZ', 'HUB TECATE', 'HUB ZACATECAS'
    ],
    plazas: [
      'NOGALES', 'CD. JUAREZ', 'CD JUAREZ', 'CIUDAD JUAREZ', 'DELICIAS', 'DURANGO',
      'SAN LUIS RIO COLORADO', 'SAN LUIS RÍO COLORADO', 'TIJUANA', 'ENSENADA',
      'MAZATLAN', 'MAZATLÁN', 'CUAUHTEMOC CHIH', 'CUAUHTÉMOC CHIH', 'CUAUHTEMOC', 'CUAUHTÉMOC',
      'TEPIC', 'MEXICALI', 'PARRAL', 'PARRÁL', 'ZACATECAS', 'LA PAZ', 'TECATE', 'CHIHUAHUA'
    ]
  },
  SURESTE: {
    hubs: [
      'HUB POZA RICA', 'HUB TIHUATLAN', 'HUB COATZINTLA', 'HUB TUXPAN',
      'HUB CD. MENDOZA', 'HUB RIO BLANCO', 'HUB ORIZABA', 'HUB CORDOBA',
      'HUB COSOLEACAQUE', 'HUB JALTIPAN', 'HUB MINATITLAN', 'HUB COATZACOALCOS', 'HUB NANCHITAL',
      'HUB CHOLULA', 'HUB SAN MARTIN TEXMELUCAN', 'HUB TLAXCALA', 'HUB TEHUACAN', 'HUB APIZACO',
      'HUB ATLIXCO', 'HUB TEZIUTLAN',
      'HUB PLAYA DEL CARMEN', 'HUB CANCUN', 'HUB COZUMEL', 'HUB TULUM', 'HUB MERIDA', 'HUB CAMPECHE',
      'HUB CD. DEL CARMEN', 'HUB VILLAHERMOSA', 'HUB TAPACHULA', 'HUB CHETUMAL'
    ],
    plazas: [
      'POZA RICA', 'TIHUATLAN', 'TIHUATLÁN', 'COATZINTLA', 'TUXPAN',
      'CD. MENDOZA', 'CIUDAD MENDOZA', 'RIO BLANCO', 'RÍO BLANCO', 'ORIZABA', 'CORDOBA', 'CÓRDOBA',
      'COSOLEACAQUE', 'JALTIPAN', 'JÁLTIPAN', 'MINATITLAN', 'MINATITLÁN', 'COATZACOALCOS', 'NANCHITAL',
      'CHOLULA', 'SAN MARTIN TEXMELUCAN', 'SAN MARTÍN TEXMELUCAN', 'TLAXCALA', 'TEHUACAN', 'TEHUACÁN',
      'APIZACO', 'ATLIXCO', 'TEZIUTLAN', 'TEZIUTLÁN',
      'PLAYA DEL CARMEN', 'CANCUN', 'CANCÚN', 'COZUMEL', 'TULUM', 'MERIDA', 'MÉRIDA', 'CAMPECHE',
      'CD. DEL CARMEN', 'CIUDAD DEL CARMEN', 'VILLAHERMOSA', 'TAPACHULA', 'CHETUMAL'
    ]
  }
};

export function getRegionFromHubPlaza(hub, plaza) {
  const hubStr = normalizeText(hub);
  const plazaStr = normalizeText(plaza);

  // 1) Match por HUB
  for (const [region, cfg] of Object.entries(REGIONS)) {
    if (includesAny(hubStr, cfg.hubs)) return region;
  }

  // 2) Match por PLAZA
  for (const [region, cfg] of Object.entries(REGIONS)) {
    if (includesAny(plazaStr, cfg.plazas)) return region;
  }

  return '';
}

