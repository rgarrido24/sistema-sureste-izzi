import { useState, useEffect } from 'react';
import { Search, Phone, MessageCircle, Calendar, MapPin, User, CheckCircle, XCircle, Clock, Building2, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import * as api from '../../api.js';
import { filterByVendor } from '../../utils/vendorFilter.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

// Función para limpiar y validar número de teléfono
const cleanPhoneNumber = (phone) => {
  if (!phone) return null;
  let cleaned = phone.toString().trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/[^\d+]/g, '');
  if (!hasPlus) {
    cleaned = cleaned.replace(/\D/g, '');
  }
  if (!cleaned || cleaned.length === 0) return null;
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('52')) {
    if (cleaned.length >= 12) {
      return cleaned;
    }
  }
  if (cleaned.startsWith('1') && cleaned.length >= 11) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `52${cleaned}`;
  }
  if (cleaned.length > 10) {
    return cleaned;
  }
  if (cleaned.length < 10) {
    return null;
  }
  return cleaned;
};

// Mapeo de códigos de plaza a nombres completos
const plazaCodeToName = {
  // Sureste
  'VHA': 'Villahermosa', 'CC': 'Coatzacoalcos', 'PR': 'Puerto Progreso', 'TLX': 'Tlaxcala',
  'PC': 'Playa del Carmen', 'ATX': 'Atlixco', 'PZ': 'Poza Rica',
  // CDC puede ser Ciudad del Carmen o Monterrey - se maneja en los nuevos hubs
  'TH': 'Tihuatlán', 'CI': 'Coatzintla', 'TXP': 'Tuxpan', 'VHE': 'Valle Hermoso',
  'ORI': 'Orizaba', 'COR': 'Córdoba', 'CQ': 'Cosoleacaque', 'JL': 'Jáltipan',
  'MN': 'Minatitlán', 'NN': 'Nanchital', 'CHO': 'Cholula', 'TEH': 'Tehuacán',
  'LET': 'Lerdo de Tejada', 'SNT': 'Santiago Tuxtla', 'ALV': 'Alvarado', 'API': 'Apizaco',
  'HMA': 'Huamantla', 'TEZ': 'Teziutlán', 'CN': 'Cancún', 'MHU': 'Mahahual',
  'CZ': 'Cozumel', 'IM': 'Isla Mujeres', 'TU': 'Tulum', 'BT': 'Buctzotz',
  'CX': 'Chemax', 'ES': 'Espita', 'IL': 'Izamal', 'ME': 'Mérida', 'ML': 'Motul',
  'TZ': 'Tizimín', 'VD': 'Valladolid', 'TX': 'Temax', 'TM': 'Temozón', 'UM': 'Umán',
  'CP': 'Campeche', 'TAP': 'Tapachula', 'CB': 'Cobá', 'JLP': 'Jalpa',
  'HUM': 'Huimanguillo', 'MAC': 'Macuspana', 'NAC': 'Nacajuca', 'CUN': 'Cunduacán',
  'CAR': 'Cárdenas', 'CMA': 'Comalcalco', 'PAR': 'Paraíso', 'CL': 'Chetumal',
  'YUC': 'Yucatán', 'YUCATAN': 'Yucatán', 'YUCATÁN': 'Yucatán',
  // Códigos adicionales que pueden aparecer
  'MERIDA': 'Mérida', 'MÉRIDA': 'Mérida', 'ORIZABA': 'Orizaba', 'TEHUACAN': 'Tehuacán',
  'TEHUACÁN': 'Tehuacán', 'CARDENAS': 'Cárdenas', 'CÁRDENAS': 'Cárdenas',
  'COATZINTLA': 'Coatzintla', 'TIZIMIN': 'Tizimín', 'TIZIMÍN': 'Tizimín', 'TAPACHULA': 'Tapachula',
  // Occidente
  'GDL': 'Guadalajara', 'TJL': 'Tlajomulco', 'TLQ': 'Tlaquepaque', 'TNL': 'Tonalá',
  'ZN': 'Zapopan Norte', 'ZS': 'Zapopan Sur', 'MLLO': 'Manzanillo', 'OX': 'Oaxaca',
  'CG': 'Chilpancingo', 'AC': 'Acapulco', 'AGS': 'Aguascalientes', 'PUV': 'Puerto Vallarta',
  'IG': 'Iguala',
  // PACIFICO - Hubs y plazas (NOTA: CJ y PA están en PACIFICO según datos nuevos)
  'CH': 'Chihuahua', 'CJ': 'Ciudad Juárez', 'CO': 'Cuauhtémoc', 'CR': 'Camargo',
  'DGO': 'Durango', 'DL': 'Delicias', 'EN': 'Ensenada', 'MX': 'Mexicali',
  'MZN': 'Mazatlán', 'MO': 'Meoqui', 'PA': 'Parral',
  'NOG': 'Nogales', 'RS': 'Rosarito', 'SLR': 'San Luis Río Colorado', 'TJ': 'Tijuana',
  'TE': 'Tecate', 'TPC': 'Tepic', 'ZAC': 'Zacatecas',
  // NORESTE - Hubs y plazas (EXACTOS según datos nuevos - SIN CDC, CJ, PA)
  'CEL': 'Celaya', 'IRA': 'Irapuato', 'LIN': 'Linares', 'MTE': 'Mante', 'MTM': 'Matamoros',
  'PAS': 'Matamoros', 'MTH': 'Matehuala', 'APO': 'Monterrey', 'CAD': 'Monterrey',
  'CMY': 'Monterrey', 'CUM': 'Monterrey', 'ESC': 'Monterrey',
  'GAR': 'Monterrey', 'GPA': 'Monterrey', 'HUI': 'Monterrey', 'JUA': 'Monterrey',
  'LNC': 'Monterrey', 'LVD': 'Monterrey', 'SCA': 'Monterrey', 'SNI': 'Monterrey',
  'VFU': 'Monterrey', 'NUL': 'Nuevo Laredo', 'QRO': 'Querétaro', 'BAL': 'Reynosa',
  'RBR': 'Reynosa', 'REY': 'Reynosa', 'SLA': 'Salamanca',
  'REP': 'Saltillo', 'SAS': 'Saltillo', 'SLP': 'San Luis Potosí', 'ALT': 'Tampico',
  'TAM': 'Tampico', 'VL': 'Valles', 'CIV': 'Victoria',
  // SURESTE - Agregar CDC
  'CDC': 'Cd. del Carmen',
  // METROPOLITANA - Hubs y plazas (datos exactos del usuario)
  'AB': 'Arboledas', 'VO': 'Vallejo', 'ST': 'Satélite', 'PL': 'Polanco',
  'KI': 'Santa Fe', 'TOL': 'Toluca', 'ECA': 'Ecatepec', 'CU': 'Cuautitlán',
  'MEO': 'Melchor Ocampo', 'TZY': 'Tizayuca', 'VA': 'Valle', 'TLA': 'Tula',
  'TUL': 'Tulancingo', 'TPR': 'Tepeji del Río', 'PAC': 'Pachuca', 'AR': 'Aragón',
  'CE': 'Centro', 'CA': 'Centro de Acopio', 'CM': 'Chimalhuacán', 'IZ': 'Iztapalapa',
  'RG': 'Rojo Gómez', 'IX': 'Iztapaluca', 'IXT': 'Iztapaluca', 'SA': 'Saratoga', 'TL': 'Tlalpan',
  'CT': 'Cuautla', 'CV': 'Cuernavaca', 'YU': 'Yautepec',
  // Variantes adicionales para METROPOLITANA
  'ARBOLEDAS': 'Arboledas', 'VALLEJO': 'Vallejo', 'SATELITE': 'Satélite', 'POLANCO': 'Polanco',
  'SANTA FE': 'Santa Fe', 'TOLUCA': 'Toluca', 'ECATEPEC': 'Ecatepec', 'CUAUTITLAN': 'Cuautitlán',
  'MELCHOR OCAMPO': 'Melchor Ocampo', 'TIZAYUCA': 'Tizayuca', 'VALLE': 'Valle', 'TULA': 'Tula',
  'TULANCINGO': 'Tulancingo', 'TEPEJI DEL RIO': 'Tepeji del Río', 'PACHUCA': 'Pachuca', 'ARAGON': 'Aragón',
  'CENTRO': 'Centro', 'CENTRO DE ACOPIO': 'Centro de Acopio', 'CHIMALHUACAN': 'Chimalhuacán', 'CHIMALHUACÁN': 'Chimalhuacán',
  'IZTAPALAPA': 'Iztapalapa', 'ROJO GOMEZ': 'Rojo Gómez', 'ROJO GÓMEZ': 'Rojo Gómez',
  'IXTAPALUCA': 'Iztapaluca', 'SARATOGA': 'Saratoga', 'TLALPAN': 'Tlalpan',
  'CUAUTLA': 'Cuautla', 'CUERNAVACA': 'Cuernavaca', 'YAUTEPEC': 'Yautepec'
};

// Función para obtener nombre completo de plaza desde código
const getPlazaFullName = (plazaCode) => {
  if (!plazaCode) return 'Sin plaza';
  const code = String(plazaCode).trim().toUpperCase();
  
  // Filtrar valores genéricos
  if (code.includes('DEFAULT') || code.includes('ORGANIZATION') || code === '') {
    return 'Sin plaza';
  }
  
  // Buscar en el mapeo
  if (plazaCodeToName[code]) {
    return plazaCodeToName[code];
  }
  
  // Si es un nombre completo (más de 3 caracteres y no es un código corto), devolverlo tal cual
  if (code.length > 3 && !code.match(/^[A-Z]{2,3}$/)) {
    // Capitalizar primera letra de cada palabra
    return code.split(' ').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  }
  
  // Si no está en el mapeo, devolver el código original
  return code;
};

// Función para normalizar texto sin acentos (para comparación flexible)
const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos
    .toUpperCase()
    .trim();
};

// Función para obtener región desde HUB y PLAZA
const getRegionFromHubPlaza = (hub, plaza) => {
  if (!hub && !plaza) return null;
  
  // Normalizar primero (sin acentos, mayúsculas)
  const hubStr = hub ? normalizeText(hub) : '';
  const plazaStr = plaza ? normalizeText(plaza) : '';
  
  // ============================================
  // DEFINIR TODAS LAS LISTAS PRIMERO (antes de usarlas)
  // ============================================
  
  // METROPOLITANA - Datos exactos proporcionados por el usuario
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
  
  // NORESTE - Datos exactos proporcionados por el usuario
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
  
  // OCCIDENTE - Datos exactos proporcionados por el usuario
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
  
  // PACIFICO - Datos exactos proporcionados por el usuario
  const pacificoHubs = ['HUB NOGALES', 'HUB JUAREZ', 'HUB CHIHUAHUA', 'HUB DURANGO', 'HUB SAN LUIS RIO COLORADO', 'HUB TIJUANA', 'HUB ENSENADA', 'HUB MAZATLAN', 'HUB CUAUHTEMOC CHIH', 'HUB TEPIC', 'HUB MEXICALI', 'HUB PARRAL', 'HUB GUADALUPE', 'HUB LA PAZ', 'HUB TECATE', 'HUB ZACATECAS'];
  const pacificoPlazas = ['NOGALES', 'CD. JUAREZ', 'CD JUAREZ', 'CIUDAD JUAREZ', 'DELICIAS', 'DURANGO', 'SAN LUIS RIO COLORADO', 'SAN LUIS RÍO COLORADO', 'TIJUANA', 'ENSENADA', 'MAZATLAN', 'MAZATLÁN', 'CUAUHTEMOC CHIH', 'CUAUHTÉMOC CHIH', 'CUAUHTEMOC', 'CUAUHTÉMOC', 'TEPIC', 'MEXICALI', 'CAMARGO CHIH', 'CAMARGO', 'SAUCILLO', 'CHIHUAHUA', 'ROSARITO', 'PARRAL', 'PARRÁL', 'ZAC GUADALUPE', 'ZACATECAS', 'LA PAZ', 'CASAS GRANDES', 'TECATE', 'MEOQUI', 'MEÓQUI'];
  const pacificoCodes = [
    'CH', 'CJ', 'CO', 'CR', 'DGO', 'DL', 'EN', 'MX', 'MZN', 'MO', 'PA', 'NOG', 'RS', 'SLR', 'TJ', 'TE', 'TPC', 'ZAC'
  ];
  
  // SURESTE - Lista completa EXACTA según datos proporcionados
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
    'PZ', 'TH', 'CI', 'TXP', 'VHE', 'ORI', 'ORI', 'ORI', 'COR', 'CQ',
    'JL', 'MN', 'CC', 'NN', 'CHO', 'TLX', 'TLX', 'TLX', 'TEH', 'LET',
    'SNT', 'ALV', 'API', 'HMA', 'ATX', 'TEZ', 'PC', 'CN', 'MHU', 'CZ',
    'IM', 'TU', 'BT', 'CX', 'ES', 'IL', 'ME', 'ML', 'TZ', 'VD', 'PR',
    'TX', 'TM', 'UM', 'CP', 'TAP', 'CB', 'CDC', 'VHA', 'VHA', 'VHA',
    'JLP', 'HUM', 'MAC', 'NAC', 'CUN', 'CAR', 'CMA', 'PAR', 'CL', 'YUC'
  ];
  
  // ============================================
  // AHORA SÍ PODEMOS USAR LAS VARIABLES
  // ============================================
  
  // Log inicial para debugging de plazas problemáticas (también verificar en Hub)
  const textoParaLog = plaza || hub || '';
  if (textoParaLog && (textoParaLog.toUpperCase().includes('MERIDA') || textoParaLog.toUpperCase().includes('ME') || 
      textoParaLog.toUpperCase().includes('ORIZABA') || textoParaLog.toUpperCase().includes('ORI') ||
      textoParaLog.toUpperCase().includes('TEHUACAN') || textoParaLog.toUpperCase().includes('TEH') ||
      textoParaLog.toUpperCase().includes('CARDENAS') || textoParaLog.toUpperCase().includes('CAR') ||
      textoParaLog.toUpperCase().includes('COATZINTLA') || textoParaLog.toUpperCase().includes('CI') ||
      textoParaLog.toUpperCase().includes('TIZIMIN') || textoParaLog.toUpperCase().includes('TZ') ||
      textoParaLog.toUpperCase().includes('TAPACHULA') || textoParaLog.toUpperCase().includes('TAP') ||
      textoParaLog.toUpperCase().includes('YUCATAN') || textoParaLog.toUpperCase().includes('YUC') ||
      textoParaLog.toUpperCase() === 'CDC')) {
    console.log(`🔍 getRegionFromHubPlaza INICIO - Plaza original: "${plaza}", Hub original: "${hub}"`);
    console.log(`   - Plaza normalizada: "${plazaStr}", Hub normalizada: "${hubStr}"`);
    console.log(`   - Texto de búsqueda: "${plazaStr || hubStr}"`);
  }
  
  // PRIORIDAD #0: Verificar códigos cortos EXACTOS primero (ANTES de comparaciones parciales)
  // Esto evita que códigos cortos como "CM" o "IX" sean capturados incorrectamente
  // ORDEN: METROPOLITANA → NORESTE → OCCIDENTE → PACIFICO → SURESTE
  
  // METROPOLITANA PRIMERO
  if (hubStr && metropolitanaCodes.includes(hubStr)) return 'METROPOLITANA';
  if (plazaStr && metropolitanaCodes.includes(plazaStr)) return 'METROPOLITANA';
  
  // NORESTE SEGUNDO (NOTA: CDC está en SURESTE, CJ y PA están en PACIFICO)
  if (hubStr && noresteCodes.includes(hubStr)) return 'NORESTE';
  if (plazaStr && noresteCodes.includes(plazaStr)) return 'NORESTE';
  
  // OCCIDENTE TERCERO
  if (hubStr && occidenteCodes.includes(hubStr)) return 'OCCIDENTE';
  if (plazaStr && occidenteCodes.includes(plazaStr)) return 'OCCIDENTE';
  
  // PACIFICO CUARTO
  if (hubStr && pacificoCodes.includes(hubStr)) return 'PACIFICO';
  if (plazaStr && pacificoCodes.includes(plazaStr)) return 'PACIFICO';
  
  // SURESTE QUINTO (solo si no fue capturado por otras regiones)
  if (hubStr && suresteCodes.includes(hubStr)) return 'SURESTE';
  if (plazaStr && suresteCodes.includes(plazaStr)) return 'SURESTE';
  
  // PRIORIDAD ABSOLUTA #1: Plazas específicas que DEBEN ser SURESTE (verificar DESPUÉS de códigos)
  // Estas plazas tienen prioridad absoluta sobre cualquier otra verificación
  // También verificar en el Hub si no hay Plaza
  const textoBusqueda = plazaStr || hubStr;
  if (textoBusqueda) {
      // Lista completa de TODAS las plazas forzadas de SURESTE según el listado proporcionado
      // Incluir también códigos cortos para asegurar detección
      const plazasForzadasSureste = [
        // Plazas principales con códigos
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
        
        // PRIORIDAD 1: Comparación EXACTA (más estricta)
        if (textoBusqueda === pNormalized) {
          console.log(`✅ PLAZA FORZADA SURESTE (exacta): "${plaza || hub}" (normalizada: "${textoBusqueda}") = "${pNormalized}" → SURESTE`);
          return 'SURESTE';
        }
        
        // PRIORIDAD 2: Comparación parcial SOLO si ambos tienen más de 3 caracteres
        // Esto evita que códigos cortos como "CM" o "IX" coincidan con palabras más largas
        if (textoBusqueda.length > 3 && pNormalized.length > 3) {
          if (textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
            console.log(`✅ PLAZA FORZADA SURESTE (parcial): "${plaza || hub}" (normalizada: "${textoBusqueda}") contiene "${pNormalized}" → SURESTE`);
            return 'SURESTE';
          }
        }
        
        // PRIORIDAD 3: Comparación por palabras SOLO si ambos tienen más de 3 caracteres
        if (textoBusqueda.length > 3 && pNormalized.length > 3) {
          const palabrasTexto = textoBusqueda.split(/\s+/);
          const palabrasForzada = pNormalized.split(/\s+/);
          for (const palabra of palabrasForzada) {
            // Solo comparar palabras de más de 3 caracteres para evitar falsos positivos
            if (palabra.length > 3 && palabrasTexto.some(p => p === palabra)) {
              console.log(`✅ PLAZA FORZADA SURESTE (por palabra): "${plaza || hub}" contiene palabra "${palabra}" → SURESTE`);
              return 'SURESTE';
            }
          }
        }
      }
    }
  
  // PRIORIDAD #2: Verificar nombres completos de Hubs
  if (hubStr) {
    // Lista de plazas prohibidas para SURESTE (verificar primero)
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
    
    // Si NO es prohibida, verificar SURESTE PRIMERO (prioridad absoluta para SURESTE)
    if (!esProhibida) {
      // Verificar HUBs de SURESTE con comparación más estricta
      for (const h of suresteHubs) {
        const hubName = normalizeText(h.replace('HUB ', ''));
        
        // PRIORIDAD 1: Comparación EXACTA
        if (hubStr === hubName) {
          return 'SURESTE';
        }
        
        // PRIORIDAD 2: Comparación parcial SOLO si ambos tienen más de 3 caracteres
        if (hubStr.length > 3 && hubName.length > 3) {
          if (hubStr.includes(hubName) || hubName.includes(hubStr)) {
            return 'SURESTE';
          }
        }
      }
      
      // También verificar en surestePlazas por si el hub coincide con una plaza
      for (const p of surestePlazas) {
        const pNormalized = normalizeText(p);
        
        // PRIORIDAD 1: Comparación EXACTA
        if (hubStr === pNormalized) {
          return 'SURESTE';
        }
        
        // PRIORIDAD 2: Comparación parcial SOLO si ambos tienen más de 3 caracteres
        if (hubStr.length > 3 && pNormalized.length > 3) {
          if (hubStr.includes(pNormalized) || pNormalized.includes(hubStr)) {
            return 'SURESTE';
          }
        }
      }
    }
    
    // METROPOLITANA (después de SURESTE)
    if (metropolitanaHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'METROPOLITANA';
    
    // NORESTE
    if (noresteHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'NORESTE';
    
    // OCCIDENTE
    if (occidenteHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'OCCIDENTE';
    
    // PACIFICO
    if (pacificoHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'PACIFICO';
  }
  
  // PRIORIDAD #3: Verificar nombres completos de Plazas
  if (plazaStr) {
    // SURESTE PRIMERO (verificar todas las plazas de Sureste)
    // PERO primero verificar que NO sea una plaza prohibida para SURESTE
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
    
    // Solo verificar SURESTE si NO es una plaza prohibida
    // SURESTE tiene prioridad sobre otras regiones (excepto las prohibidas)
    if (!esPlazaProhibida) {
      for (const p of surestePlazas) {
        const pNormalized = normalizeText(p);
        if (plazaStr === pNormalized || 
            plazaStr.includes(pNormalized) || 
            pNormalized.includes(plazaStr)) {
          return 'SURESTE';
        }
      }
      
      // También verificar en suresteHubs por si la plaza coincide con un hub
      for (const h of suresteHubs) {
        const hubName = normalizeText(h.replace('HUB ', ''));
        if (plazaStr === hubName || 
            plazaStr.includes(hubName) || 
            hubName.includes(plazaStr)) {
          return 'SURESTE';
        }
      }
    }
    
    // METROPOLITANA (después de SURESTE)
    if (metropolitanaPlazas.some(p => {
      const pNormalized = normalizeText(p);
      // Comparación exacta primero
      if (plazaStr === pNormalized) return true;
      // Para "Centro de Acopio", verificar que sea exacto o contenga "CENTRO DE ACOPIO" completo
      if (pNormalized === 'CENTRO DE ACOPIO') {
        return plazaStr.includes('CENTRO DE ACOPIO') || plazaStr === 'CENTRO DE ACOPIO';
      }
      // Para "Centro" solo, verificar que NO sea "Centro de Acopio"
      if (pNormalized === 'CENTRO' && plazaStr.includes('CENTRO DE ACOPIO')) {
        return false; // "Centro de Acopio" debe ser capturado por la verificación anterior
      }
      // Comparación parcial para otros casos
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'METROPOLITANA';
    
    // NORESTE
    if (norestePlazas.some(p => {
      const pNormalized = normalizeText(p);
      if (plazaStr === pNormalized) return true;
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'NORESTE';
    
    // OCCIDENTE
    if (occidentePlazas.some(p => {
      const pNormalized = normalizeText(p);
      if (plazaStr === pNormalized) return true;
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'OCCIDENTE';
    
    // PACIFICO
    if (pacificoPlazas.some(p => {
      const pNormalized = normalizeText(p);
      if (plazaStr === pNormalized) return true;
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'PACIFICO';
  }
  
  // Si no se detectó ninguna región, asignar a METROPOLITANA por defecto (no "Sin Dato")
  return 'METROPOLITANA';
};

// Función para generar mensaje personalizado desde plantilla para Operación del Día
const generateMessageFromTemplate = async (client) => {
  try {
    console.log('🔍 Buscando plantilla para módulo: operacion');
    
    // Obtener todas las plantillas activas
    const allTemplates = await api.getTemplates();
    console.log('📋 Plantillas obtenidas:', allTemplates.length);
    
    // Buscar plantilla que coincida con el módulo "operacion" o "general"
    let activeTemplate = allTemplates.find(t => 
      t.isActive && (
        t.module === 'operacion' || 
        t.module === 'OPERACION' || 
        t.module === 'Operacion' ||
        t.module === 'operación' ||
        t.module === 'OPERACIÓN' ||
        t.module === 'Operación'
      )
    );
    
    // Si no se encuentra, buscar plantillas con módulo "general"
    if (!activeTemplate) {
      activeTemplate = allTemplates.find(t => 
        t.isActive && (
          t.module?.toLowerCase() === 'general' ||
          t.module?.toLowerCase() === 'generales'
        )
      );
    }
    
    console.log('✅ Plantilla encontrada:', activeTemplate ? activeTemplate.name : 'NINGUNA');
    if (activeTemplate) {
      console.log('📝 Módulo de plantilla:', activeTemplate.module);
      console.log('📝 Contenido de plantilla:', activeTemplate.content?.substring(0, 100) + '...');
    }
    
    if (!activeTemplate) {
      console.warn('⚠️ No se encontró plantilla activa para módulo: operacion');
      // Si no hay plantilla, usar mensaje por defecto
      const nombre = client['Compañia'] || client['Compañía'] || client.Cliente || client['Cliente'] || 'Cliente';
      const cuentaFact = client['Cuenta de facturación'] || client['Cuenta de facturacion'] || '';
      const cuentaNum = client['Nº de cuenta'] || client['N° de cuenta'] || '';
      const cuenta = cuentaFact || cuentaNum || client.cuenta || client['Cuenta'] || 'N/A';
      const ordenVTS = client['No. VTS'] || client['No VTS'] || '';
      const ordenNum = client['Nº de orden'] || client['N° de orden'] || '';
      const orden = ordenVTS || ordenNum || client['Orden'] || 'N/A';
      return `Hola ${nombre}, te contactamos sobre tu orden ${orden} (Cuenta: ${cuenta}).`;
    }

    let message = activeTemplate.content;
    
    // Reemplazar variables con datos del cliente de Operación del Día
    const nombre = client['Compañia'] || client['Compañía'] || client.Cliente || client['Cliente'] || 'Cliente';
    const cuentaFact = client['Cuenta de facturación'] || client['Cuenta de facturacion'] || '';
    const cuentaNum = client['Nº de cuenta'] || client['N° de cuenta'] || '';
    const cuenta = cuentaFact || cuentaNum || client.cuenta || client['Cuenta'] || 'N/A';
    const ordenVTS = client['No. VTS'] || client['No VTS'] || '';
    const ordenNum = client['Nº de orden'] || client['N° de orden'] || '';
    const orden = ordenVTS || ordenNum || client['Orden'] || 'N/A';
    const estado = client['Estado'] || client.estado || client.Estado || 'N/A';
    const fechaSolicitada = client['Fecha solicitada'] || client['Fecha Solicitada'] || client.fechaSolicitada || 'N/A';
    const hub = client.Hub || client['Hub'] || client.HUB || 'N/A';
    const plaza = client.Plaza || client['Plaza'] || client.PLAZA || 'N/A';
    const vendedor = client['Clave Vendedor'] || client['CVVEN'] || client.Vendedor || client['Vendedor'] || 'N/A';
    
    // Formatear montos como moneda (si aplica)
    const formatCurrency = (value) => {
      if (!value) return '$0.00';
      const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
      if (isNaN(num)) return '$0.00';
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
    };

    message = message
      .replace(/{nombre}/g, nombre)
      .replace(/{cuenta}/g, cuenta)
      .replace(/{orden}/g, orden)
      .replace(/{estado}/g, estado)
      .replace(/{fechaSolicitada}/g, fechaSolicitada)
      .replace(/{fecha}/g, fechaSolicitada)
      .replace(/{hub}/g, hub)
      .replace(/{plaza}/g, plaza)
      .replace(/{vendedor}/g, vendedor)
      .replace(/{monto}/g, formatCurrency(client.monto || client.Monto || 0))
      .replace(/{porVencer}/g, formatCurrency(client.porVencer || client['Por Vencer'] || 0))
      .replace(/{vencido}/g, formatCurrency(client.vencido || client.Vencido || 0));

    // Agregar video si existe
    if (activeTemplate.videoUrl) {
      message += `\n\n📹 Video tutorial: ${activeTemplate.videoUrl}`;
    }

    return message;
  } catch (error) {
    console.error('❌ Error generando mensaje desde plantilla:', error);
    console.error('Error completo:', error);
    console.error('Cliente:', client);
    // Mensaje por defecto si hay error
    const nombre = client['Compañia'] || client['Compañía'] || client.Cliente || client['Cliente'] || 'Cliente';
    const cuentaFact = client['Cuenta de facturación'] || client['Cuenta de facturacion'] || '';
    const cuentaNum = client['Nº de cuenta'] || client['N° de cuenta'] || '';
    const cuenta = cuentaFact || cuentaNum || client.cuenta || client['Cuenta'] || 'N/A';
    const ordenVTS = client['No. VTS'] || client['No VTS'] || '';
    const ordenNum = client['Nº de orden'] || client['N° de orden'] || '';
    const orden = ordenVTS || ordenNum || client['Orden'] || 'N/A';
    return `Hola ${nombre}, te contactamos sobre tu orden ${orden} (Cuenta: ${cuenta}).`;
  }
};

// Función para abrir WhatsApp
const openWhatsApp = async (phone, client) => {
  if (!phone) {
    alert('No hay número de teléfono disponible para este cliente');
    return;
  }
  
  const phoneNumber = cleanPhoneNumber(phone);
  
  if (!phoneNumber) {
    alert('El número de teléfono no es válido. Por favor verifica el número del cliente.');
    return;
  }
  
  if (phoneNumber.length < 10) {
    alert('El número de teléfono es muy corto. Debe tener al menos 10 dígitos.');
    return;
  }
  
  try {
    // Generar mensaje personalizado desde plantilla
    const message = await generateMessageFromTemplate(client);
    
    // Codificar el mensaje para URL
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
    
    console.log('Abriendo WhatsApp con URL:', whatsappUrl.replace(/&text=.*/, '&text=[mensaje codificado]'));
    console.log('Mensaje original:', message);
    console.log('Número de teléfono:', phoneNumber);
    
    window.location.href = whatsappUrl;
  } catch (error) {
    console.error('Error al abrir WhatsApp:', error);
    alert('Error al generar el mensaje. Por favor intenta de nuevo.');
  }
};

export default function OperacionModule() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [allData, setAllData] = useState([]); // Todos los datos incluyendo Completa/Instalada para estadísticas
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [showStats, setShowStats] = useState(true); // Mostrar estadísticas por defecto
  const [vendors, setVendors] = useState([]); // Lista de vendedores
  const [assigningVendor, setAssigningVendor] = useState(null); // ID del item al que se está asignando vendedor
  const [vendorInput, setVendorInput] = useState(''); // Input para vendedor manual
  const [currentPage, setCurrentPage] = useState(1); // Página actual
  const [itemsPerPage, setItemsPerPage] = useState(25); // Items por página (25, 50, 75, 100)
  const [notas, setNotas] = useState({}); // Notas locales por item ID
  const [savingNotas, setSavingNotas] = useState({}); // Estado de guardado por item ID

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        let operacionData = await api.getOperacionDia();
        operacionData = filterByVendor(operacionData, user);
        
        // Filtrar estados "Completa" e "Instalada" del listado principal
        // Pero mantenerlos en el filtro de estados para poder buscarlos
        const operacionFiltrada = operacionData.filter(item => {
          const estado = (item.Estado || item.estado || '').toUpperCase().trim();
          return estado !== 'COMPLETA' && estado !== 'INSTALADA';
        });
        
        // Eliminar duplicados: si hay varias órdenes con el mismo número de cuenta,
        // solo mantener la última (más reciente por fecha de actualización o creación)
        // IMPORTANTE: Usar "Cuenta de facturación" o "Nº de cuenta" (columna BQ) como clave
        // NO usar "Nº de cuenta" si contiene texto como "Residencial"
        const cuentaMap = new Map();
        const sinCuenta = [];
        
        operacionFiltrada.forEach(item => {
          // Priorizar "Cuenta de facturación" (columna AT) y "Nº de cuenta" (columna BQ) si es numérico
          const cuentaFact = item['Cuenta de facturación'] || item['Cuenta de facturacion'] || '';
          const cuentaNum = item['Nº de cuenta'] || item['N° de cuenta'] || '';
          const cuentaNormalizada = item.cuenta || '';
          
          // Determinar la cuenta: si cuentaNum es numérico, usarlo; si no, usar cuentaFact
          let cuenta = '';
          if (cuentaFact && !isNaN(cuentaFact)) {
            cuenta = String(cuentaFact).trim();
          } else if (cuentaNum && !isNaN(cuentaNum)) {
            cuenta = String(cuentaNum).trim();
          } else if (cuentaNormalizada && !isNaN(cuentaNormalizada)) {
            cuenta = String(cuentaNormalizada).trim();
          }
          
          // Solo deduplicar si tenemos un número de cuenta válido
          if (cuenta && cuenta !== '' && !isNaN(cuenta)) {
            const existing = cuentaMap.get(cuenta);
            if (!existing) {
              cuentaMap.set(cuenta, item);
            } else {
              // Comparar fechas para mantener la más reciente
              const existingDate = new Date(existing.updatedAt || existing.createdAt || existing.fechaActualizacion || existing.fechaCreacion || 0);
              const currentDate = new Date(item.updatedAt || item.createdAt || item.fechaActualizacion || item.fechaCreacion || 0);
              if (currentDate >= existingDate) {
                cuentaMap.set(cuenta, item);
              }
            }
          } else {
            // Sin cuenta válida numérica, mantener todas (no se pueden deduplicar)
            sinCuenta.push(item);
          }
        });
        
        // Convertir map a array y agregar IDs
        const uniqueData = Array.from(cuentaMap.values()).map((d, index) => ({ 
          id: d._id || d.id || `operacion-${index}`, 
          ...d 
        }));
        
        // Agregar los que no tienen cuenta
        sinCuenta.forEach((d, index) => {
          uniqueData.push({
            id: d._id || d.id || `operacion-sin-cuenta-${index}`,
            ...d
          });
        });
        
        console.log(`📊 Total registros originales: ${operacionData.length}`);
        console.log(`📊 Después de filtrar Completa/Instalada: ${operacionFiltrada.length}`);
        console.log(`📊 Después de deduplicación: ${uniqueData.length}`);
        
        setData(uniqueData);
        setAllData(operacionData); // Guardar todos los datos para estadísticas
        
        // Inicializar notas desde los datos cargados
        const notasIniciales = {};
        operacionData.forEach(item => {
          const itemId = item._id || item.id;
          if (itemId && (item.Nota || item.Notas)) {
            notasIniciales[itemId] = item.Nota || item.Notas || '';
          }
        });
        setNotas(notasIniciales);
      } catch (error) {
        console.error('Error cargando operación:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Cargar lista de vendedores desde sales_master e install_master
  useEffect(() => {
    const loadVendors = async () => {
      try {
        // Endpoint optimizado en backend: devuelve vendedores desde usuarios (rápido)
        const vendorsData = await api.getOperacionVendors();
        const vendorsList = (vendorsData?.vendors || []).filter(Boolean);
        setVendors(vendorsList.map(v => ({ id: v, name: v, username: v })));
      } catch (error) {
        console.error('Error cargando vendedores:', error);
        // Fallback: intentar obtener usuarios del sistema
        try {
          const users = await api.getAllUsers();
          const vendorsList = users.filter(u => u.role === 'vendedor' || u.role === 'user');
          setVendors(vendorsList);
        } catch (fallbackError) {
          console.error('Error en fallback de vendedores:', fallbackError);
        }
      }
    };
    // Cargar vendedores para roles que pueden asignar
    if (user && (user.role === 'admin' || user.role === 'admin_general' || user.role === 'director' || user.role === 'mesa_control')) {
      loadVendors();
    }
  }, [user]);

  // Función para guardar notas
  const handleSaveNota = async (itemId, nota) => {
    try {
      setSavingNotas(prev => ({ ...prev, [itemId]: true }));
      await api.updateOperacion(itemId, { Nota: nota, Notas: nota });
      
      // Actualizar el item en allData y data
      setAllData(prev => prev.map(item => 
        item.id === itemId ? { ...item, Nota: nota, Notas: nota } : item
      ));
      setData(prev => prev.map(item => 
        item.id === itemId ? { ...item, Nota: nota, Notas: nota } : item
      ));
      
      setSavingNotas(prev => ({ ...prev, [itemId]: false }));
    } catch (error) {
      console.error('Error guardando nota:', error);
      alert('Error al guardar la nota. Por favor intenta de nuevo.');
      setSavingNotas(prev => ({ ...prev, [itemId]: false }));
    }
  };

  // Función para asignar vendedor
  const handleAssignVendor = async (itemId, vendedorNombre) => {
    if (!vendedorNombre || vendedorNombre.trim() === '') {
      alert('Por favor ingresa un nombre de vendedor');
      return;
    }

    try {
      // Obtener información del usuario actual para registrar quién modificó
      const usuarioActual = user?.username || user?.id || '';
      const usuarioActualNombre = user?.name || '';
      
      await api.updateOperacionVendedor(
        itemId, 
        vendedorNombre.trim(),
        usuarioActual,
        usuarioActualNombre
      );
      // Recargar datos
      const operacionData = await api.getOperacionDia();
      const filtered = filterByVendor(operacionData, user);
      setAllData(operacionData);
      
      const operacionFiltrada = filtered.filter(item => {
        const estado = (item.Estado || item.estado || '').toUpperCase().trim();
        return estado !== 'COMPLETA' && estado !== 'INSTALADA';
      });
      
      // Aplicar deduplicación
      const cuentaMap = new Map();
      const sinCuenta = [];
      
      operacionFiltrada.forEach(item => {
        const cuentaFact = item['Cuenta de facturación'] || item['Cuenta de facturacion'] || '';
        const cuentaNum = item['Nº de cuenta'] || item['N° de cuenta'] || '';
        const cuentaNormalizada = item.cuenta || '';
        
        let cuenta = '';
        if (cuentaFact && !isNaN(cuentaFact)) {
          cuenta = String(cuentaFact).trim();
        } else if (cuentaNum && !isNaN(cuentaNum)) {
          cuenta = String(cuentaNum).trim();
        } else if (cuentaNormalizada && !isNaN(cuentaNormalizada)) {
          cuenta = String(cuentaNormalizada).trim();
        }
        
        if (cuenta && cuenta !== '' && !isNaN(cuenta)) {
          const existing = cuentaMap.get(cuenta);
          if (!existing) {
            cuentaMap.set(cuenta, item);
          } else {
            const existingDate = new Date(existing.updatedAt || existing.createdAt || existing.fechaActualizacion || existing.fechaCreacion || 0);
            const currentDate = new Date(item.updatedAt || item.createdAt || item.fechaActualizacion || item.fechaCreacion || 0);
            if (currentDate >= existingDate) {
              cuentaMap.set(cuenta, item);
            }
          }
        } else {
          sinCuenta.push(item);
        }
      });
      
      const uniqueData = Array.from(cuentaMap.values()).map((d, index) => ({ 
        id: d._id || d.id || `operacion-${index}`, 
        ...d 
      }));
      
      sinCuenta.forEach((d, index) => {
        uniqueData.push({
          id: d._id || d.id || `operacion-sin-cuenta-${index}`,
          ...d
        });
      });
      
      setData(uniqueData);
      setAssigningVendor(null);
      setVendorInput('');
      alert('✅ Vendedor asignado correctamente');
    } catch (error) {
      console.error('Error asignando vendedor:', error);
      alert('Error al asignar vendedor. Por favor intenta de nuevo.');
    }
  };

  // Filtrar datos
  const filteredData = data.filter(item => {
    // Obtener campos para búsqueda
    const cliente = item['Compañia'] || item['Compañía'] || item.Cliente || item['Cliente'] || '';
    const cuenta = item.cuenta || item['Nº de cuenta'] || item['Cuenta de facturación'] || item['Cuenta'] || '';
    const orden = item['Nº de orden'] || item['No. VTS'] || item['Orden'] || '';
    const telefono = item['Teléfonos'] || item['Teléfono'] || item.Telefono || item['Telefono'] || '';
    const cvven = item['Clave Vendedor'] || item['CVVEN'] || item.CVVEN || '';
    
    const matchesSearch = !searchTerm || 
      cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.toString().includes(searchTerm) ||
      orden.toString().includes(searchTerm) ||
      telefono.toString().includes(searchTerm) ||
      cvven.toString().includes(searchTerm);
    
    // Filtro por estado
    let matchesEstado = true;
    if (filterEstado) {
      const estadoItem = (item.estado || item.Estado || '').toUpperCase().trim();
      const estadoFiltro = filterEstado.toUpperCase().trim();
      matchesEstado = estadoItem === estadoFiltro;
    }
    
    // Filtro por fecha (sin hora)
    let matchesFecha = true;
    if (filterFecha) {
      const fechaSolicitada = item['Fecha solicitada'] || item['Fecha Solicitada'] || item['FechaSolicitada'] || 
                              item['Fecha solicitada'] || item['Fecha Solicitada'] || '';
      if (fechaSolicitada) {
        // Convertir fecha a formato YYYY-MM-DD para comparar (sin hora)
        let fechaItem = '';
        if (fechaSolicitada instanceof Date) {
          fechaItem = fechaSolicitada.toISOString().split('T')[0];
        } else {
          const fechaStr = String(fechaSolicitada).trim();
          // Si tiene hora, quitarla
          const fechaSinHora = fechaStr.split(' ')[0].split('T')[0];
          // Intentar parsear diferentes formatos
          if (fechaSinHora.match(/^\d{4}-\d{2}-\d{2}/)) {
            fechaItem = fechaSinHora;
          } else {
            // Si está en formato DD/MM/YY o DD/MM/YYYY, convertir
            const match = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
            if (match) {
              const [, dia, mes, anio] = match;
              const anioCompleto = anio.length === 2 ? `20${anio}` : anio;
              fechaItem = `${anioCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            } else {
              // Intentar parsear como fecha estándar
              const fechaParsed = new Date(fechaStr);
              if (!isNaN(fechaParsed.getTime())) {
                fechaItem = fechaParsed.toISOString().split('T')[0];
              }
            }
          }
        }
        // Comparar solo la parte de fecha (sin hora)
        matchesFecha = fechaItem === filterFecha || fechaItem.startsWith(filterFecha);
      } else {
        // Si hay filtro de fecha pero el item no tiene fecha, no coincide
        matchesFecha = false;
      }
    }
    
    // Filtro por región
    let matchesRegion = true;
    if (filterRegion) {
      const hub = item['Hub'] || item['HUB'] || item.Hub || '';
      const plaza = item['Plaza'] || item['PLAZA'] || item.Plaza || '';
      const region = getRegionFromHubPlaza(hub, plaza);
      matchesRegion = region === filterRegion;
    }
    
    return matchesSearch && matchesEstado && matchesFecha && matchesRegion;
  });
  
  // Paginación: calcular índices
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);
  
  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterEstado, filterFecha, filterRegion, itemsPerPage]);
  
  // Si el filtro es "Completa" o "Instalada", mostrar datos de allData filtrados
  const filteredDataWithCompletas = filterEstado && 
    (filterEstado.toUpperCase() === 'COMPLETA' || filterEstado.toUpperCase() === 'INSTALADA')
    ? allData.filter(item => {
        // Estado: Columna BI "Estado" - considerar "Instalada" como "Completa"
        let estado = (item['Estado'] || item.estado || '').toUpperCase().trim();
        const estadoFiltro = filterEstado.toUpperCase().trim();
        // Si el filtro es "Completa", también incluir "Instalada"
        const matchesEstado = estado === estadoFiltro || 
          (estadoFiltro === 'COMPLETA' && estado === 'INSTALADA') ||
          (estadoFiltro === 'INSTALADA' && estado === 'COMPLETA');
        const matchesSearch = !searchTerm || 
          (item['Compañia'] || item['Compañía'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.cuenta || item['Cuenta de facturación'] || '').toString().includes(searchTerm) ||
          (item['Nº de orden'] || item['No. VTS'] || '').toString().includes(searchTerm) ||
          (item['Teléfonos'] || '').toString().includes(searchTerm) ||
          (item['Clave Vendedor'] || '').toString().includes(searchTerm);
        return matchesEstado && matchesSearch;
      })
    : filteredData;

  // Obtener estados únicos de TODOS los datos (incluyendo allData para tener Completa e Instalada)
  const estadosUnicos = [...new Set(
    allData
      .map(item => item.Estado || item.estado)
      .filter(estado => estado)
  )].sort();

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner message="Cargando operación del día..." />
      </div>
    );
  }

  // Calcular estadísticas por región
  const statsByRegion = {};
  const regiones = ['SURESTE', 'NORESTE', 'METROPOLITANA', 'PACIFICO', 'OCCIDENTE'];
  
  // Inicializar stats para cada región
  regiones.forEach(region => {
    statsByRegion[region] = {
      completas: 0,
      instaladas: 0,
      total: 0,
      byPlaza: {}
    };
  });
  
  // Calcular estadísticas por región y plaza
  console.log(`📊 OPERACION - Total de registros para estadísticas: ${allData.length}`);
  
  // PRIMERO: Verificar qué campos tienen los primeros registros
  if (allData.length > 0) {
    console.log('🔍 OPERACION - Primer registro (todas las keys):', Object.keys(allData[0]));
    console.log('🔍 OPERACION - Primer registro (valores):', allData[0]);
    // Buscar campos que contengan "hub" o "plaza"
    const hubKeys = Object.keys(allData[0]).filter(k => k.toLowerCase().includes('hub'));
    const plazaKeys = Object.keys(allData[0]).filter(k => k.toLowerCase().includes('plaza'));
    console.log('🔍 OPERACION - Campos con "hub":', hubKeys);
    console.log('🔍 OPERACION - Campos con "plaza":', plazaKeys);
    if (hubKeys.length > 0) {
      console.log('🔍 OPERACION - Valores de campos Hub:', hubKeys.map(k => `${k}: "${allData[0][k]}"`));
    }
    if (plazaKeys.length > 0) {
      console.log('🔍 OPERACION - Valores de campos Plaza:', plazaKeys.map(k => `${k}: "${allData[0][k]}"`));
    }
  }
  
  allData.forEach((item, index) => {
    const estado = (item['Estado'] || item.estado || '').toUpperCase().trim();
    // Extraer Hub y Plaza con todas las variantes posibles
    let hub = item['Hub'] || item['HUB'] || item.Hub || item.hub || item['hub'] || '';
    let plaza = item['Plaza'] || item['PLAZA'] || item.Plaza || item.plaza || item['plaza'] || '';
    
    // Si no hay Plaza, buscar en otros campos que puedan contener información de ubicación
    // PERO filtrar valores genéricos como "DEFAULT ORGANIZATION"
    if (!plaza) {
      const centro = item['Centro'] || item['Organización'] || item['Organizacion'] || '';
      const ciudad = item['Ciudad'] || item['Municipio'] || item['Localidad'] || '';
      
      // Filtrar valores genéricos o vacíos
      const centroValido = centro && 
        !centro.toUpperCase().includes('DEFAULT') && 
        !centro.toUpperCase().includes('ORGANIZATION') &&
        centro.trim() !== '';
      const ciudadValida = ciudad && ciudad.trim() !== '';
      
      plaza = centroValido ? centro : (ciudadValida ? ciudad : '');
    }
    
    // Si aún no hay plaza, usar el Hub como plaza (ya que puede contener información de ubicación)
    // PERO filtrar valores genéricos
    let plazaFinal = plaza || hub;
    if (plazaFinal && (
      plazaFinal.toUpperCase().includes('DEFAULT') || 
      plazaFinal.toUpperCase().includes('ORGANIZATION') ||
      plazaFinal.trim() === ''
    )) {
      plazaFinal = hub || ''; // Si plaza es genérica, usar solo hub
    }
    const region = getRegionFromHubPlaza(hub, plazaFinal);
    
    // Log para TODAS las plazas de METROPOLITANA para debugging
    const plazaUpper = plazaFinal ? plazaFinal.toUpperCase() : '';
    const hubUpper = hub ? hub.toUpperCase() : '';
    const metropolitanaKeywords = ['AB', 'VO', 'ST', 'PL', 'KI', 'TOL', 'ECA', 'CU', 'MEO', 'TZY', 'VA', 'TLA', 'TUL', 'TPR', 'PAC', 'AR', 'CE', 'CA', 'CM', 'IZ', 'RG', 'IX', 'IXT', 'SA', 'TL', 'CT', 'CV', 'YU',
      'ARBOLEDAS', 'VALLEJO', 'SATELITE', 'POLANCO', 'SANTA FE', 'TOLUCA', 'ECATEPEC', 'CUAUTITLAN', 'MELCHOR OCAMPO', 'TIZAYUCA',
      'VALLE', 'TULA', 'TULANCINGO', 'TEPEJI DEL RIO', 'PACHUCA', 'ARAGON', 'CENTRO', 'CENTRO DE ACOPIO', 'CHIMALHUACAN', 'IZTAPALAPA',
      'ROJO GOMEZ', 'IXTAPALUCA', 'SARATOGA', 'TLALPAN', 'CUAUTLA', 'CUERNAVACA', 'YAUTEPEC'];
    
    const isMetropolitana = metropolitanaKeywords.some(keyword => 
      plazaUpper.includes(keyword) || hubUpper.includes(keyword) || plazaUpper === keyword || hubUpper === keyword
    );
    
    if (isMetropolitana) {
      console.log(`🔍 METROPOLITANA DEBUG [${index}] - Plaza: "${plazaFinal}", Hub: "${hub}"`);
      console.log(`   - Plaza normalizada: "${normalizeText(plazaFinal)}", Hub normalizada: "${normalizeText(hub)}"`);
      console.log(`   - Región detectada: ${region}`);
      console.log(`   - Estado: ${estado}`);
      const relevantKeys = Object.keys(item).filter(k => {
        const kLower = k.toLowerCase();
        return kLower.includes('hub') || kLower.includes('plaza') || kLower.includes('centro') || 
               kLower.includes('organizacion') || kLower.includes('ciudad') || kLower.includes('municipio');
      });
      console.log(`   - Campos relevantes:`, relevantKeys.map(k => `${k}: "${item[k]}"`));
    }
    
    if (region && statsByRegion[region]) {
      statsByRegion[region].total++;
      
      if (estado === 'COMPLETA' || estado === 'INSTALADA') {
        statsByRegion[region].completas++;
        if (estado === 'INSTALADA') {
          statsByRegion[region].instaladas++;
        }
        
        // Contar por plaza (usar nombre completo de plaza para mostrar)
        const plazaKey = plazaFinal || hub || 'Sin plaza';
        const plazaDisplayName = getPlazaFullName(plazaKey);
        if (!statsByRegion[region].byPlaza[plazaDisplayName]) {
          statsByRegion[region].byPlaza[plazaDisplayName] = 0;
        }
        statsByRegion[region].byPlaza[plazaDisplayName]++;
      }
    } else if (!region) {
      // Si no se detectó región, asignar a METROPOLITANA (no "Sin región")
      const regionFinal = 'METROPOLITANA';
      if (statsByRegion[regionFinal]) {
        statsByRegion[regionFinal].total++;
        if (estado === 'COMPLETA' || estado === 'INSTALADA') {
          statsByRegion[regionFinal].completas++;
          if (estado === 'INSTALADA') {
            statsByRegion[regionFinal].instaladas++;
          }
          const plazaKey = plazaFinal || hub || 'Sin plaza';
          const plazaDisplayName = getPlazaFullName(plazaKey);
          if (!statsByRegion[regionFinal].byPlaza[plazaDisplayName]) {
            statsByRegion[regionFinal].byPlaza[plazaDisplayName] = 0;
          }
          statsByRegion[regionFinal].byPlaza[plazaDisplayName]++;
        }
      }
    }
  });
  
  // Log de resumen de estadísticas
  console.log('📊 OPERACION - Estadísticas por región:', statsByRegion);
  console.log('📊 OPERACION - Total SURESTE completas/instaladas:', statsByRegion['SURESTE']?.completas || 0);
  console.log('📊 OPERACION - Total SURESTE instaladas:', statsByRegion['SURESTE']?.instaladas || 0);
  console.log('📊 OPERACION - Total SURESTE (todas):', statsByRegion['SURESTE']?.total || 0);
  
  const totalInstaladasCompletas = allData.filter(item => {
    const estado = (item['Estado'] || item.estado || '').toUpperCase().trim();
    return estado === 'COMPLETA' || estado === 'INSTALADA';
  }).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-2xl font-bold">Operación del Día</h2>
            <p className="text-slate-600">
              {filteredData.length === 0 
                ? 'No hay órdenes en operación del día'
                : `Total de órdenes activas: ${filteredData.length}`
              }
            </p>
          </div>
          <button
            onClick={() => setShowStats(!showStats)}
            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-semibold"
          >
            {showStats ? 'Ocultar' : 'Mostrar'} Estadísticas
          </button>
        </div>
        
        {/* Desglose por estado (excluyendo Completas e Instaladas del listado principal) */}
        {(() => {
          // Contar estados de filteredData (excluyendo Completas/Instaladas)
          const estadoCounts = filteredData.reduce((acc, item) => {
            const estado = (item['Estado'] || item.estado || 'Abierta').toUpperCase().trim();
            if (estado !== 'COMPLETA' && estado !== 'INSTALADA') {
              acc[estado] = (acc[estado] || 0) + 1;
            }
            return acc;
          }, {});
          
          // Contar Completas/Instaladas de allData para mostrar en el header
          const completasInstaladas = allData.filter(item => {
            const estado = (item['Estado'] || item.estado || '').toUpperCase().trim();
            return estado === 'COMPLETA' || estado === 'INSTALADA';
          }).length;
          
          return (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {estadoCounts['ABIERTA'] > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-xs text-slate-600">Abiertas</div>
                    <div className="text-xl font-bold text-blue-700">{estadoCounts['ABIERTA']}</div>
                  </div>
                )}
                {estadoCounts['CANCELADA'] > 0 && (
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-xs text-slate-600">Canceladas</div>
                    <div className="text-xl font-bold text-red-700">{estadoCounts['CANCELADA']}</div>
                  </div>
                )}
                {estadoCounts['PENDIENTE'] > 0 && (
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <div className="text-xs text-slate-600">Pendientes</div>
                    <div className="text-xl font-bold text-yellow-700">{estadoCounts['PENDIENTE']}</div>
                  </div>
                )}
                {estadoCounts['NOT DONE'] > 0 && (
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="text-xs text-slate-600">Not Done</div>
                    <div className="text-xl font-bold text-orange-700">{estadoCounts['NOT DONE']}</div>
                  </div>
                )}
                {completasInstaladas > 0 && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-xs text-slate-600">Completas/Instaladas</div>
                    <div className="text-xl font-bold text-green-700">{completasInstaladas}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Estadísticas por Región */}
      {showStats && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-xl font-bold mb-4">Órdenes por Región</h3>
          {Object.keys(statsByRegion).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {regiones.map(region => {
                const stats = statsByRegion[region];
                if (!stats || stats.total === 0) return null;
                
                const totalCompletasInstaladas = stats.completas + stats.instaladas;
                if (totalCompletasInstaladas === 0) return null;
                
                return (
                  <div key={region} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <h4 className="font-bold text-slate-800 mb-3 text-lg">{region}</h4>
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between items-center bg-green-50 p-2 rounded">
                        <span className="text-xs text-slate-600 font-medium">Completas/Instaladas:</span>
                        <span className="text-lg font-bold text-green-700">{totalCompletasInstaladas}</span>
                      </div>
                      <div className="flex justify-between items-center bg-blue-50 p-2 rounded">
                        <span className="text-xs text-slate-600 font-medium">Total Órdenes:</span>
                        <span className="text-lg font-bold text-blue-700">{stats.total}</span>
                      </div>
                    </div>
                    
                    {/* Desglose por Plaza */}
                    {Object.keys(stats.byPlaza).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="text-sm font-bold text-slate-700 mb-2">Por Plaza:</div>
                        <div className="space-y-1">
                          {Object.entries(stats.byPlaza)
                            .sort((a, b) => b[1] - a[1])
                            .map(([plaza, count]) => {
                              const plazaFullName = getPlazaFullName(plaza);
                              return (
                                <div key={plaza} className="flex justify-between items-center text-sm bg-white p-2 rounded border-b border-slate-100">
                                  <span className="text-slate-600">{plazaFullName}</span>
                                  <span className="font-bold text-green-700">{count}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-500 text-center py-4">
              No hay datos para mostrar
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      {data.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente, orden, cuenta, teléfono..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 min-w-[200px]"
            >
              <option value="">Todos los estados</option>
              {estadosUnicos.map(estado => {
                // Contar cuántos registros hay con este estado
                const count = allData.filter(item => {
                  let itemEstado = (item['Estado'] || item.estado || '').toUpperCase().trim();
                  const estadoUpper = estado.toUpperCase().trim();
                  // Si el estado es "INSTALADA", tratarlo como "COMPLETA" para el conteo
                  if (itemEstado === 'INSTALADA') itemEstado = 'COMPLETA';
                  if (estadoUpper === 'INSTALADA') {
                    return itemEstado === 'COMPLETA' || itemEstado === 'INSTALADA';
                  }
                  return itemEstado === estadoUpper || 
                    (estadoUpper === 'COMPLETA' && (itemEstado === 'COMPLETA' || itemEstado === 'INSTALADA'));
                }).length;
                return (
                  <option key={estado} value={estado}>
                    {estado} ({count})
                  </option>
                );
              })}
            </select>
            
            {/* Filtro por fecha */}
            <input
              type="date"
              value={filterFecha}
              onChange={(e) => setFilterFecha(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Filtrar por fecha"
            />
            
            {/* Filtro por región */}
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">Todas las regiones</option>
              <option value="SURESTE">SURESTE</option>
              <option value="NORESTE">NORESTE</option>
              <option value="METROPOLITANA">METROPOLITANA</option>
              <option value="PACIFICO">PACIFICO</option>
              <option value="OCCIDENTE">OCCIDENTE</option>
            </select>
            
            {/* Selector de items por página */}
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={75}>75 por página</option>
              <option value={100}>100 por página</option>
            </select>
          </div>
        </div>
      )}

      {/* Tarjetas de órdenes */}
      {filteredData.length > 0 ? (
        <>
          <div className="mb-4 text-sm text-slate-600">
            Mostrando {startIndex + 1} - {Math.min(endIndex, filteredData.length)} de {filteredData.length} órdenes
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedData.map((item, index) => {
            // DEBUG: Log solo el primer item para ver qué campos tiene
            if (index === 0) {
              console.log('🔍 DEBUG - Primer item de operación:', item);
              console.log('🔍 DEBUG - Keys del item:', Object.keys(item));
              console.log('🔍 DEBUG - Estado (columna BI):', item['Estado']);
              console.log('🔍 DEBUG - Hub (columna AD):', item['Hub']);
              console.log('🔍 DEBUG - Plaza:', item['Plaza'] || item['PLAZA']);
            }
            
            // Obtener campos según las columnas ESPECÍFICAS especificadas:
            // Cliente: Columna BJ "Compañia"
            const cliente = item['Compañia'] || item['Compañía'] || item['Compania'] || item['Companía'] || 
                          item.Cliente || item['Cliente'] || item['Nombre'] || item.Nombre || 'Sin nombre';
            
            // Orden: Columna AL "No. VTS" y BA "Nº de orden"
            const ordenVTS = item['No. VTS'] || item['No VTS'] || item['No.VTS'] || item['NoVTS'] || '';
            const ordenNum = item['Nº de orden'] || item['N° de orden'] || item['Nº de orden'] || 
                           item['N° de orden'] || item['Orden'] || item['Nº Orden'] || '';
            const orden = ordenVTS || ordenNum || 'N/A';
            
            // Cuenta: Columna AT "Cuenta de facturación" Y BQ "Nº de cuenta"
            const cuentaFact = item['Cuenta de facturación'] || item['Cuenta de facturacion'] || 
                             item['Cuenta de Facturación'] || item['Cuenta de Facturacion'] || '';
            const cuentaNum = item['Nº de cuenta'] || item['N° de cuenta'] || item['Nº de Cuenta'] || 
                            item['N° de Cuenta'] || '';
            // Priorizar "Cuenta de facturación" (columna AT), luego "Nº de cuenta" (columna BQ) si es numérico
            const cuenta = (cuentaFact && !isNaN(cuentaFact)) ? cuentaFact : 
                         (cuentaNum && !isNaN(cuentaNum)) ? cuentaNum : 
                         item.cuenta || item['Cuenta'] || item.CUENTA || 'N/A';
            
            // Estado: Columna BI "Estado" - también considerar "Instalada" como "Completa"
            let estado = item['Estado'] || item.Estado || item.estado || item['Estatus'] || item.Estatus || 'Abierta';
            // Si el estado es "Instalada", mostrarlo como "Completa" en la tarjeta
            if (estado.toUpperCase() === 'INSTALADA') {
              estado = 'Completa';
            }
            
            // Teléfono: Columna AA "Teléfonos"
            const telefono = item['Teléfonos'] || item['Teléfono'] || item['Telefonos'] || item['Telefono'] || 
                           item.Teléfono || item.Telefono || item['Tel'] || item.Tel || '';
            
            // CVVEN: Columna AM "Clave Vendedor"
            const cvven = item['Clave Vendedor'] || item['Clave vendedor'] || item['Clave Vendedor'] || 
                         item['CVVEN'] || item.CVVEN || item['Cvven'] || 
                         item.VendedorAsignado || item['VendedorAsignado'] || item.Vendedor || item['Vendedor'] || 'N/A';
            
            // Fecha: Columna CF "Fecha solicitada" (sin hora)
            let fechaSolicitada = item['Fecha solicitada'] || item['Fecha Solicitada'] || item['FechaSolicitada'] || 
                                  item['Fecha solicitada'] || item['Fecha Solicitada'] || '';
            // Si la fecha tiene hora, quitarla y convertir a formato DD/MM/YY
            if (fechaSolicitada) {
              if (fechaSolicitada instanceof Date) {
                fechaSolicitada = fechaSolicitada.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
              } else {
                const fechaStr = String(fechaSolicitada);
                // Si tiene hora (formato con espacio o T), quitarla
                if (fechaStr.includes(' ') || fechaStr.includes('T')) {
                  const fechaSinHora = fechaStr.split(' ')[0].split('T')[0];
                  // Convertir de YYYY-MM-DD a DD/MM/YY si es necesario
                  if (fechaSinHora.match(/^\d{4}-\d{2}-\d{2}/)) {
                    const [anio, mes, dia] = fechaSinHora.split('-');
                    fechaSolicitada = `${dia}/${mes}/${anio.slice(-2)}`;
                  } else {
                    fechaSolicitada = fechaSinHora;
                  }
                }
              }
            }
            const fechaInstalacion = item['Fecha Instalacion'] || item['Fecha Instalación'] || item['FechaInstalacion'] || 
                                    item['Fecha instalacion'] || item['Fecha instalación'] || '';
            const fecha = fechaSolicitada || fechaInstalacion || item.Fecha || item['Fecha'] || item['Fecha de instalación'] || '';
            
            // Hub: Columna AD "Hub"
            const hub = item['Hub'] || item['HUB'] || item.Hub || item['hub'] || '';
            // Plaza puede venir en diferentes campos
            const plaza = item['Plaza'] || item['PLAZA'] || item.Plaza || item['plaza'] || '';
            const region = getRegionFromHubPlaza(hub, plaza) || 'METROPOLITANA';
            
            // DEBUG: Log para verificar región
            if (index === 0) {
              console.log('🔍 DEBUG - Hub encontrado:', hub);
              console.log('🔍 DEBUG - Plaza encontrada:', plaza);
              console.log('🔍 DEBUG - Región calculada:', region);
            }

            // Color del estado
            const getEstadoColor = (est) => {
              const estUpper = est.toUpperCase();
              if (estUpper === 'ABIERTA') return 'bg-blue-100 text-blue-700';
              if (estUpper === 'PENDIENTE') return 'bg-yellow-100 text-yellow-700';
              if (estUpper === 'CANCELADA') return 'bg-red-100 text-red-700';
              if (estUpper === 'COMPLETA' || estUpper === 'INSTALADA') return 'bg-green-100 text-green-700';
              if (estUpper === 'NOT DONE') return 'bg-orange-100 text-orange-700';
              return 'bg-slate-100 text-slate-700';
            };

            return (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
                {/* Header con nombre y estado */}
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-slate-800 text-sm uppercase flex-1 pr-2">{cliente}</h3>
                  <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${getEstadoColor(estado)}`}>
                    {estado}
                  </span>
                </div>

                {/* Información del cliente */}
                <div className="space-y-2 mb-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">Orden: {orden}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">Cuenta: {cuenta}</span>
                  </div>
                  {fecha && (
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-slate-400" />
                      <span>Fecha: {fecha}</span>
                    </div>
                  )}
                  {telefono && (
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-slate-400" />
                      <span>{telefono}</span>
                    </div>
                  )}
                  {cvven && cvven !== 'N/A' && (
                    <div className="flex items-center gap-2">
                      <User size={12} className="text-slate-400" />
                      <span>CVVEN: {cvven}</span>
                    </div>
                  )}
                  {/* Mostrar usuario que modificó por última vez */}
                  {(item.UsuarioModificadoPorNombre || item['UsuarioModificadoPorNombre']) && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 italic border-t border-slate-100 pt-2 mt-2">
                      <User size={10} className="text-slate-400" />
                      <span>Última modificación por: <strong className="text-slate-700">{item.UsuarioModificadoPorNombre || item['UsuarioModificadoPorNombre']}</strong></span>
                    </div>
                  )}
                  {hub && (
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-slate-400" />
                      <span>{hub}</span>
                    </div>
                  )}
                  {region && (
                    <div className="flex items-center gap-2">
                      <Building2 size={12} className="text-slate-400" />
                      <span className="font-semibold text-blue-600">{region}</span>
                    </div>
                  )}
                </div>

                {/* Campo de Notas */}
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Notas / Observaciones:
                  </label>
                  <textarea
                    value={notas[item.id] !== undefined ? notas[item.id] : (item.Nota || item.Notas || '')}
                    onChange={(e) => {
                      const nuevaNota = e.target.value;
                      setNotas(prev => ({ ...prev, [item.id]: nuevaNota }));
                      // Guardar automáticamente después de 1 segundo sin escribir (debounce)
                      if (window[`notaTimeout_${item.id}`]) {
                        clearTimeout(window[`notaTimeout_${item.id}`]);
                      }
                      window[`notaTimeout_${item.id}`] = setTimeout(() => {
                        handleSaveNota(item.id, nuevaNota);
                      }, 1000);
                    }}
                    placeholder="Ej: Cliente contesta, pide llamar más tarde, reprogramar cita, etc."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                    rows={3}
                  />
                  {savingNotas[item.id] && (
                    <p className="text-[10px] text-blue-600 mt-1">Guardando...</p>
                  )}
                </div>

                {/* Selector de Paquetes */}
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Paquete Contratado:
                  </label>
                  <select
                    value={item.Paquete || item.paquete || ''}
                    onChange={async (e) => {
                      const paqueteSeleccionado = e.target.value;
                      try {
                        await api.updateOperacion(item.id, { Paquete: paqueteSeleccionado, paquete: paqueteSeleccionado });
                        // Actualizar el item en allData y data
                        setAllData(prev => prev.map(i => 
                          i.id === item.id ? { ...i, Paquete: paqueteSeleccionado, paquete: paqueteSeleccionado } : i
                        ));
                        setData(prev => prev.map(i => 
                          i.id === item.id ? { ...i, Paquete: paqueteSeleccionado, paquete: paqueteSeleccionado } : i
                        ));
                      } catch (error) {
                        console.error('Error guardando paquete:', error);
                        alert('Error al guardar el paquete. Por favor intenta de nuevo.');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar paquete...</option>
                    <optgroup label="PLANES TRIPLES">
                      <option value="TI60M">IZZI 60 MEGAS + IZZI TV HD</option>
                      <option value="TI80M">IZZI 80 MEGAS + IZZI TV HD</option>
                      <option value="TI100M2">IZZI 100 MEGAS + IZZI TV HD</option>
                      <option value="TI150M">IZZI 150 MEGAS + IZZI TV HD</option>
                      <option value="TI200M2">IZZI 200 MEGAS + IZZI TV HD</option>
                      <option value="TI500M2">IZZI 500 MEGAS + IZZI TV HD</option>
                      <option value="TI1000M2">IZZI 1000 MEGAS + IZZI TV HD</option>
                      <option value="TIG30">IZZI NEGOCIOS 30 MEGAS + IZZI TV HD</option>
                      <option value="TIG40">IZZI NEGOCIOS 40 MEGAS + IZZI TV HD</option>
                      <option value="TIG50">IZZI NEGOCIOS 50 MEGAS + IZZI TV HD</option>
                      <option value="TIG60">IZZI NEGOCIOS 60 MEGAS + IZZI TV HD</option>
                      <option value="TIG80">IZZI NEGOCIOS 80 MEGAS + IZZI TV HD</option>
                      <option value="TIG100">IZZI NEGOCIOS 100 MEGAS + IZZI TV HD</option>
                      <option value="TIG125">IZZI NEGOCIOS 125 MEGAS + IZZI TV HD</option>
                      <option value="TIG150">IZZI NEGOCIOS 150 MEGAS + IZZI TV HD</option>
                      <option value="TIG200">IZZI NEGOCIOS 200 MEGAS + IZZI TV HD</option>
                      <option value="TIG500">IZZI NEGOCIOS 500 MEGAS + IZZI TV HD</option>
                    </optgroup>
                    <optgroup label="PLANES DOBLES">
                      <option value="DI60M">IZZI 60 MEGAS</option>
                      <option value="DI80M">IZZI 80 MEGAS</option>
                      <option value="DI100M">IZZI 100 MEGAS</option>
                      <option value="DI150M">IZZI 150 MEGAS</option>
                      <option value="DI200M">IZZI 200 MEGAS</option>
                      <option value="DI500M">IZZI 500 MEGAS</option>
                      <option value="DI1000M">IZZI 1000 MEGAS</option>
                      <option value="DIN40M">IZZI NEGOCIOS 40 MEGAS</option>
                      <option value="DIN60M">IZZI NEGOCIOS 60 MEGAS</option>
                      <option value="DIN80M">IZZI NEGOCIOS 80 MEGAS</option>
                      <option value="DIN100M">IZZI NEGOCIOS 100 MEGAS</option>
                      <option value="DIN150M">IZZI NEGOCIOS 150 MEGAS</option>
                      <option value="DIN200M">IZZI NEGOCIOS 200 MEGAS</option>
                      <option value="DIN500M">IZZI NEGOCIOS 500 MEGAS</option>
                      <option value="DIN1000M">IZZI NEGOCIOS 1000 MEGAS</option>
                    </optgroup>
                    <optgroup label="PLANES SINGLES">
                      <option value="SITVL">IZZI TV LIGHT</option>
                      <option value="SPTVM">PACK TV MINI</option>
                      <option value="SITVP">IZZI TV +</option>
                      <option value="SITVPB">IZZI TV + BÁSICO</option>
                      <option value="SITVPP">IZZI TV + PREMIUM</option>
                      <option value="SPTVP">PACK TV PLUS</option>
                      <option value="SIHD">IZZI TV HD</option>
                    </optgroup>
                  </select>
                </div>

                {/* Botones de acción */}
                <div className="space-y-2 mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openWhatsApp(telefono, item)}
                      disabled={!telefono}
                      className="bg-green-50 text-green-700 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-green-100 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MessageCircle size={16} />
                      WhatsApp
                    </button>
                    <a
                      href={`tel:${telefono}`}
                      className="bg-slate-50 text-slate-600 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      <Phone size={16} />
                      Llamar
                    </a>
                  </div>
                  
                  {/* Asignar Vendedor (para admin, admin_general, director y mesa_control) */}
                  {user && (user.role === 'admin' || user.role === 'admin_general' || user.role === 'director' || user.role === 'mesa_control') && (
                    <div>
                      {assigningVendor === item.id ? (
                        <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                          <div className="flex gap-2 mb-2">
                            <select
                              value={vendorInput}
                              onChange={(e) => setVendorInput(e.target.value)}
                              className="flex-1 px-2 py-1.5 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                              onFocus={(e) => {
                                if (!vendorInput && vendors.length > 0) {
                                  setVendorInput(vendors[0].name || vendors[0].username);
                                }
                              }}
                            >
                              <option value="">Seleccionar vendedor...</option>
                              {vendors.map(v => (
                                <option key={v.id} value={v.name || v.username}>
                                  {v.name || v.username}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={vendorInput}
                              onChange={(e) => setVendorInput(e.target.value)}
                              placeholder="O escribir manualmente"
                              className="flex-1 px-2 py-1.5 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAssignVendor(item.id, vendorInput)}
                              className="flex-1 bg-blue-600 text-white py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition-colors"
                            >
                              Asignar
                            </button>
                            <button
                              onClick={() => {
                                setAssigningVendor(null);
                                setVendorInput('');
                              }}
                              className="bg-slate-200 text-slate-700 py-1.5 px-3 rounded text-xs font-bold hover:bg-slate-300 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAssigningVendor(item.id);
                            setVendorInput(cvven !== 'N/A' ? cvven : '');
                          }}
                          className="w-full bg-blue-50 text-blue-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <UserPlus size={14} />
                          {cvven !== 'N/A' ? `Vendedor: ${cvven}` : 'Asignar Vendedor'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
          
          {/* Controles de paginación */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <span className="px-4 py-2 text-slate-700">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <p className="text-slate-500">
            {searchTerm || filterEstado || filterFecha || filterRegion
              ? 'No se encontraron órdenes con los filtros aplicados'
              : 'No hay órdenes en operación del día (excluyendo Completas e Instaladas)'
            }
          </p>
        </div>
      )}
    </div>
  );
}

