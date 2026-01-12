import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { MODULES } from '../../utils/constants.js';
import { BarChart3, Users, CheckCircle, MapPin } from 'lucide-react';
import * as api from '../../api.js';
import { filterByVendor, matchVendorName } from '../../utils/vendorFilter.js';

// Función para normalizar texto sin acentos (para comparación flexible)
const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos
    .toUpperCase()
    .trim();
};

// Función para identificar región desde HUB/PLAZA (copiada de SalesStatusView)
const getRegionFromHubPlaza = (hub, plaza) => {
  if (!hub && !plaza) return null;
  
  // Normalizar primero (sin acentos, mayúsculas)
  const hubStr = hub ? normalizeText(hub) : '';
  const plazaStr = plaza ? normalizeText(plaza) : '';
  
  // PRIORIDAD ABSOLUTA #0: Plazas que NO deben ser SURESTE (verificar ANTES de todo)
  // Estas plazas deben ser capturadas por otras regiones primero
  const textoBusqueda = plazaStr || hubStr;
  if (textoBusqueda) {
    // METROPOLITANA - Verificar primero estas plazas específicas
    const plazasMetropolitana = ['MELCHOR OCAMPO', 'MEO', 'PACHUCA', 'PAC', 'TIZAYUCA', 'TZY',
      'CENTRO DE ACOPIO', 'CA', 'ARAGON', 'ARAGÓN', 'AR', 'TLALPAN', 'TL',
      'ARBOLEDAS', 'AB', 'EMEX', 'MEC'];
    for (const p of plazasMetropolitana) {
      const pNormalized = normalizeText(p);
      if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
        return 'METROPOLITANA';
      }
    }
    
    // OCCIDENTE - Verificar estas plazas
    const plazasOccidente = ['ACAPULCO', 'AC'];
    for (const p of plazasOccidente) {
      const pNormalized = normalizeText(p);
      if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
        return 'OCCIDENTE';
      }
    }
    
    // PACIFICO - Verificar estas plazas
    const plazasPacifico = ['CHIHUAHUA', 'CH', 'ENSENADA', 'EN'];
    for (const p of plazasPacifico) {
      const pNormalized = normalizeText(p);
      if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
        return 'PACIFICO';
      }
    }
    
    // NORESTE - Verificar estas plazas
    const plazasNoreste = ['VICTORIA', 'CIV'];
    for (const p of plazasNoreste) {
      const pNormalized = normalizeText(p);
      if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
        return 'NORESTE';
      }
    }
  }
  
  // Log inicial para debugging de plazas problemáticas
  if (plaza && (plaza.toUpperCase().includes('MERIDA') || plaza.toUpperCase().includes('ORIZABA') || 
      plaza.toUpperCase().includes('TEHUACAN') || plaza.toUpperCase().includes('CARDENAS') ||
      plaza.toUpperCase().includes('COATZINTLA') || plaza.toUpperCase().includes('TIZIMIN') ||
      plaza.toUpperCase().includes('TAPACHULA') || plaza.toUpperCase().includes('YUCATAN'))) {
    console.log(`🔍 Dashboard getRegionFromHubPlaza INICIO - Plaza original: "${plaza}" (normalizada: "${plazaStr}"), Hub original: "${hub}" (normalizada: "${hubStr}")`);
  }
  
  // PRIORIDAD ABSOLUTA #1: Plazas específicas que DEBEN ser SURESTE (verificar ANTES de todo)
  // CRÍTICO: Verificar tanto en Plaza como en Hub (ya que los datos pueden venir solo con Hub)
  // NOTA: textoBusqueda ya fue definido arriba en PRIORIDAD #0
  if (textoBusqueda) {
    // Lista completa de variantes de plazas forzadas (con y sin acentos)
    // Incluir también códigos cortos: ME (Mérida), ORI (Orizaba), TEH (Tehuacán), etc.
    const plazasForzadasSureste = [
      'MERIDA', 'MÉRIDA', 'ME', // Mérida
      'ORIZABA', 'ORI', // Orizaba
      'TEHUACAN', 'TEHUACÁN', 'TEH', // Tehuacán
      'CARDENAS', 'CÁRDENAS', 'CAR', // Cárdenas
      'COATZINTLA', 'CI', // Coatzintla
      'TIZIMIN', 'TIZIMÍN', 'TZ', // Tizimín
      'TAPACHULA', 'TAP', // Tapachula
      'YUC', 'YUCATAN', 'YUCATÁN', // Yucatán
      // NOTA: CDC está en NORESTE según datos nuevos, NO en SURESTE
    ];
    
    for (const p of plazasForzadasSureste) {
      const pNormalized = normalizeText(p);
      // Comparación exacta
      if (textoBusqueda === pNormalized) {
        console.log(`✅ Dashboard PLAZA FORZADA SURESTE (exacta): "${plaza || hub}" → SURESTE`);
        return 'SURESTE';
      }
      // Comparación parcial
      if (textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
        console.log(`✅ Dashboard PLAZA FORZADA SURESTE (parcial): "${plaza || hub}" → SURESTE`);
        return 'SURESTE';
      }
      // Comparación por palabras
      const palabrasTexto = textoBusqueda.split(/\s+/);
      const palabrasForzada = pNormalized.split(/\s+/);
      for (const palabra of palabrasForzada) {
        if (palabrasTexto.some(p => p === palabra || p.includes(palabra) || palabra.includes(p))) {
          console.log(`✅ Dashboard PLAZA FORZADA SURESTE (por palabra): "${plaza || hub}" → SURESTE`);
          return 'SURESTE';
        }
      }
    }
    
    // PRIORIDAD ABSOLUTA #0: Plazas que NO deben ser SURESTE (verificar DESPUÉS de plazas forzadas)
    // Estas plazas deben ser capturadas por otras regiones, pero SOLO si no son plazas forzadas de SURESTE
    if (textoBusqueda) {
      // METROPOLITANA - Verificar estas plazas específicas
      const plazasMetropolitana = ['MELCHOR OCAMPO', 'MEO', 'PACHUCA', 'PAC', 'TIZAYUCA', 'TZY',
        'CENTRO DE ACOPIO', 'CA', 'ARAGON', 'ARAGÓN', 'AR', 'TLALPAN', 'TL',
        'ARBOLEDAS', 'AB', 'EMEX', 'MEC'];
      for (const p of plazasMetropolitana) {
        const pNormalized = normalizeText(p);
        if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
          return 'METROPOLITANA';
        }
      }
      
      // OCCIDENTE - Verificar estas plazas
      const plazasOccidente = ['ACAPULCO', 'AC'];
      for (const p of plazasOccidente) {
        const pNormalized = normalizeText(p);
        if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
          return 'OCCIDENTE';
        }
      }
      
      // PACIFICO - Verificar estas plazas
      const plazasPacifico = ['CHIHUAHUA', 'CH', 'ENSENADA', 'EN'];
      for (const p of plazasPacifico) {
        const pNormalized = normalizeText(p);
        if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
          return 'PACIFICO';
        }
      }
      
      // NORESTE - Verificar estas plazas
      const plazasNoreste = ['VICTORIA', 'CIV'];
      for (const p of plazasNoreste) {
        const pNormalized = normalizeText(p);
        if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
          return 'NORESTE';
        }
      }
    }
    
    // PRIORIDAD ABSOLUTA #0: Plazas que NO deben ser SURESTE (verificar DESPUÉS de plazas forzadas)
    // Estas plazas deben ser capturadas por otras regiones, pero SOLO si no son plazas forzadas de SURESTE
    if (textoBusqueda) {
      // METROPOLITANA - Verificar estas plazas específicas
      const plazasMetropolitana = ['MELCHOR OCAMPO', 'MEO', 'PACHUCA', 'PAC', 'TIZAYUCA', 'TZY',
        'CENTRO DE ACOPIO', 'CA', 'ARAGON', 'ARAGÓN', 'AR', 'TLALPAN', 'TL',
        'ARBOLEDAS', 'AB', 'EMEX', 'MEC'];
      for (const p of plazasMetropolitana) {
        const pNormalized = normalizeText(p);
        if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
          return 'METROPOLITANA';
        }
      }
      
      // OCCIDENTE - Verificar estas plazas
      const plazasOccidente = ['ACAPULCO', 'AC'];
      for (const p of plazasOccidente) {
        const pNormalized = normalizeText(p);
        if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
          return 'OCCIDENTE';
        }
      }
      
      // PACIFICO - Verificar estas plazas
      const plazasPacifico = ['CHIHUAHUA', 'CH', 'ENSENADA', 'EN'];
      for (const p of plazasPacifico) {
        const pNormalized = normalizeText(p);
        if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
          return 'PACIFICO';
        }
      }
      
      // NORESTE - Verificar estas plazas
      const plazasNoreste = ['VICTORIA', 'CIV'];
      for (const p of plazasNoreste) {
        const pNormalized = normalizeText(p);
        if (textoBusqueda === pNormalized || textoBusqueda.includes(pNormalized) || pNormalized.includes(textoBusqueda)) {
          return 'NORESTE';
        }
      }
    }
  }
  
  // Lista de HUBs y PLAZAs de cada región (simplificada, usar la misma lógica que SalesStatusView)
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
    'ARBOLEDAS', 'VALLEJO', 'SATELITE', 'SATÉLITE', 'POLANCO', 'SANTA FE',
    'TOLUCA', 'ECATEPEC', 'CUAUTITLAN', 'CUAUTITLÁN', 'MELCHOR OCAMPO', 'TIZAYUCA',
    'VALLE', 'TULA', 'TULANCINGO', 'TEPEJI DEL RIO', 'TEPEJI DEL RÍO', 'PACHUCA',
    'ARAGON', 'ARAGÓN', 'CENTRO', 'CENTRO DE ACOPIO', 'CHIMALHUACAN', 'CHIMALHUACÁN', 'IZTAPALAPA',
    'ROJO GOMEZ', 'ROJO GÓMEZ', 'IXTAPALUCA', 'IXT', 'SARATOGA', 'TLALPAN', 'CUAUTLA',
    'CUERNAVACA', 'YAUTEPEC'
  ];
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
  // Códigos cortos de NORESTE - EXACTOS según el usuario (CDC, CJ, PA están en NORESTE)
  const noresteCodes = [
    'CEL', 'IRA', 'LIN', 'MTE', 'MTM', 'PAS', 'MTH', 'APO', 'CAD', 'CDC', 'CJ', 'CMY', 'CUM',
    'ESC', 'GAR', 'GPA', 'HUI', 'JUA', 'LNC', 'LVD', 'SCA', 'SNI', 'VFU', 'NUL', 'QRO',
    'BAL', 'RBR', 'REY', 'SLA', 'PA', 'REP', 'SAS', 'SLP', 'ALT', 'TAM', 'VL', 'CIV'
  ];
  
  // Códigos cortos de METROPOLITANA
  // NOTA: Códigos desconocidos que no estén en ninguna otra región se asignan a METROPOLITANA por defecto
  // Códigos cortos de METROPOLITANA - EXACTOS según el usuario
  // NOTA: CA = Centro de Acopio, MEO = Melchor Ocampo, TZY = Tizayuca, PAC = Pachuca, AR = Aragón, TL = Tlalpan
  const metropolitanaCodes = ['AB', 'VO', 'ST', 'PL', 'KI', 'TOL', 'ECA', 'CU', 'MEO', 'TZY', 'VA', 'TLA', 'TUL', 'TPR', 'PAC', 'AR', 'CE', 'CA', 'CM', 'IZ', 'RG', 'IX', 'SA', 'TL', 'CT', 'CV', 'YU', 'MEC'];
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
  // Códigos cortos de OCCIDENTE - EXACTOS según el usuario
  const occidenteCodes = ['GDL', 'TJL', 'TLQ', 'TNL', 'ZN', 'ZS', 'MLLO', 'OX', 'CG', 'AC', 'AGS', 'PUV', 'IG'];
  
  // Códigos cortos de Hub/Plaza para Sureste - EXACTOS según el usuario
  // NOTA: CDC está en NORESTE según datos nuevos, NO en SURESTE
  const suresteCodes = [
    'PZ', 'TH', 'CI', 'TXP', 'VHE', 'ORI', 'COR', 'CQ', 'JL', 'MN', 'CC', 'NN', 'CHO', 'TLX', 'TEH', 'LET', 'SNT', 'ALV', 'API', 'HMA', 'ATX', 'TEZ', 'PC', 'CN', 'MHU', 'CZ', 'IM', 'TU', 'BT', 'CX', 'ES', 'IL', 'ME', 'ML', 'TZ', 'VD', 'PR', 'TX', 'TM', 'UM', 'CP', 'TAP', 'CB', 'VHA', 'JLP', 'HUM', 'MAC', 'NAC', 'CUN', 'CAR', 'CMA', 'PAR', 'CL', 'YUC'
  ];
  
  const pacificoHubs = ['HUB NOGALES', 'HUB JUAREZ', 'HUB CHIHUAHUA', 'HUB DURANGO', 'HUB SAN LUIS RIO COLORADO', 'HUB TIJUANA', 'HUB ENSENADA', 'HUB MAZATLAN', 'HUB CUAUHTEMOC CHIH', 'HUB TEPIC', 'HUB MEXICALI', 'HUB PARRAL', 'HUB GUADALUPE', 'HUB LA PAZ', 'HUB TECATE', 'HUB ZACATECAS'];
  const pacificoPlazas = ['NOGALES', 'CD. JUAREZ', 'CD JUAREZ', 'CIUDAD JUAREZ', 'DELICIAS', 'DURANGO', 'SAN LUIS RIO COLORADO', 'SAN LUIS RÍO COLORADO', 'TIJUANA', 'ENSENADA', 'MAZATLAN', 'MAZATLÁN', 'CUAUHTEMOC CHIH', 'CUAUHTÉMOC CHIH', 'CUAUHTEMOC', 'CUAUHTÉMOC', 'TEPIC', 'MEXICALI', 'CAMARGO CHIH', 'CAMARGO', 'SAUCILLO', 'CHIHUAHUA', 'ROSARITO', 'PARRAL', 'PARRÁL', 'ZAC GUADALUPE', 'ZACATECAS', 'LA PAZ', 'CASAS GRANDES', 'TECATE', 'MEOQUI', 'MEÓQUI'];
  
  // Códigos cortos de PACIFICO
  const pacificoCodes = [
    'CH', // Chihuahua
    'CJ', // Ciudad Juárez
    'CO', // Cuauhtémoc
    'CR', // Camargo
    'DGO', // Durango
    'DL', // Delicias
    'EN', // Ensenada
    'MX', // Mexicali
    'MZN', // Mazatlán
    'MO', // Meoqui
    'PA', // Parral (NOTA: conflicto con NORESTE Saltillo - prioridad a PACIFICO)
    'NOG', // Nogales
    'RS', // Rosarito
    'SLR', // San Luis Río Colorado
    'TJ', // Tijuana
    'TE', // Tecate
    'TPC', // Tepic
    'ZAC' // Zacatecas
  ];
  // HUBs de SURESTE - Lista completa
  const suresteHubs = [
    'HUB COATZACOALCOS', 'HUB MERIDA', 'HUB MÉRIDA', 'HUB VERACRUZ', 'HUB POZA RICA', 'HUB PUEBLA', 
    'HUB ATLIXCO', 'HUB TLAXCALA', 'HUB CAMPECHE', 'HUB UMAN', 'HUB UMÁN', 'HUB CENTRO', 
    'HUB CARDENAS', 'HUB CÁRDENAS', 'HUB COMALCALCO', 'HUB PLAYA DEL CARMEN', 'HUB CANCUN', 'HUB CANCÚN',
    'HUB VALLADOLID', 'HUB IZAMAL', 'HUB CARMEN', 'HUB CD. DEL CARMEN', 'HUB TAPACHULA', 
    'HUB HUAMANTLA', 'HUB SAN PABLO DEL MONTE', 'HUB SAN MARTIN TEXMELUCAN', 'HUB SAN MARTÍN TEXMELUCAN',
    'HUB CALPULALPAN', 'HUB TEHUACAN', 'HUB TEHUACÁN', 'HUB CHETUMAL', 'HUB TEZIUTLAN', 
    'HUB JALACINGO', 'HUB YAHUQUEMEHCAN', 'HUB ORIZABA', 'HUB TIZIMIN', 'HUB TIZIMÍN',
    'HUB COATZINTLA', 'HUB TUXPAN', 'HUB VALLE HERMOSO', 'HUB CORDOBA', 'HUB CÓRDOBA',
    'HUB VILLAHERMOSA', 'HUB VILLA HERMOSA', 'HUB MACULTEPEC', 'HUB PARRILLA'
  ];
  
  // PLAZAS de SURESTE - Lista completa con todas las variantes (con y sin acentos)
  const surestePlazas = [
    // Sureste 1 - Con códigos y variantes
    'POZA RICA', 'PZ', 'TIHUATLAN', 'TIHUATLÁN', 'TH', 
    'COATZINTLA', 'CI', 'TUXPAN', 'TXP', 
    'VALLE HERMOSO', 'VHE', 
    'CD. MENDOZA', 'MENDOZA', 'RIO BLANCO', 'RÍO BLANCO', 'ORIZABA', 'ORI', 
    'CORDOBA', 'CÓRDOBA', 'COR', 
    'COSOLEACAQUE', 'CQ', 
    'JALTIPAN', 'JÁLTIPAN', 'JL', 
    'MINATITLAN', 'MINATITLÁN', 'MN', 
    'COATZACOALCOS', 'CC', 
    'NANCHITAL', 'NN',
    'CHOLULA', 'CHO', 
    'SAN MARTIN TEXMELUCAN', 'SAN MARTÍN TEXMELUCAN', 'TEXMELUCAN', 'TLX', 
    'TLAXCALA', 
    'TEOLOCHOLCO', 
    'TEHUACAN', 'TEHUACÁN', 'TEH', 
    'LERDO DE TEJADA', 'LET', 
    'SANTIAGO TUXTLA', 'SNT', 
    'ALVARADO', 'ALV', 
    'APIZACO', 'API', 
    'HUAMANTLA', 'HMA', 
    'ATLIXCO', 'ATX', 
    'TEZIUTLAN', 'TEZ',
    // Sureste 2 - Con códigos y variantes
    'PLAYA DEL CARMEN', 'PC', 
    'CANCUN', 'CANCÚN', 'CN', 
    'MAHAHUAL', 'MHU', 
    'COZUMEL', 'CZ',
    'ISLA MUJERES', 'IM', 
    'TULUM', 'TU', 
    'BUCTZOTZ', 'BT', 
    'CHEMAX', 'CX', 
    'ESPITA', 'ES',
    'IZAMAL', 'IL', 
    'MERIDA', 'MÉRIDA', 'ME', 
    'MOTUL', 'ML', 
    'TIZIMIN', 'TIZIMÍN', 'TZ', 
    'VALLADOLID', 'VD',
    'PUERTO PROGRESO', 'PROGRESO', 'PR', 
    'TEMAX', 'TX', 
    'TEMOZON', 'TEMOZÓN', 'TM', 
    'UMAN', 'UMÁN', 'UM',
    'CAMPECHE', 'CP', 
    'TAPACHULA', 'TAP', 
    'COBA', 'CB', 
    'CD. DEL CARMEN', 'CD DEL CARMEN', 'CDC',
    'MACULTEPEC', 
    'PARRILLA', 
    'VILLAHERMOSA', 'VILLA HERMOSA', 'VHA', 
    'JALPA', 'JLP',
    'HUIMANGUILO', 'HUIMANGUILLO', 'HUM', 
    'MACUSPANA', 'MAC', 
    'NACAJUCA', 'NAC', 
    'CUNDUACAN', 'CUN',
    'CARDENAS', 'CÁRDENAS', 'CAR', 
    'COMALCALCO', 'CMA', 
    'PARAISO', 'PARAÍSO', 'PAR', 
    'CHETUMAL', 'CL',
    'YUC', 'YUCATAN', 'YUCATÁN'
  ];
  
  // PRIORIDAD #1: Verificar códigos cortos EXACTOS primero (más estricto)
  // ORDEN CRÍTICO: METROPOLITANA → NORESTE → OCCIDENTE → PACIFICO → SURESTE (excepto plazas forzadas)
  
  // METROPOLITANA PRIMERO
  if (hubStr && metropolitanaCodes.includes(hubStr)) return 'METROPOLITANA';
  if (plazaStr && metropolitanaCodes.includes(plazaStr)) return 'METROPOLITANA';
  
  // NORESTE SEGUNDO (CDC, CJ, PA están aquí)
  if (hubStr && noresteCodes.includes(hubStr)) return 'NORESTE';
  if (plazaStr && noresteCodes.includes(plazaStr)) return 'NORESTE';
  
  // OCCIDENTE TERCERO
  if (hubStr && occidenteCodes.includes(hubStr)) return 'OCCIDENTE';
  if (plazaStr && occidenteCodes.includes(plazaStr)) return 'OCCIDENTE';
  
  // PACIFICO CUARTO
  if (hubStr && pacificoCodes.includes(hubStr)) return 'PACIFICO';
  if (plazaStr && pacificoCodes.includes(plazaStr)) return 'PACIFICO';
  
  // SURESTE QUINTO (solo plazas forzadas ya verificadas arriba)
  if (hubStr && suresteCodes.includes(hubStr)) return 'SURESTE';
  if (plazaStr && suresteCodes.includes(plazaStr)) return 'SURESTE';
  
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
    
    // Si NO es prohibida, verificar SURESTE primero (para plazas forzadas)
    if (!esProhibida) {
      if (suresteHubs.some(h => {
        const hubName = normalizeText(h.replace('HUB ', ''));
        return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
      })) return 'SURESTE';
    }
    
    // METROPOLITANA primero (después de SURESTE forzadas)
    if (metropolitanaHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'METROPOLITANA';
    
    // NORESTE segundo
    if (noresteHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'NORESTE';
    
    // OCCIDENTE tercero
    if (occidenteHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'OCCIDENTE';
    
    // PACIFICO cuarto
    if (pacificoHubs.some(h => {
      const hubName = normalizeText(h.replace('HUB ', ''));
      return hubStr === hubName || hubStr.includes(hubName) || hubName.includes(hubStr);
    })) return 'PACIFICO';
  }
  
  // PRIORIDAD #3: Verificar nombres completos de Plazas
  if (plazaStr) {
    // Lista de plazas prohibidas para SURESTE (verificar primero)
    const plazasProhibidasSureste = [
      'MELCHOR OCAMPO', 'MEO', 'PACHUCA', 'PAC', 'TIZAYUCA', 'TZY',
      'CENTRO DE ACOPIO', 'CA', 'ARAGON', 'ARAGÓN', 'AR', 'TLALPAN', 'TL',
      'ARBOLEDAS', 'AB', 'EMEX', 'MEC', 'ACAPULCO', 'AC', 'CHIHUAHUA', 'CH',
      'ENSENADA', 'EN', 'VICTORIA', 'CIV'
    ];
    
    const esProhibida = plazasProhibidasSureste.some(pp => {
      const ppNormalized = normalizeText(pp);
      return plazaStr === ppNormalized || plazaStr.includes(ppNormalized) || ppNormalized.includes(plazaStr);
    });
    
    // Si NO es prohibida, verificar SURESTE primero (para plazas forzadas)
    if (!esProhibida) {
      for (const p of surestePlazas) {
        const pNormalized = normalizeText(p);
        if (plazaStr === pNormalized || 
            plazaStr.includes(pNormalized) || 
            pNormalized.includes(plazaStr)) {
          return 'SURESTE';
        }
      }
    }
    
    // METROPOLITANA primero (después de SURESTE forzadas) - Comparación más estricta para evitar falsos positivos
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
    
    // NORESTE segundo
    if (norestePlazas.some(p => {
      const pNormalized = normalizeText(p);
      if (plazaStr === pNormalized) return true;
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'NORESTE';
    
    // OCCIDENTE tercero
    if (occidentePlazas.some(p => {
      const pNormalized = normalizeText(p);
      if (plazaStr === pNormalized) return true;
      if (plazaStr.includes(pNormalized) || pNormalized.includes(plazaStr)) return true;
      return false;
    })) return 'OCCIDENTE';
    
    // PACIFICO cuarto
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

export default function DashboardModule({ currentModule }) {
  const { user } = useAuth();
  const [salesCount, setSalesCount] = useState(0);
  const [installCount, setInstallCount] = useState(0);
  const [installActiveCount, setInstallActiveCount] = useState(0);
  const [installByRegion, setInstallByRegion] = useState({});
  const [operacionCount, setOperacionCount] = useState(0);
  const [operacionByEstado, setOperacionByEstado] = useState({});
  const [operacionCompletasCount, setOperacionCompletasCount] = useState(0);
  const [m1Count, setM1Count] = useState(0);
  const [m2Count, setM2Count] = useState(0);
  const [m3Count, setM3Count] = useState(0);
  const [m4Count, setM4Count] = useState(0);
  const [totalClientesAdeudo, setTotalClientesAdeudo] = useState(0);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false); // Prevenir múltiples cargas simultáneas

  // Solo carga conteos cuando el dashboard está activo (no carga datos completos)
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;
      
      // Prevenir múltiples cargas simultáneas
      if (loadingRef.current) {
        console.log('⏸️ Carga ya en progreso, omitiendo...');
        return;
      }
      
      loadingRef.current = true;
      setLoading(true);
      try {
        let salesCountResult, installCountResult, operacionCountResult, m1CountResult, m2CountResult, m3CountResult, m4CountResult;
        
        // Si el usuario es vendedor, filtrar por su nombre
        if (user.role === 'vendedor' || user.role === 'user') {
          // Cargar todos los datos y filtrar por vendedor usando la función helper
          const [salesData, installData, operacionData, m1Data, m2Data, m3Data, m4Data] = await Promise.all([
            api.getSalesMaster(),
            api.getInstallMaster(),
            api.getOperacionDia(),
            api.getM1Master(),
            api.getM2Master(),
            api.getM3Master(),
            api.getM4Master()
          ]);
          
          // Filtrar usando la función helper
          const filteredSales = filterByVendor(salesData, user);
          const filteredInstall = filterByVendor(installData, user);
          const filteredOperacion = filterByVendor(operacionData, user);
          const filteredM1 = filterByVendor(m1Data, user);
          const filteredM2 = filterByVendor(m2Data, user);
          const filteredM3 = filterByVendor(m3Data, user);
          const filteredM4 = filterByVendor(m4Data, user);
          
          salesCountResult = filteredSales.length;
          installCountResult = filteredInstall.length;
          operacionCountResult = filteredOperacion.length;
          
          // Contar solo M1 (no FPD CORRIENTE ni FPD PÉRDIDA) del vendedor
          m1CountResult = filteredM1.filter(item => {
            const estatusFPD = (item['Estatus FPD'] || item['EstatusFPD'] || '').toUpperCase().trim();
            return !estatusFPD.includes('PÉRDIDA') && 
                   !estatusFPD.includes('PERDIDA') && 
                   !estatusFPD.includes('PERDIDO') &&
                   !estatusFPD.includes('CORRIENTE');
          }).length;
          
          // Función helper para obtener estatus FPD (igual que en SalesStatusView)
          const getEstatusFPD = (item, campo) => {
            const estatusFPDRaw = item['Estatus FPD'] || item['EstatusFPD'] || '';
            if (estatusFPDRaw) {
              const estatusFPD = estatusFPDRaw.toUpperCase().trim();
              if (estatusFPD === 'FPD CORRIENTE') return 'FPD CORRIENTE';
              if (estatusFPD === campo) return campo;
              if (estatusFPD.includes('PÉRDIDA') || estatusFPD.includes('PERDIDA')) return 'FPD PÉRDIDA';
            }
            const campoValue = item[campo] || item[campo.toLowerCase()] || null;
            if (campoValue !== null && campoValue !== undefined && campoValue !== '') {
              const campoNum = typeof campoValue === 'number' ? campoValue : parseInt(String(campoValue).trim(), 10);
              if (!isNaN(campoNum)) {
                if (campoNum === 0) return 'FPD CORRIENTE';
                if (campoNum === 1) return campo;
              }
            }
            return campo;
          };
          
          // Contar solo M2 que DEBEN (campo M2 = 1) del vendedor
          m2CountResult = filteredM2.filter(item => {
            const estatusFPD = getEstatusFPD(item, 'M2');
            return estatusFPD === 'M2';
          }).length;
          
          // Contar solo M3 que DEBEN (campo M3 = 1) del vendedor
          m3CountResult = filteredM3.filter(item => {
            const estatusFPD = getEstatusFPD(item, 'M3');
            return estatusFPD === 'M3';
          }).length;
          
          // Contar solo M4 que DEBEN (campo M4 = 1) del vendedor
          m4CountResult = filteredM4.filter(item => {
            const estatusFPD = getEstatusFPD(item, 'M4');
            return estatusFPD === 'M4';
          }).length;
        } else {
          // Para admin, cargar todos los conteos
          // Para M1, contar solo los que tienen estatus M1 (no FPD CORRIENTE ni FPD PÉRDIDA)
          // Para M2, M3, M4: usar la misma lógica que la pestaña: cargar todos y filtrar en frontend
          const [salesCountResultTemp, installCountResultTemp, operacionCountResultTemp, m1CountResultTemp, m2Data, m3Data, m4Data] = await Promise.all([
            api.getSalesMasterCount(),
            api.getInstallMasterCount(),
            api.getOperacionDiaCount(),
            api.getM1MasterCount('M1'), // Pasar 'M1' para contar solo los que tienen estatus M1
            api.getM2Master(null),  // Cargar todos los datos de M2 para filtrar en frontend
            api.getM3Master(null),  // Cargar todos los datos de M3 para filtrar en frontend
            api.getM4Master(null)   // Cargar todos los datos de M4 para filtrar en frontend
          ]);
          
          salesCountResult = salesCountResultTemp;
          installCountResult = installCountResultTemp;
          operacionCountResult = operacionCountResultTemp;
          m1CountResult = m1CountResultTemp;
          
          // Función helper para obtener estatus FPD (igual que en SalesStatusView)
          const getEstatusFPD = (item, campo) => {
            const estatusFPDRaw = item['Estatus FPD'] || item['EstatusFPD'] || '';
            if (estatusFPDRaw) {
              const estatusFPD = estatusFPDRaw.toUpperCase().trim();
              if (estatusFPD === 'FPD CORRIENTE') return 'FPD CORRIENTE';
              if (estatusFPD === campo) return campo;
              if (estatusFPD.includes('PÉRDIDA') || estatusFPD.includes('PERDIDA')) return 'FPD PÉRDIDA';
            }
            const campoValue = item[campo] || item[campo.toLowerCase()] || null;
            if (campoValue !== null && campoValue !== undefined && campoValue !== '') {
              const campoNum = typeof campoValue === 'number' ? campoValue : parseInt(String(campoValue).trim(), 10);
              if (!isNaN(campoNum)) {
                if (campoNum === 0) return 'FPD CORRIENTE';
                if (campoNum === 1) return campo;
              }
            }
            return campo;
          };
          
          // Contar solo los que tienen estatus M2 (no FPD CORRIENTE ni FPD PÉRDIDA)
          m2CountResult = m2Data.filter(item => {
            const estatusFPD = getEstatusFPD(item, 'M2');
            return estatusFPD === 'M2';
          }).length;
          
          // Contar solo los que tienen estatus M3 (no FPD CORRIENTE ni FPD PÉRDIDA)
          m3CountResult = m3Data.filter(item => {
            const estatusFPD = getEstatusFPD(item, 'M3');
            return estatusFPD === 'M3';
          }).length;
          
          // Contar solo los que tienen estatus M4 (no FPD CORRIENTE ni FPD PÉRDIDA)
          m4CountResult = m4Data.filter(item => {
            const estatusFPD = getEstatusFPD(item, 'M4');
            return estatusFPD === 'M4';
          }).length;
        }
        
        setSalesCount(salesCountResult || 0);
        setInstallCount(installCountResult || 0);
        setOperacionCount(operacionCountResult || 0);
        setM1Count(m1CountResult || 0);
        setM2Count(m2CountResult || 0);
        setM3Count(m3CountResult || 0);
        setM4Count(m4CountResult || 0);
        
        // Calcular total de clientes con adeudo (M1 + M2 + M3 + M4)
        const totalAdeudo = (m1CountResult || 0) + (m2CountResult || 0) + (m3CountResult || 0) + (m4CountResult || 0);
        setTotalClientesAdeudo(totalAdeudo);
        
        // Para operación: contar por estado (incluyendo todas: Abiertas, Canceladas, Completas)
        // SIEMPRE cargar datos de operación para el dashboard (no solo en módulos específicos)
        try {
          let operacionData = await api.getOperacionDia();
          if (user.role === 'vendedor' || user.role === 'user') {
            operacionData = filterByVendor(operacionData, user);
          }
          
          console.log('📊 Dashboard - Total de operaciones cargadas:', operacionData.length);
          
          // Contar por estado (incluyendo todas)
          const estadoStats = {};
          let completasCount = 0;
          const completasInstaladas = [];
          
          operacionData.forEach(item => {
            // Buscar estado en múltiples campos posibles - usar la misma lógica que OperacionModule
            // Priorizar 'Estado' (columna BI) como en OperacionModule
            let estado = (item['Estado'] || item.Estado || item.estado || item['Estatus'] || item.Estatus || 'Abierta').toUpperCase().trim();
            
            // Considerar "Instalada" como "Completa" para el conteo
            if (estado === 'INSTALADA') {
              estado = 'COMPLETA';
            }
            
            // Normalizar variaciones comunes
            if (estado === 'ABIERTA' || estado === 'ABIERTO') estado = 'ABIERTA';
            if (estado === 'PENDIENTE' || estado === 'PENDIENTES') estado = 'PENDIENTE';
            if (estado === 'CANCELADA' || estado === 'CANCELADO' || estado === 'CANCELADAS') estado = 'CANCELADA';
            if (estado === 'COMPLETA' || estado === 'COMPLETO' || estado === 'COMPLETAS') estado = 'COMPLETA';
            if (estado === 'NOT DONE' || estado === 'NOTDONE' || estado === 'NOT DONE') estado = 'NOT DONE';
            
            estadoStats[estado] = (estadoStats[estado] || 0) + 1;
            
            // Contar completas por separado y guardar para estadísticas por región
            if (estado === 'COMPLETA') {
              completasCount++;
              completasInstaladas.push(item);
            }
          });
          
          console.log('📊 Dashboard - Estado stats después de normalizar:', estadoStats);
          console.log('📊 Dashboard - Completas count después de normalizar:', completasCount);
          console.log('📊 Dashboard - Total completasInstaladas array:', completasInstaladas.length);
          
          setOperacionByEstado(estadoStats);
          setOperacionCompletasCount(completasCount);
          
          // Agrupar completas/instaladas por región usando HUB/PLAZA
          console.log(`📊 Dashboard - Total completas/instaladas a procesar: ${completasInstaladas.length}`);
          
          // PRIMERO: Verificar qué campos tienen los primeros registros
          if (completasInstaladas.length > 0) {
            console.log('🔍 Dashboard - Primer registro (todas las keys):', Object.keys(completasInstaladas[0]));
            const hubKeys = Object.keys(completasInstaladas[0]).filter(k => k.toLowerCase().includes('hub'));
            const plazaKeys = Object.keys(completasInstaladas[0]).filter(k => k.toLowerCase().includes('plaza'));
            console.log('🔍 Dashboard - Campos con "hub":', hubKeys);
            console.log('🔍 Dashboard - Campos con "plaza":', plazaKeys);
            if (hubKeys.length > 0) {
              console.log('🔍 Dashboard - Valores de campos Hub:', hubKeys.map(k => `${k}: "${completasInstaladas[0][k]}"`));
            }
            if (plazaKeys.length > 0) {
              console.log('🔍 Dashboard - Valores de campos Plaza:', plazaKeys.map(k => `${k}: "${completasInstaladas[0][k]}"`));
            }
          }
          
          const regionStats = {};
          completasInstaladas.forEach((item, index) => {
            // Extraer Hub y Plaza con todas las variantes posibles
            // Si no hay campo "Plaza", buscar en otros campos como "Centro", "Organización", etc.
            const hub = item['Hub'] || item['HUB'] || item.Hub || item.hub || item['hub'] || item.HUB || '';
            let plaza = item['Plaza'] || item['PLAZA'] || item.Plaza || item.plaza || item['plaza'] || item.PLAZA || '';
            
            // Si no hay Plaza, buscar en otros campos que puedan contener información de ubicación
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
            const region = getRegionFromHubPlaza(hub, plazaFinal) || 'METROPOLITANA';
            
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
              console.log(`🔍 DASHBOARD METROPOLITANA DEBUG [${index}] - Plaza: "${plazaFinal}", Hub: "${hub}"`);
              console.log(`   - Plaza normalizada: "${normalizeText(plazaFinal)}", Hub normalizada: "${normalizeText(hub)}"`);
              console.log(`   - Región detectada: ${region}`);
              const relevantKeys = Object.keys(item).filter(k => {
                const kLower = k.toLowerCase();
                return kLower.includes('hub') || kLower.includes('plaza') || kLower.includes('centro') || 
                       kLower.includes('organizacion') || kLower.includes('ciudad') || kLower.includes('municipio');
              });
              console.log(`   - Campos relevantes:`, relevantKeys.map(k => `${k}: "${item[k]}"`));
            }
            
            if (!regionStats[region]) {
              regionStats[region] = 0;
            }
            regionStats[region]++;
          });
          
          console.log('📊 Dashboard - Region stats finales:', regionStats);
          console.log('📊 Dashboard - Total completas/instaladas procesadas:', completasInstaladas.length);
          setInstallByRegion(regionStats);
        } catch (operacionError) {
          console.error('❌ Error cargando datos de operación para dashboard:', operacionError);
          setOperacionByEstado({});
          setOperacionCompletasCount(0);
          setInstallByRegion({});
        }
      } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };

    loadDashboardData();
  }, [user, currentModule]);

  return (
    <div className="space-y-6">
      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cobranza */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <Users size={32} className="opacity-80" />
            <span className="text-blue-100 text-xs font-bold">COBRANZA</span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{loading ? '...' : totalClientesAdeudo}</h3>
          <p className="text-blue-100 text-sm">Clientes en Sistema con Adeudo para Seguimiento</p>
          <div className="mt-3 pt-3 border-t border-blue-400/30">
            <div className="text-xs text-blue-100 space-y-1">
              <p className="mb-2">Haz clic en M1, M2, M3 o M4 para ver detalles</p>
              <div className="bg-blue-400/20 rounded p-2 space-y-1">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-sm">M1</p>
                  <p className="text-lg font-bold">{loading ? '...' : m1Count}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="font-bold text-sm">M2</p>
                  <p className="text-lg font-bold">{loading ? '...' : m2Count}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="font-bold text-sm">M3</p>
                  <p className="text-lg font-bold">{loading ? '...' : m3Count}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="font-bold text-sm">M4</p>
                  <p className="text-lg font-bold">{loading ? '...' : m4Count}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instalaciones */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle size={32} className="opacity-80" />
            <span className="text-purple-100 text-xs font-bold">INSTALACIONES</span>
          </div>
          <h3 className="text-3xl font-bold mb-1">{loading ? '...' : operacionCompletasCount}</h3>
          <p className="text-purple-100 text-sm mb-3">Órdenes Completas/Instaladas</p>
          {Object.keys(installByRegion).length > 0 && (
            <div className="mt-3 pt-3 border-t border-purple-400/30">
              <div className="text-xs text-purple-100 space-y-1">
                {['SURESTE', 'NORESTE', 'METROPOLITANA', 'PACIFICO', 'OCCIDENTE'].map(region => {
                  const count = installByRegion[region] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={region} className="flex justify-between items-center">
                      <p className="font-bold text-sm">{region}</p>
                      <p className="text-lg font-bold">{count}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Operación */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <BarChart3 size={32} className="opacity-80" />
            <span className="text-indigo-100 text-xs font-bold">OPERACIÓN</span>
          </div>
          <h3 className="text-3xl font-bold mb-1">
            {loading ? '...' : ((operacionByEstado['ABIERTA'] || 0) + (operacionByEstado['PENDIENTE'] || 0))}
          </h3>
          <p className="text-indigo-100 text-sm mb-3">Órdenes Abiertas y Pendientes</p>
          <div className="mt-3 pt-3 border-t border-indigo-400/30">
            <div className="text-xs text-indigo-100 space-y-1">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm">Abiertas</p>
                <p className="text-lg font-bold">{loading ? '...' : (operacionByEstado['ABIERTA'] || 0)}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm">Pendientes</p>
                <p className="text-lg font-bold">{loading ? '...' : (operacionByEstado['PENDIENTE'] || 0)}</p>
              </div>
              {(operacionByEstado['CANCELADA'] || 0) > 0 && (
                <div className="flex justify-between items-center">
                  <p className="font-bold text-sm">Canceladas</p>
                  <p className="text-lg font-bold">{operacionByEstado['CANCELADA']}</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>


    </div>
  );
}

