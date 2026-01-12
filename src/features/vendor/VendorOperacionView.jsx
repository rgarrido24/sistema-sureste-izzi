import { useState, useEffect } from 'react';
import { Search, Phone, MessageCircle, Calendar, MapPin, Building2, User } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import { filterByVendor } from '../../utils/vendorFilter.js';

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
    console.warn('Número de teléfono muy corto:', cleaned);
    return null;
  }
  return cleaned;
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

// Función para obtener región desde Hub/Plaza (copiada de OperacionModule)
const getRegionFromHubPlaza = (hub, plaza) => {
  const hubStr = String(hub || '').toUpperCase().trim();
  const plazaStr = String(plaza || '').toUpperCase().trim();
  
  // Lista de HUBs y PLAZAs de cada región (simplificada)
  const metropolitanaHubs = ['HUB CUERNAVACA', 'HUB ATIZAPAN', 'HUB IXTAPALUCA', 'HUB PACHUCA', 'HUB ZUMPANGO', 'HUB XOCHIMILCO', 'HUB TECAMAC', 'HUB CHALCO', 'HUB NAUCALPAN', 'HUB IZTAPALAPA', 'HUB CUAUTLA', 'HUB CUAUTITLAN', 'HUB ECATEPEC', 'HUB AYALA', 'HUB TULTITLAN', 'HUB ALVARO OBREGON', 'HUB GUSTAVO A MADERO', 'HUB CHIMALHUACAN', 'HUB VENUSTIANO CARRANZA', 'HUB LA MAGDALENA CONTRERAS', 'HUB NEZAHUALCOYOTL', 'HUB TOLUCA', 'HUB TULANCINGO', 'HUB AXOCHIAPAN', 'HUB TEPOTZOTLAN', 'HUB TLAHUAC', 'HUB COYOACAN', 'HUB MIGUEL HIDALGO', 'HUB IZTACALCO', 'HUB TLALNEPANTLA', 'HUB AZCAPOTZALCO', 'HUB MILPA ALTA', 'HUB TLALPAN', 'HUB CUAUHTEMOC', 'HUB BENITO JUAREZ', 'HUB CUAJIMALPA', 'HUB ACOLMAN', 'HUB TULA', 'HUB HUIXQUILUCAN'];
  const metropolitanaPlazas = ['CUERNAVACA', 'ATIZAPAN', 'IXTAPALUCA LOS REYES', 'TIZAYUCA', 'ZUMPANGO', 'XOCHIMILCO', 'TECAMAC', 'CHALCO', 'NAUCALPAN', 'IZTAPALAPA', 'CUAUTLA', 'CUAUTITLAN', 'ECATEPEC', 'AYALA', 'TULTITLAN', 'ALVARO OBREGON CDMX', 'GUSTAVO A MADERO', 'CHIMALHUACAN', 'VENUSTIANO CARRANZA CDMX', 'LA MAGDALENA CONTRERAS', 'PACHUCA', 'NEZAHUALCOYOTL', 'TOLUCA'];
  const noresteHubs = ['HUB MONTERREY', 'HUB VICTORIA', 'HUB QUERETARO', 'HUB SAN LUIS POTOSI', 'HUB TAMPICO', 'HUB MATAMOROS', 'HUB LINARES', 'HUB NUEVO LAREDO', 'HUB SALTILLO', 'HUB VALLES', 'HUB GENERAL TERAN', 'HUB PANUCO', 'HUB IRAPUATO', 'HUB MONCLOVA', 'HUB MATEHUALA', 'HUB REYNOSA', 'HUB CELAYA', 'HUB MEXQUITIC'];
  const norestePlazas = ['JUAREZ NL', 'APODACA', 'EL CARMEN', 'MANTE', 'QUERETARO', 'SAN LUIS POTOSI', 'TAMPICO', 'PESQUERIA', 'MONTERREY', 'MATAMOROS', 'EL MARQUES', 'GUADALUPE NL', 'GENERAL ESCOBEDO', 'XICONTENCATL', 'LINARES', 'CADEREYTA', 'SALINAS VICTORIA', 'GARCIA', 'GENERAL ZUAZUA', 'IRAPUATO', 'SALAMANCA', 'SALTILLO', 'CIUDAD VALLES', 'GENERAL TERAN', 'PANUCO', 'CIENEGA DE FLORES', 'SANTA CATARINA', 'MONCLOVA', 'MONTEMORELOS', 'RIO BRAVO', 'VICTORIA', 'SAN PEDRO GARZA GARCIA', 'SAN NICOLAS DE LOS GARZA', 'CEDRAL', 'EBANO', 'PUEBLO VIEJO', 'ARTEAGA', 'MEXQUITIC'];
  const occidenteHubs = ['HUB PUERTO VALLARTA', 'HUB AGUASCALIENTES', 'HUB GUADALAJARA', 'HUB OAXACA', 'HUB ACAPULCO', 'HUB COYUCA', 'HUB LAGOS DE MORENO', 'HUB MANZANILLO', 'HUB BAHIA DE BANDERAS', 'HUB IGUALA', 'HUB CIHUATLAN'];
  const occidentePlazas = ['PUERTO VALLARTA', 'AGUASCALIENTES', 'GUADALAJARA', 'OAXACA', 'TLAJOMULCO', 'ZAPOPAN', 'ACAPULCO', 'TLAQUEPAQUE', 'EL SALTO', 'CHILPANCINGO', 'LAGOS', 'JUANACATLAN', 'TONALA JAL', 'TLATLIXTAC', 'ZUMPANGO DEL RIO', 'MANZANILLO', 'BAHIA DE BANDERAS', 'VILLA DE ZAACHILA', 'IGUALA', 'SAN FRANCISCO DE LOS ROMO', 'TELIXTLAHUACA', 'ZAPOTLANEJO', 'TALA', 'CIHUATLAN'];
  const pacificoHubs = ['HUB NOGALES', 'HUB JUAREZ', 'HUB CHIHUAHUA', 'HUB DURANGO', 'HUB SAN LUIS RIO COLORADO', 'HUB TIJUANA', 'HUB ENSENADA', 'HUB MAZATLAN', 'HUB CUAUHTEMOC CHIH', 'HUB TEPIC', 'HUB MEXICALI', 'HUB PARRAL', 'HUB GUADALUPE', 'HUB LA PAZ'];
  const pacificoPlazas = ['NOGALES', 'CD. JUAREZ', 'CD JUAREZ', 'DELICIAS', 'DURANGO', 'SAN LUIS RIO COLORADO', 'TIJUANA', 'ENSENADA', 'MAZATLAN', 'CUAUHTEMOC CHIH', 'TEPIC', 'MEXICALI', 'CAMARGO CHIH', 'SAUCILLO', 'CHIHUAHUA', 'ROSARITO', 'PARRAL', 'ZAC GUADALUPE', 'LA PAZ', 'CASAS GRANDES'];
  const suresteHubs = ['HUB COATZACOALCOS', 'HUB MERIDA', 'HUB VERACRUZ', 'HUB POZA RICA', 'HUB PUEBLA', 'HUB ATLIXCO', 'HUB TLAXCALA', 'HUB CAMPECHE', 'HUB UMAN', 'HUB CENTRO', 'HUB CARDENAS', 'HUB COMALCALCO', 'HUB PLAYA DEL CARMEN', 'HUB CANCUN', 'HUB VALLADOLID', 'HUB IZAMAL', 'HUB CARMEN', 'HUB TAPACHULA', 'HUB HUAMANTLA', 'HUB SAN PABLO DEL MONTE', 'HUB SAN MARTIN TEXMELUCAN', 'HUB CALPULALPAN', 'HUB TEHUACAN', 'HUB CHETUMAL', 'HUB TEZIUTLAN', 'HUB PUEBLA', 'HUB JALACINGO', 'HUB YAHUQUEMEHCAN'];
  const surestePlazas = [
    'POZA RICA', 'PZ', 'TIHUATLAN', 'TH', 'COATZINTLA', 'CI', 'TUXPAN', 'TXP', 'VALLE HERMOSO', 'VHE',
    'CD. MENDOZA', 'MENDOZA', 'RIO BLANCO', 'ORIZABA', 'ORI', 'CORDOBA', 'COR', 'COSOLEACAQUE', 'CQ',
    'JALTIPAN', 'JL', 'MINATITLAN', 'MN', 'COATZACOALCOS', 'CC', 'NANCHITAL', 'NN',
    'CHOLULA', 'CHO', 'SAN MARTIN TEXMELUCAN', 'TEXMELUCAN', 'TLX', 'TLAXCALA', 'TEOLOCHOLCO',
    'TEHUACAN', 'TEH', 'LERDO DE TEJADA', 'LET', 'SANTIAGO TUXTLA', 'SNT', 'ALVARADO', 'ALV',
    'APIZACO', 'API', 'HUAMANTLA', 'HMA', 'ATLIXCO', 'ATX', 'TEZIUTLAN', 'TEZ', 'PLAYA DEL CARMEN', 'PC', 'CANCUN', 'CN', 'MAHAHUAL', 'MHU', 'COZUMEL', 'CZ',
    'ISLA MUJERES', 'IM', 'TULUM', 'TU', 'BUCTZOTZ', 'BT', 'CHEMAX', 'CX', 'ESPITA', 'ES',
    'IZAMAL', 'IL', 'MERIDA', 'ME', 'MOTUL', 'ML', 'TIZIMIN', 'TZ', 'VALLADOLID', 'VD',
    'PUERTO PROGRESO', 'PROGRESO', 'PR', 'TEMAX', 'TX', 'TEMOZON', 'TM', 'UMAN', 'UM',
    'CAMPECHE', 'CP', 'TAPACHULA', 'TAP', 'COBA', 'CB', 'CD. DEL CARMEN', 'CD DEL CARMEN', 'CDC',
    'MACULTEPEC', 'PARRILLA', 'VILLAHERMOSA', 'VHA', 'OAXACA', 'OX', 'JALPA', 'JLP',
    'HUIMANGUILO', 'HUM', 'MACUSPANA', 'MAC', 'NACAJUCA', 'NAC', 'CUNDUACAN', 'CUN',
    'CARDENAS', 'CAR', 'COMALCALCO', 'CMA', 'PARAISO', 'PAR', 'CHETUMAL', 'CL'
  ];
  const suresteCodes = ['PZ', 'TH', 'CI', 'TXP', 'VHE', 'ORI', 'COR', 'CQ', 'JL', 'MN', 'CC', 'NN', 'CHO', 'TLX', 'TEH', 'LET', 'SNT', 'ALV', 'API', 'HMA', 'ATX', 'TEZ', 'PC', 'CN', 'MHU', 'CZ', 'IM', 'TU', 'BT', 'CX', 'ES', 'IL', 'ME', 'ML', 'TZ', 'VD', 'PR', 'TX', 'TM', 'UM', 'CP', 'TAP', 'CB', 'CDC', 'VHA', 'OX', 'JLP', 'HUM', 'MAC', 'NAC', 'CUN', 'CAR', 'CMA', 'PAR', 'CL'];
  
  // Verificar códigos cortos primero (para Sureste)
  if (hubStr && suresteCodes.includes(hubStr)) return 'SURESTE';
  if (plazaStr && suresteCodes.includes(plazaStr)) return 'SURESTE';
  
  // Verificar Hubs completos
  if (hubStr) {
    if (metropolitanaHubs.some(h => {
      const hubName = h.replace('HUB ', '').toUpperCase();
      return hubStr === h || hubStr.includes(hubName) || hubStr === hubName || hubName.includes(hubStr);
    })) return 'METROPOLITANA';
    
    if (noresteHubs.some(h => {
      const hubName = h.replace('HUB ', '').toUpperCase();
      return hubStr === h || hubStr.includes(hubName) || hubStr === hubName || hubName.includes(hubStr);
    })) return 'NORESTE';
    
    if (occidenteHubs.some(h => {
      const hubName = h.replace('HUB ', '').toUpperCase();
      return hubStr === h || hubStr.includes(hubName) || hubStr === hubName || hubName.includes(hubStr);
    })) return 'OCCIDENTE';
    
    if (pacificoHubs.some(h => {
      const hubName = h.replace('HUB ', '').toUpperCase();
      return hubStr === h || hubStr.includes(hubName) || hubStr === hubName || hubName.includes(hubStr);
    })) return 'PACIFICO';
    
    if (suresteHubs.some(h => {
      const hubName = h.replace('HUB ', '').toUpperCase();
      return hubStr === h || hubStr.includes(hubName) || hubStr === hubName || hubName.includes(hubStr);
    })) return 'SURESTE';
  }
  
  // Verificar Plazas
  if (plazaStr) {
    if (metropolitanaPlazas.some(p => {
      return plazaStr === p || plazaStr.includes(p) || p.includes(plazaStr);
    })) return 'METROPOLITANA';
    
    if (norestePlazas.some(p => {
      return plazaStr === p || plazaStr.includes(p) || p.includes(plazaStr);
    })) return 'NORESTE';
    
    if (occidentePlazas.some(p => {
      return plazaStr === p || plazaStr.includes(p) || p.includes(plazaStr);
    })) return 'OCCIDENTE';
    
    if (pacificoPlazas.some(p => {
      return plazaStr === p || plazaStr.includes(p) || p.includes(plazaStr);
    })) return 'PACIFICO';
    
    if (surestePlazas.some(p => {
      const pUpper = p.toUpperCase();
      return plazaStr === pUpper || plazaStr.includes(pUpper) || pUpper.includes(plazaStr);
    })) return 'SURESTE';
  }
  
  return null;
};

export default function VendorOperacionView({ myName }) {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!user || !myName) return;
      
      try {
        setLoading(true);
        console.log(`🔍 VendorOperacionView - Cargando operaciones para:`, myName);
        
        // Cargar operaciones asignadas al vendedor
        let allData = await api.getOperacionDia(myName);
        
        // Aplicar filtro adicional por seguridad
        const myData = filterByVendor(allData, user);
        console.log(`✅ Operaciones filtradas para ${myName}:`, myData.length);
        
        const dataWithIds = myData.map(d => ({ id: d._id || d.id, ...d }));
        setData(dataWithIds);
      } catch (error) {
        console.error('❌ Error cargando operaciones:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000); // Cada 30 segundos
    return () => clearInterval(interval);
  }, [myName, user]);

  // Filtrar por búsqueda y estado
  const filteredData = data.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (item['Compañia'] || item['Compañía'] || item.Cliente || item['Cliente'] || '').toLowerCase().includes(searchLower) ||
      (item.cuenta || item['Cuenta de facturación'] || item['Nº de cuenta'] || '').toString().includes(searchTerm) ||
      (item['Nº de orden'] || item['No. VTS'] || '').toString().includes(searchTerm) ||
      (item['Teléfonos'] || '').toString().includes(searchTerm);
    
    let matchesEstado = true;
    if (filterEstado) {
      const estadoItem = (item.estado || item.Estado || '').toUpperCase().trim();
      const estadoFiltro = filterEstado.toUpperCase().trim();
      matchesEstado = estadoItem === estadoFiltro;
    }
    
    return matchesSearch && matchesEstado;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner message="Cargando tus instalaciones..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold mb-2">Mis Instalaciones</h2>
        <p className="text-slate-600">
          {data.length === 0 
            ? 'No tienes instalaciones asignadas aún'
            : `Total de instalaciones: ${data.length}`
          }
        </p>
      </div>

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
                placeholder="Buscar cliente, orden, cuenta..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 min-w-[150px]"
            >
              <option value="">Todos los estados</option>
              <option value="Abierta">Abierta</option>
              <option value="Completa">Completa</option>
              <option value="Instalada">Instalada</option>
              <option value="Cancelada">Cancelada</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Not Done">Not Done</option>
            </select>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Mostrando {filteredData.length} de {data.length} instalaciones
            {filterEstado && ` • Filtrado: ${filterEstado}`}
          </p>
        </div>
      )}

      {/* Lista de Cards */}
      {filteredData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredData.map((item) => {
            const cliente = item['Compañia'] || item['Compañía'] || item.Cliente || item['Cliente'] || 'Sin nombre';
            const cuenta = item.cuenta || item['Cuenta de facturación'] || item['Nº de cuenta'] || '-';
            const orden = item['Nº de orden'] || item['No. VTS'] || '';
            const telefono = item['Teléfonos'] || item['Teléfono'] || '';
            const estado = item['Estado'] || item.estado || 'Abierta';
            const hub = item['Hub'] || item['HUB'] || '';
            const plaza = item['Plaza'] || item['PLAZA'] || '';
            const region = getRegionFromHubPlaza(hub, plaza) || 'Sin región';
            
            // Fecha sin hora
            let fechaSolicitada = item['Fecha solicitada'] || item['Fecha Solicitada'] || '';
            if (fechaSolicitada) {
              if (fechaSolicitada instanceof Date) {
                fechaSolicitada = fechaSolicitada.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
              } else {
                const fechaStr = String(fechaSolicitada);
                if (fechaStr.includes(' ') || fechaStr.includes('T')) {
                  const fechaSinHora = fechaStr.split(' ')[0].split('T')[0];
                  if (fechaSinHora.match(/^\d{4}-\d{2}-\d{2}/)) {
                    const [anio, mes, dia] = fechaSinHora.split('-');
                    fechaSolicitada = `${dia}/${mes}/${anio.slice(-2)}`;
                  } else {
                    fechaSolicitada = fechaSinHora;
                  }
                }
              }
            }
            
            const getEstadoColor = (est) => {
              const estUpper = est.toUpperCase();
              if (estUpper === 'ABIERTA') return 'bg-blue-100 text-blue-700';
              if (estUpper === 'COMPLETA' || estUpper === 'INSTALADA') return 'bg-green-100 text-green-700';
              if (estUpper === 'CANCELADA') return 'bg-red-100 text-red-700';
              if (estUpper === 'PENDIENTE') return 'bg-yellow-100 text-yellow-700';
              return 'bg-slate-100 text-slate-700';
            };
            
            return (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-slate-800 text-sm uppercase flex-1 pr-2">{cliente}</h3>
                  <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${getEstadoColor(estado)}`}>
                    {estado}
                  </span>
                </div>
                
                <div className="space-y-2 text-xs text-slate-600 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Cuenta:</span> #{cuenta}
                  </div>
                  {orden && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold">Orden:</span> {orden}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-slate-400" />
                    <span>{plaza || hub || 'Sin ubicación'}</span>
                  </div>
                  {region && region !== 'Sin región' && (
                    <div className="flex items-center gap-2">
                      <Building2 size={12} className="text-slate-400" />
                      <span>{region}</span>
                    </div>
                  )}
                  {fechaSolicitada && (
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-slate-400" />
                      <span>{fechaSolicitada}</span>
                    </div>
                  )}
                  {telefono && (
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-slate-400" />
                      <span>{telefono}</span>
                    </div>
                  )}
                </div>
                
                {telefono && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const phoneNumber = cleanPhoneNumber(telefono);
                          if (!phoneNumber) {
                            alert('El número de teléfono no es válido.');
                            return;
                          }
                          
                          // Generar mensaje personalizado desde plantilla
                          const message = await generateMessageFromTemplate(item);
                          const encodedMessage = encodeURIComponent(message);
                          const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
                          
                          console.log('Abriendo WhatsApp con plantilla');
                          window.open(whatsappUrl, '_blank');
                        } catch (error) {
                          console.error('Error al abrir WhatsApp:', error);
                          alert('Error al generar el mensaje. Por favor intenta de nuevo.');
                        }
                      }}
                      className="bg-green-500 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <a
                      href={`tel:${telefono}`}
                      className="bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                    >
                      <Phone size={14} /> Llamar
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-center py-8">
            No tienes instalaciones asignadas aún
          </p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-center py-8">
            No se encontraron instalaciones que coincidan con tu búsqueda
          </p>
        </div>
      )}
    </div>
  );
}

