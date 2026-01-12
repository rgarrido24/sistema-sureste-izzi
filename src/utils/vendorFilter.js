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
 * Filtra datos por vendedor basado en el usuario logueado
 */
export function filterByVendor(data, user) {
  // Si el usuario es admin, no filtrar
  if (user.role === 'admin') {
    return data;
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

