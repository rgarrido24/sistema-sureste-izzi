/**
 * Función para comparar nombres de vendedor de forma flexible
 * Maneja diferencias en mayúsculas, espacios, acentos, etc.
 */
export function matchVendorName(userName, vendorName) {
  if (!userName || !vendorName) return false;
  
  // Normalizar ambos nombres
  const normalize = (str) => {
    return String(str)
      .toLowerCase()
      .trim()
      .normalize('NFD') // Normalizar caracteres Unicode
      .replace(/[\u0300-\u036f]/g, '') // Remover tildes
      .replace(/[^\w\s]/g, '') // Remover caracteres especiales
      .replace(/\s+/g, ' '); // Normalizar espacios
  };
  
  const normalizedUser = normalize(userName);
  const normalizedVendor = normalize(vendorName);
  
  // Comparación exacta después de normalizar
  if (normalizedUser === normalizedVendor) return true;
  
  // Comparación parcial (por si hay diferencias menores)
  // Si el nombre del usuario está contenido en el nombre del vendedor o viceversa
  if (normalizedUser.length > 5 && normalizedVendor.length > 5) {
    if (normalizedVendor.includes(normalizedUser) || normalizedUser.includes(normalizedVendor)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Normaliza texto sin acentos (para comparación flexible)
 */
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos
    .toUpperCase()
    .trim();
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function cleanPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = String(phone).trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  cleaned = digitsOnly(cleaned);
  if (!cleaned) return null;

  // México: 52 + 10 dígitos
  if (cleaned.startsWith('52') && cleaned.length >= 12) return cleaned;
  // Si tiene 10 dígitos, asumir MX
  if (cleaned.length === 10) return `52${cleaned}`;
  return cleaned;
}

function isMxPhone(phone) {
  const cleaned = cleanPhoneNumber(phone);
  return !!cleaned && cleaned.startsWith('52');
}

function inferCountryFlag(item) {
  const candidates = [
    item?.PAIS, item?.Pais, item?.pais,
    item?.['País'], item?.['PAÍS'],
    item?.country, item?.Country, item?.COUNTRY,
  ];
  for (const c of candidates) {
    const v = normalizeText(c);
    if (!v) continue;
    if (v === 'MX' || v === 'MEX' || v.includes('MEXICO')) return true;
    if (v === 'US' || v === 'USA' || v.includes('UNITED STATES')) return false;
    if (v === 'CA' || v === 'CAN' || v.includes('CANADA')) return false;
    if (v === 'GT' || v.includes('GUATEMALA')) return false;
    if (v === 'SV' || v.includes('EL SALVADOR')) return false;
    return null;
  }
  return null;
}

function isMxRecord(item) {
  if (!item) return false;

  const countryFlag = inferCountryFlag(item);
  if (countryFlag === true) return true;
  if (countryFlag === false) return false;

  const phones = [
    item.Telefono1, item['Telefono1'], item.Telefono2, item['Telefono2'],
    item.Telefono, item['Telefono'], item.telefono,
    item.Celular, item['Celular'], item.CELULAR,
    item.Movil, item['Movil'], item['Móvil'], item.MOVIL,
  ];
  for (const p of phones) {
    if (isMxPhone(p)) return true;
  }

  // Si se detecta una región conocida (hubs/plazas), lo consideramos MX
  const region = getRegionFromData(item);
  if (region) return true;

  // Default estricto
  return false;
}

/**
 * Obtiene región desde HUB y PLAZA o campo Region
 */
function getRegionFromData(item) {
  // Primero buscar campo Region directamente
  const region = item.Region || item['Region'] || item.region || item.REGION;
  if (region) {
    return normalizeText(region);
  }
  
  // Si no hay Region, buscar en HUB y PLAZA
  const hub = item.HUB || item['HUB'] || item.Hub || item.hub || '';
  const plaza = item.PLAZA || item['PLAZA'] || item.Plaza || item.plaza || '';
  
  const hubStr = hub ? normalizeText(hub) : '';
  const plazaStr = plaza ? normalizeText(plaza) : '';
  
  // Regiones según hub/plaza
  // NORESTE
  if (
    hubStr.includes('NORESTE') || hubStr.includes('MONTERREY') ||
    plazaStr.includes('MONTERREY') || plazaStr.includes('MATAMOROS') ||
    plazaStr.includes('REYNOSA') || plazaStr.includes('SALTILLO') ||
    plazaStr.includes('TAMPICO') || plazaStr.includes('NUEVO LAREDO')
  ) {
    return 'NORESTE';
  }
  
  // OCCIDENTE
  if (
    hubStr.includes('OCCIDENTE') || hubStr.includes('GUADALAJARA') ||
    plazaStr.includes('GUADALAJARA') || plazaStr.includes('PUERTO VALLARTA') ||
    plazaStr.includes('AGUASCALIENTES')
  ) {
    return 'OCCIDENTE';
  }
  
  // PACIFICO
  if (
    hubStr.includes('PACIFICO') || hubStr.includes('TIJUANA') ||
    hubStr.includes('CHIHUAHUA') || plazaStr.includes('TIJUANA') ||
    plazaStr.includes('MEXICALI') || plazaStr.includes('CHIHUAHUA') ||
    plazaStr.includes('MAZATLAN') || plazaStr.includes('CIUDAD JUAREZ')
  ) {
    return 'PACIFICO';
  }
  
  // SURESTE
  if (
    hubStr.includes('SURESTE') || hubStr.includes('VILLAHERMOSA') ||
    plazaStr.includes('VILLAHERMOSA') || plazaStr.includes('COATZACOALCOS') ||
    plazaStr.includes('CANCUN') || plazaStr.includes('MERIDA') ||
    plazaStr.includes('CAMPECHE') || plazaStr.includes('CD. DEL CARMEN')
  ) {
    return 'SURESTE';
  }
  
  // METROPOLITANA
  if (
    hubStr.includes('METROPOLITANA') || hubStr.includes('CDMX') ||
    hubStr.includes('MEXICO') || plazaStr.includes('ARBOLEDAS') ||
    plazaStr.includes('VALLEJO') || plazaStr.includes('SATELITE') ||
    plazaStr.includes('POLANCO') || plazaStr.includes('TOLUCA')
  ) {
    return 'METROPOLITANA';
  }
  
  return null;
}

/**
 * Filtra datos por vendedor o región basado en el usuario logueado
 */
export function filterByVendor(data, user) {
  // Si el usuario es admin, admin_general o director, no filtrar
  if (user.role === 'admin' || user.role === 'admin_general' || user.role === 'director') {
    return data;
  }
  
  // Cobranza MX: en realidad es METROPOLITANA (front-end fallback)
  if (user.role === 'cobranza_mx') {
    const userRegion = 'METROPOLITANA';
    const filtered = (data || []).filter(item => {
      const itemRegion = getRegionFromData(item);
      if (!itemRegion) return false;
      return itemRegion === userRegion;
    });
    console.log(`📊 Usuario Cobranza MX (METROPOLITANA): ${user.name} | Total datos: ${data.length} | Filtrados: ${filtered.length}`);
    return filtered;
  }

  // Si el usuario es regionales, filtrar por región
  if (user.role === 'regionales') {
    const userRegion = user.region ? normalizeText(user.region) : null;
    
    if (!userRegion) {
      console.warn('⚠️ Usuario regional sin región asignada, no se puede filtrar');
      return [];
    }
    
    const filtered = data.filter(item => {
      const itemRegion = getRegionFromData(item);
      
      if (!itemRegion) return false;
      
      const matches = itemRegion === userRegion;
      
      // Log para debugging (solo los primeros 5)
      if (data.indexOf(item) < 5) {
        console.log(`🔍 Regional: Comparando "${userRegion}" vs "${itemRegion}" = ${matches}`);
      }
      
      return matches;
    });
    
    console.log(`📊 Usuario Regional: ${user.name} (${userRegion}) | Total datos: ${data.length} | Filtrados: ${filtered.length}`);
    
    // Si no se encontraron datos, mostrar algunas regiones disponibles
    if (filtered.length === 0 && data.length > 0) {
      const uniqueRegions = [...new Set(data.slice(0, 20).map(item => {
        return getRegionFromData(item) || 'Sin región';
      }))];
      console.log(`⚠️ No se encontraron coincidencias. Regiones en los datos:`, uniqueRegions);
    }
    
    return filtered;
  }
  
  // Si el usuario es vendedor o user, filtrar por su nombre
  if (user.role === 'vendedor' || user.role === 'user') {
    const userName = user.name || user.username || '';
    
    if (!userName) {
      console.warn('⚠️ Usuario vendedor sin nombre, no se puede filtrar');
      return [];
    }
    
    const filtered = data.filter(item => {
      const vendedor = item.Vendedor || item['Vendedor'] || '';
      
      if (!vendedor) return false;
      
      const matches = matchVendorName(userName, vendedor);
      
      // Log para debugging (solo los primeros 5)
      if (data.indexOf(item) < 5) {
        console.log(`🔍 Comparando: "${userName}" vs "${vendedor}" = ${matches}`);
      }
      
      return matches;
    });
    
    console.log(`📊 Usuario: ${userName} | Total datos: ${data.length} | Filtrados: ${filtered.length}`);
    
    // Si no se encontraron datos, mostrar algunos ejemplos de vendedores disponibles
    if (filtered.length === 0 && data.length > 0) {
      const uniqueVendors = [...new Set(data.slice(0, 10).map(item => {
        return item.Vendedor || item['Vendedor'] || 'Sin vendedor';
      }))];
      console.log(`⚠️ No se encontraron coincidencias. Ejemplos de vendedores en los datos:`, uniqueVendors);
    }
    
    return filtered;
  }
  
  return data;
}

