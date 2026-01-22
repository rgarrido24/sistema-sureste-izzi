// Util compartido para clasificar región a partir de HUB/PLAZA.
// Importante: esta lógica está alineada con la usada en Operación del Día para que los conteos coincidan.

export const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
};

export const getRegionFromHubPlaza = (hub, plaza) => {
  if (!hub && !plaza) return null;

  const hubStr = hub ? normalizeText(hub) : '';
  const plazaStr = plaza ? normalizeText(plaza) : '';

  // METROPOLITANA
  const metropolitanaHubs = [
    'HUB ARBOLEDAS', 'HUB VALLEJO', 'HUB SATELITE', 'HUB POLANCO', 'HUB SANTA FE',
    'HUB TOLUCA', 'HUB ECATEPEC', 'HUB CUAUTITLAN', 'HUB MELCHOR OCAMPO', 'HUB TIZAYUCA',
    'HUB VALLE', 'HUB TULA', 'HUB TULANCINGO', 'HUB TEPEJI DEL RIO', 'HUB PACHUCA',
    'HUB ARAGON', 'HUB CENTRO', 'HUB CENTRO DE ACOPIO', 'HUB CHIMALHUACAN', 'HUB IZTAPALAPA',
    'HUB ROJO GOMEZ', 'HUB IXTAPALUCA', 'HUB SARATOGA', 'HUB TLALPAN', 'HUB CUAUTLA',
    'HUB CUERNAVACA', 'HUB YAUTEPEC'
  ];
  const metropolitanaPlazas = [
    'ARBOLEDAS', 'VALLEJO', 'SATELITE', 'POLANCO', 'SANTA FE',
    'TOLUCA', 'ECATEPEC', 'CUAUTITLAN', 'MELCHOR OCAMPO', 'TIZAYUCA',
    'VALLE', 'TULA', 'TULANCINGO', 'TEPEJI DEL RIO', 'PACHUCA',
    'ARAGON', 'CENTRO', 'CENTRO DE ACOPIO', 'CHIMALHUACAN', 'IZTAPALAPA',
    'ROJO GOMEZ', 'IXTAPALUCA', 'SARATOGA', 'TLALPAN', 'CUAUTLA',
    'CUERNAVACA', 'YAUTEPEC'
  ];
  const metropolitanaCodes = ['AB', 'VO', 'ST', 'PL', 'KI', 'TOL', 'ECA', 'CU', 'MEO', 'TZY', 'VA', 'TLA', 'TUL', 'TPR', 'PAC', 'AR', 'CE', 'CA', 'CM', 'IZ', 'RG', 'IX', 'SA', 'TL', 'CT', 'CV', 'YU'];

  // NORESTE (NOTA: CDC está en SURESTE; CJ/PA están en PACIFICO)
  const noresteHubs = [
    'HUB CELAYA', 'HUB IRAPUATO', 'HUB LINARES', 'HUB MANTE', 'HUB MATAMOROS', 'HUB MATAMOROS',
    'HUB MATEHUALA', 'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY',
    'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY',
    'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY', 'HUB MONTERREY', 'HUB NUEVO LAREDO',
    'HUB QUERETARO', 'HUB REYNOSA', 'HUB REYNOSA', 'HUB REYNOSA', 'HUB SALAMANCA', 'HUB SALTILLO',
    'HUB SALTILLO', 'HUB SALTILLO', 'HUB SAN LUIS', 'HUB TAMPICO', 'HUB TAMPICO', 'HUB VALLES', 'HUB VICTORIA'
  ];
  const norestePlazas = [
    'CELAYA', 'IRAPUATO', 'LINARES', 'MANTE', 'MATAMOROS', 'MATAMOROS', 'MATEHUALA',
    'MONTERREY', 'MONTERREY', 'MONTERREY', 'MONTERREY', 'MONTERREY', 'MONTERREY', 'MONTERREY',
    'MONTERREY', 'MONTERREY', 'MONTERREY', 'MONTERREY', 'MONTERREY', 'MONTERREY', 'MONTERREY',
    'MONTERREY', 'MONTERREY', 'NUEVO LAREDO', 'QUERETARO', 'REYNOSA', 'REYNOSA', 'REYNOSA',
    'SALAMANCA', 'SALTILLO', 'SALTILLO', 'SALTILLO', 'SAN LUIS', 'TAMPICO', 'TAMPICO', 'VALLES', 'VICTORIA'
  ];
  const noresteCodes = [
    'CEL', 'IRA', 'LIN', 'MTE', 'MTM', 'PAS', 'MTH', 'APO', 'CAD', 'CMY', 'CUM',
    'ESC', 'GAR', 'GPA', 'HUI', 'JUA', 'LNC', 'LVD', 'SCA', 'SNI', 'VFU', 'NUL', 'QRO',
    'BAL', 'RBR', 'REY', 'SLA', 'REP', 'SAS', 'SLP', 'ALT', 'TAM', 'VL', 'CIV'
  ];

  // OCCIDENTE
  const occidenteHubs = [
    'HUB GUADALAJARA', 'HUB TLAJOMULCO', 'HUB TLAQUEPAQUE', 'HUB TONALA',
    'HUB ZAPOPAN NORTE', 'HUB ZAPOPAN SUR', 'HUB MANZANILLO', 'HUB OAXACA',
    'HUB CHILPANCINGO', 'HUB ACAPULCO', 'HUB AGUASCALIENTES', 'HUB PUERTO VALLARTA', 'HUB IGUALA'
  ];
  const occidentePlazas = [
    'GUADALAJARA', 'TLAJOMULCO', 'TLAQUEPAQUE', 'TONALA',
    'ZAPOPAN NORTE', 'ZAPOPAN SUR', 'MANZANILLO', 'OAXACA',
    'CHILPANCINGO', 'ACAPULCO', 'AGUASCALIENTES', 'PUERTO VALLARTA', 'IGUALA'
  ];
  const occidenteCodes = ['GDL', 'TJL', 'TLQ', 'TNL', 'ZN', 'ZS', 'MLLO', 'OX', 'CG', 'AC', 'AGS', 'PUV', 'IG'];

  // PACIFICO
  const pacificoHubs = ['HUB NOGALES', 'HUB JUAREZ', 'HUB CHIHUAHUA', 'HUB DURANGO', 'HUB SAN LUIS RIO COLORADO', 'HUB TIJUANA', 'HUB ENSENADA', 'HUB MAZATLAN', 'HUB CUAUHTEMOC CHIH', 'HUB TEPIC', 'HUB MEXICALI', 'HUB PARRAL', 'HUB GUADALUPE', 'HUB LA PAZ', 'HUB TECATE', 'HUB ZACATECAS'];
  const pacificoPlazas = ['NOGALES', 'CD. JUAREZ', 'CD JUAREZ', 'CIUDAD JUAREZ', 'DELICIAS', 'DURANGO', 'SAN LUIS RIO COLORADO', 'SAN LUIS RÍO COLORADO', 'TIJUANA', 'ENSENADA', 'MAZATLAN', 'MAZATLÁN', 'CUAUHTEMOC CHIH', 'CUAUHTÉMOC CHIH', 'CUAUHTEMOC', 'CUAUHTÉMOC', 'TEPIC', 'MEXICALI', 'CAMARGO CHIH', 'CAMARGO', 'SAUCILLO', 'CHIHUAHUA', 'ROSARITO', 'PARRAL', 'PARRÁL', 'ZAC GUADALUPE', 'ZACATECAS', 'LA PAZ', 'CASAS GRANDES', 'TECATE', 'MEOQUI', 'MEÓQUI'];
  const pacificoCodes = ['CH', 'CJ', 'CO', 'CR', 'DGO', 'DL', 'EN', 'MX', 'MZN', 'MO', 'PA', 'NOG', 'RS', 'SLR', 'TJ', 'TE', 'TPC', 'ZAC'];

  // SURESTE
  const suresteHubs = [
    'HUB POZA RICA', 'HUB TIHUATLAN', 'HUB COATZINTLA', 'HUB TUXPAN',
    'HUB VALLE HERMOSO', 'HUB CD. MENDOZA', 'HUB RIO BLANCO', 'HUB ORIZABA',
    'HUB CORDOBA', 'HUB COSOLEACAQUE', 'HUB JALTIPAN', 'HUB MINATITLAN',
    'HUB COATZACOALCOS', 'HUB NANCHITAL', 'HUB CHOLULA', 'HUB SAN MARTIN TEXMELUCAN',
    'HUB TLAXCALA', 'HUB TEOLOCHOLCO', 'HUB TEHUACAN', 'HUB LERDO DE TEJADA',
    'HUB SANTIAGO TUXTLA', 'HUB ALVARADO', 'HUB APIZACO', 'HUB HUAMANTLA',
    'HUB ATLIXCO', 'HUB TEZIUTLAN', 'HUB PLAYA DEL CARMEN', 'HUB CANCUN',
    'HUB MAHUAHUAL', 'HUB COZUMEL', 'HUB ISLA MUEJRES', 'HUB TULUM',
    'HUB BUCTOTZ', 'HUB CHEMAX', 'HUB ESPITA', 'HUB IZAMAL', 'HUB MERIDA',
    'HUB MOTUL', 'HUB TIZIMIN', 'HUB VALLADOLID', 'HUB PUERTO PROGRESO',
    'HUB TEMAX', 'HUB TEMOZON', 'HUB UMAN', 'HUB CAMPECHE', 'HUB TAPACHULA',
    'HUB COBA', 'HUB CD. DEL CARMEN', 'HUB MACULTEPEC', 'HUB PARRILLA',
    'HUB VILLAHERMOSA', 'HUB JALPA', 'HUB HUIMANGUILLO', 'HUB MACUSPANA',
    'HUB NACAJUCA', 'HUB CUNDUACAN', 'HUB CARDENAS', 'HUB COMALCALCO',
    'HUB PARAISO', 'HUB CHETUMAL', 'HUB YUCATAN'
  ];
  const surestePlazas = [
    'POZA RICA', 'TIHUATLAN', 'COATZINTLA', 'TUXPAN', 'VALLE HERMOSO',
    'CD. MENDOZA', 'RIO BLANCO', 'ORIZABA', 'CORDOBA', 'COSOLEACAQUE',
    'JALTIPAN', 'MINATITLAN', 'COATZACOALCOS', 'NANCHITAL', 'CHOLULA',
    'SAN MARTIN TEXMELUCAN', 'TLAXCALA', 'TEOLOCHOLCO', 'TEHUACAN',
    'LERDO DE TEJADA', 'SANTIAGO TUXTLA', 'ALVARADO', 'APIZACO', 'HUAMANTLA',
    'ATLIXCO', 'TEZIUTLAN', 'PLAYA DEL CARMEN', 'CANCUN', 'MAHUAHUAL',
    'COZUMEL', 'ISLA MUEJRES', 'TULUM', 'BUCTOTZ', 'CHEMAX', 'ESPITA',
    'IZAMAL', 'MERIDA', 'MOTUL', 'TIZIMIN', 'VALLADOLID', 'PUERTO PROGRESO',
    'TEMAX', 'TEMOZON', 'UMAN', 'CAMPECHE', 'TAPACHULA', 'COBA',
    'CD. DEL CARMEN', 'MACULTEPEC', 'PARRILLA', 'VILLAHERMOSA', 'JALPA',
    'HUIMANGUILLO', 'MACUSPANA', 'NACAJUCA', 'CUNDUACAN', 'CARDENAS',
    'COMALCALCO', 'PARAISO', 'CHETUMAL', 'YUCATAN'
  ];
  const suresteCodes = [
    'PZ', 'TH', 'CI', 'TXP', 'VHE', 'ORI', 'COR', 'CQ',
    'JL', 'MN', 'CC', 'NN', 'CHO', 'TLX', 'TEH', 'LET',
    'SNT', 'ALV', 'API', 'HMA', 'ATX', 'TEZ', 'PC', 'CN', 'MHU', 'CZ',
    'IM', 'TU', 'BT', 'CX', 'ES', 'IL', 'ME', 'ML', 'TZ', 'VD', 'PR',
    'TX', 'TM', 'UM', 'CP', 'TAP', 'CB', 'CDC', 'VHA',
    'JLP', 'HUM', 'MAC', 'NAC', 'CUN', 'CAR', 'CMA', 'PAR', 'CL', 'YUC'
  ];

  // PRIORIDAD #0: códigos cortos exactos
  if (hubStr && metropolitanaCodes.includes(hubStr)) return 'METROPOLITANA';
  if (plazaStr && metropolitanaCodes.includes(plazaStr)) return 'METROPOLITANA';
  if (hubStr && noresteCodes.includes(hubStr)) return 'NORESTE';
  if (plazaStr && noresteCodes.includes(plazaStr)) return 'NORESTE';
  if (hubStr && occidenteCodes.includes(hubStr)) return 'OCCIDENTE';
  if (plazaStr && occidenteCodes.includes(plazaStr)) return 'OCCIDENTE';
  if (hubStr && pacificoCodes.includes(hubStr)) return 'PACIFICO';
  if (plazaStr && pacificoCodes.includes(plazaStr)) return 'PACIFICO';
  if (hubStr && suresteCodes.includes(hubStr)) return 'SURESTE';
  if (plazaStr && suresteCodes.includes(plazaStr)) return 'SURESTE';

  // PRIORIDAD ABSOLUTA: plazas forzadas sureste
  const textoBusqueda = plazaStr || hubStr;
  if (textoBusqueda) {
    const plazasForzadasSureste = [
      'POZA RICA', 'PZ', 'TIHUATLAN', 'TH', 'COATZINTLA', 'CI', 'TUXPAN', 'TXP',
      'VALLE HERMOSO', 'VHE', 'CD. MENDOZA', 'RIO BLANCO', 'ORIZABA', 'ORI',
      'CORDOBA', 'COR', 'COSOLEACAQUE', 'CQ', 'JALTIPAN', 'JL', 'MINATITLAN', 'MN',
      'COATZACOALCOS', 'CC', 'NANCHITAL', 'NN', 'CHOLULA', 'CHO',
      'SAN MARTIN TEXMELUCAN', 'TLAXCALA', 'TEOLOCHOLCO', 'TLX',
      'TEHUACAN', 'TEH', 'LERDO DE TEJADA', 'LET', 'SANTIAGO TUXTLA', 'SNT',
      'ALVARADO', 'ALV', 'APIZACO', 'API', 'HUAMANTLA', 'HMA', 'ATLIXCO', 'ATX',
      'TEZIUTLAN', 'TEZ', 'PLAYA DEL CARMEN', 'PC', 'CANCUN', 'CN',
      'MAHUAHUAL', 'MHU', 'COZUMEL', 'CZ', 'ISLA MUEJRES', 'IM', 'TULUM', 'TU',
      'BUCTOTZ', 'BT', 'CHEMAX', 'CX', 'ESPITA', 'ES', 'IZAMAL', 'IL',
      'MERIDA', 'ME', 'MOTUL', 'ML', 'TIZIMIN', 'TZ', 'VALLADOLID', 'VD',
      'PUERTO PROGRESO', 'PR', 'TEMAX', 'TX', 'TEMOZON', 'TM', 'UMAN', 'UM',
      'CAMPECHE', 'CP', 'TAPACHULA', 'TAP', 'COBA', 'CB',
      'CD. DEL CARMEN', 'CDC', 'MACULTEPEC', 'PARRILLA', 'VILLAHERMOSA', 'VHA',
      'JALPA', 'JLP', 'HUIMANGUILLO', 'HUM', 'MACUSPANA', 'MAC',
      'NACAJUCA', 'NAC', 'CUNDUACAN', 'CUN', 'CARDENAS', 'CAR',
      'COMALCALCO', 'CMA', 'PARAISO', 'PAR', 'CHETUMAL', 'CL', 'YUCATAN', 'YUC'
    ];

    for (const p of plazasForzadasSureste) {
      const pNormalized = normalizeText(p);
      if (textoBusqueda === pNormalized) return 'SURESTE';
      if (textoBusqueda.length > 3 && pNormalized.length > 3) {
        if (textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) return 'SURESTE';
      }
    }
  }

  // PRIORIDAD #2: Hubs completos
  if (hubStr) {
    const plazasProhibidasSureste = [
      'MELCHOR OCAMPO', 'MEO', 'PACHUCA', 'PAC', 'TIZAYUCA', 'TZY',
      'CENTRO DE ACOPIO', 'CA', 'ARAGON', 'ARAGÓN', 'AR', 'TLALPAN', 'TL',
      'ARBOLEDAS', 'AB', 'EMEX', 'MEC', 'ACAPULCO', 'AC', 'CHIHUAHUA', 'CH',
      'ENSENADA', 'EN', 'VICTORIA', 'CIV'
    ];
    const esProhibida = plazasProhibidasSureste.some(pp => {
      const ppNormalized = normalizeText(pp);
      return hubStr === ppNormalized || hubStr.includes(ppNormalized) || ppNormalized.includes(hubStr);
    });

    if (!esProhibida) {
      for (const h of suresteHubs) {
        const hubName = normalizeText(h.replace('HUB ', ''));
        if (hubStr === hubName) return 'SURESTE';
        if (hubStr.length > 3 && hubName.length > 3) {
          if (hubStr.includes(hubName) || hubName.includes(hubStr)) return 'SURESTE';
        }
      }
      for (const p of surestePlazas) {
        const pNormalized = normalizeText(p);
        if (hubStr === pNormalized) return 'SURESTE';
        if (hubStr.length > 3 && pNormalized.length > 3) {
          if (hubStr.includes(pNormalized) || pNormalized.includes(hubStr)) return 'SURESTE';
        }
      }
    }

    if (metropolitanaHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'METROPOLITANA';

    if (noresteHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'NORESTE';

    if (occidenteHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'OCCIDENTE';

    if (pacificoHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'PACIFICO';
  }

  // PRIORIDAD #3: plazas completas
  if (plazaStr) {
    const plazasProhibidasSureste = [
      'MELCHOR OCAMPO', 'MEO', 'PACHUCA', 'PAC', 'TIZAYUCA', 'TZY',
      'CENTRO DE ACOPIO', 'CA', 'ARAGON', 'ARAGÓN', 'AR', 'TLALPAN', 'TL',
      'ARBOLEDAS', 'AB', 'EMEX', 'MEC', 'ACAPULCO', 'AC', 'CHIHUAHUA', 'CH',
      'ENSENADA', 'EN', 'VICTORIA', 'CIV'
    ];
    const esPlazaProhibida = plazasProhibidasSureste.some(pp => {
      const ppNormalized = normalizeText(pp);
      return plazaStr === ppNormalized || plazaStr.includes(ppNormalized) || ppNormalized.includes(plazaStr);
    });

    if (!esPlazaProhibida) {
      for (const p of surestePlazas) {
        const pNormalized = normalizeText(p);
        if (plazaStr === pNormalized || plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return 'SURESTE';
      }
      for (const h of suresteHubs) {
        const hubName = normalizeText(h.replace('HUB ', ''));
        if (plazaStr === hubName || plazaStr.includes(hubName) || hubName.includes(plazaStr)) return 'SURESTE';
      }
    }

    if (metropolitanaPlazas.some(p => {
      const pNormalized = normalizeText(p);
      if (plazaStr === pNormalized) return true;
      if (pNormalized === 'CENTRO DE ACOPIO') return plazaStr.includes('CENTRO DE ACOPIO') || plazaStr === 'CENTRO DE ACOPIO';
      if (pNormalized === 'CENTRO' && plazaStr.includes('CENTRO DE ACOPIO')) return false;
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'METROPOLITANA';

    if (norestePlazas.some(p => {
      const pNormalized = normalizeText(p);
      if (plazaStr === pNormalized) return true;
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'NORESTE';

    if (occidentePlazas.some(p => {
      const pNormalized = normalizeText(p);
      if (plazaStr === pNormalized) return true;
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'OCCIDENTE';

    if (pacificoPlazas.some(p => {
      const pNormalized = normalizeText(p);
      if (plazaStr === pNormalized) return true;
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'PACIFICO';
  }

  // Default
  return 'METROPOLITANA';
};

