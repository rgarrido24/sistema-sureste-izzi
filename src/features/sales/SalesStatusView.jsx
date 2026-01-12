import { useState, useEffect } from 'react';
import { Search, Phone, MessageCircle, Calendar, MapPin, Building2, User, Edit2, Save, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { MODULES } from '../../utils/constants.js';
import * as api from '../../api.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import { filterByVendor } from '../../utils/vendorFilter.js';

// Componente para editar teléfono y notas
function ClientContactEditor({ item, status, telefono, notaContacto, fechaPromesaPago, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTelefono, setEditTelefono] = useState(telefono || '');
  const [editNota, setEditNota] = useState(notaContacto || '');
  const [editFechaPromesa, setEditFechaPromesa] = useState(fechaPromesaPago || '');
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const itemId = item._id || item.id;
      if (!itemId) {
        alert('Error: No se pudo identificar el registro');
        return;
      }
      
      // Llamar al endpoint correspondiente según el status
      if (status === 'M1') {
        await api.updateM1Contacto(itemId, editTelefono, editNota, editFechaPromesa);
      } else if (status === 'M2') {
        await api.updateM2Contacto(itemId, editTelefono, editNota, editFechaPromesa);
      } else if (status === 'M3') {
        await api.updateM3Contacto(itemId, editTelefono, editNota, editFechaPromesa);
      } else if (status === 'M4') {
        await api.updateM4Contacto(itemId, editTelefono, editNota, editFechaPromesa);
      }
      
      setIsEditing(false);
      if (onUpdate) onUpdate();
      alert('✅ Información actualizada correctamente');
    } catch (error) {
      console.error('Error guardando contacto:', error);
      alert('Error al guardar. Por favor intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };
  
  if (!isEditing) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-200">
        <button
          onClick={() => setIsEditing(true)}
          className="w-full flex items-center justify-center gap-2 text-xs text-blue-600 hover:text-blue-700 font-medium py-2"
        >
          <Edit2 size={14} />
          Editar Teléfono / Notas
        </button>
        {(notaContacto || fechaPromesaPago) && (
          <div className="mt-2 space-y-1 text-xs">
            {notaContacto && (
              <div className="bg-blue-50 p-2 rounded text-slate-700">
                <strong>Nota:</strong> {notaContacto}
              </div>
            )}
            {fechaPromesaPago && (
              <div className="bg-green-50 p-2 rounded text-slate-700">
                <strong>Promesa de pago:</strong> {fechaPromesaPago}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono:</label>
        <input
          type="text"
          value={editTelefono}
          onChange={(e) => setEditTelefono(e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-500"
          placeholder="Número de teléfono"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Nota / Promesa de Pago:</label>
        <textarea
          value={editNota}
          onChange={(e) => setEditNota(e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-500"
          placeholder="Nota o promesa de pago..."
          rows="2"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Promesa de Pago:</label>
        <input
          type="date"
          value={editFechaPromesa}
          onChange={(e) => setEditFechaPromesa(e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-blue-600 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={12} />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={() => {
            setIsEditing(false);
            setEditTelefono(telefono || '');
            setEditNota(notaContacto || '');
            setEditFechaPromesa(fechaPromesaPago || '');
          }}
          disabled={saving}
          className="px-3 bg-slate-200 text-slate-700 py-1.5 rounded text-xs font-bold flex items-center justify-center hover:bg-slate-300 disabled:opacity-50"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// Función para generar mensaje personalizado desde plantilla
const generateMessageFromTemplate = async (client, status) => {
  try {
    console.log('🔍 Buscando plantilla para módulo:', status);
    
    // Obtener todas las plantillas activas (sin filtrar por módulo primero)
    const allTemplates = await api.getTemplates();
    console.log('📋 Plantillas obtenidas:', allTemplates.length);
    
    // Buscar plantilla que coincida con el módulo
    // Intentar coincidencia exacta primero
    let activeTemplate = allTemplates.find(t => t.isActive && t.module === status);
    
    // Si no se encuentra, intentar variaciones del módulo
    if (!activeTemplate && status === 'M1') {
      // Buscar por "M1", "m1", "cobranza", "COBRANZA"
      activeTemplate = allTemplates.find(t => 
        t.isActive && (
          t.module === 'M1' || 
          t.module === 'm1' || 
          t.module === 'cobranza' || 
          t.module === 'COBRANZA' ||
          t.module === 'Cobranza'
        )
      );
    } else if (!activeTemplate && status === 'M2') {
      activeTemplate = allTemplates.find(t => 
        t.isActive && (t.module === 'M2' || t.module === 'm2')
      );
    } else if (!activeTemplate && status === 'M3') {
      activeTemplate = allTemplates.find(t => 
        t.isActive && (t.module === 'M3' || t.module === 'm3')
      );
    } else if (!activeTemplate && status === 'M4') {
      activeTemplate = allTemplates.find(t => 
        t.isActive && (t.module === 'M4' || t.module === 'm4')
      );
    }
    
    // Si aún no se encuentra, buscar cualquier plantilla activa para cobranza en general
    if (!activeTemplate && (status === 'M1' || status === 'M2' || status === 'M3' || status === 'M4')) {
      activeTemplate = allTemplates.find(t => 
        t.isActive && (
          t.module?.toLowerCase().includes('cobranza') ||
          t.module?.toLowerCase().includes('m1') ||
          t.module?.toLowerCase().includes('m2') ||
          t.module?.toLowerCase().includes('m3') ||
          t.module?.toLowerCase().includes('m4')
        )
      );
    }
    
    // Si aún no se encuentra, buscar plantillas con módulo "general" para M1/M2/M3/M4
    if (!activeTemplate && (status === 'M1' || status === 'M2' || status === 'M3' || status === 'M4')) {
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
      console.warn('⚠️ No se encontró plantilla activa para módulo:', status);
      // Si no hay plantilla, usar mensaje por defecto
      const nombre = client.Cliente || client['Cliente'] || client.nombre || client.Nombre || 'cliente';
      const cuenta = client.cuenta || client.CUENTA || client['CUENTA'] || client['Nº de cuenta'] || client['N° de cuenta'] || '';
      return `Hola ${nombre}, te contactamos sobre tu cuenta ${cuenta}.`;
    }

    let message = activeTemplate.content;
    
    // Reemplazar variables con datos del cliente
    const nombre = client.Cliente || client['Cliente'] || client.nombre || 'Cliente';
    const cuenta = client.cuenta || client.CUENTA || client['CUENTA'] || client.NoCuenta || client['NoCuenta'] || client.Referencia || client['Referencia'] || 'N/A';
    const monto = client['Saldo Total'] || client['SaldoTotal'] || client.saldoTotal || client['Total Adeudo'] || client.totalAdeudo || 0;
    const porVencer = client['Por Vencer'] || client['PorVencer'] || client.porVencer || 0;
    const vencido = client['Vencido'] || client.vencido || 0;
    const vendedor = client.Vendedor || client['Vendedor'] || client.vendedor || 'N/A';
    const plaza = client.PLAZA || client['PLAZA'] || client.Plaza || client.plaza || 'N/A';
    const estatus = status || 'N/A';

    // Formatear montos como moneda
    const formatCurrency = (value) => {
      if (!value) return '$0.00';
      const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
      if (isNaN(num)) return '$0.00';
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
    };

    message = message
      .replace(/{nombre}/g, nombre)
      .replace(/{cuenta}/g, cuenta)
      .replace(/{monto}/g, formatCurrency(monto))
      .replace(/{porVencer}/g, formatCurrency(porVencer))
      .replace(/{vencido}/g, formatCurrency(vencido))
      .replace(/{vendedor}/g, vendedor)
      .replace(/{plaza}/g, plaza)
      .replace(/{estatus}/g, estatus);

    // Agregar video si existe
    if (activeTemplate.videoUrl) {
      message += `\n\n📹 Video tutorial: ${activeTemplate.videoUrl}`;
    }

    return message;
  } catch (error) {
    console.error('❌ Error generando mensaje desde plantilla:', error);
    console.error('Error completo:', error);
    console.error('Cliente:', client);
    console.error('Status:', status);
    // Mensaje por defecto si hay error
    const nombre = client.Cliente || client['Cliente'] || client.nombre || client.Nombre || 'Cliente';
    const cuenta = client.cuenta || client.CUENTA || client['CUENTA'] || client['Nº de cuenta'] || client['N° de cuenta'] || 'N/A';
    return `Hola ${nombre}, te contactamos sobre tu cuenta ${cuenta}.`;
  }
};

// Función para limpiar y validar número de teléfono
const cleanPhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Convertir a string y eliminar todos los caracteres no numéricos excepto el +
  let cleaned = phone.toString().trim();
  
  // Si tiene +, mantenerlo y eliminar todo lo demás que no sea número
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/[^\d+]/g, '');
  
  // Si no tiene +, eliminar todos los caracteres no numéricos
  if (!hasPlus) {
    cleaned = cleaned.replace(/\D/g, '');
  }
  
  // Si está vacío después de limpiar, retornar null
  if (!cleaned || cleaned.length === 0) return null;
  
  // Si tiene +, quitar el + y procesar
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Si empieza con 52 (México), mantenerlo
  if (cleaned.startsWith('52')) {
    // Verificar que tenga al menos 12 dígitos (52 + 10 dígitos)
    if (cleaned.length >= 12) {
      return cleaned;
    }
  }
  
  // Si empieza con 1 (puede ser código de país), verificar longitud
  if (cleaned.startsWith('1') && cleaned.length >= 11) {
    return cleaned;
  }
  
  // Si tiene 10 dígitos, agregar código de país 52 (México)
  if (cleaned.length === 10) {
    return `52${cleaned}`;
  }
  
  // Si tiene más de 10 dígitos pero no empieza con código de país conocido
  if (cleaned.length > 10) {
    return cleaned;
  }
  
  // Si tiene menos de 10 dígitos, no es válido
  if (cleaned.length < 10) {
    console.warn('Número de teléfono muy corto:', cleaned);
    return null;
  }
  
  return cleaned;
};

// Función para abrir WhatsApp con mensaje personalizado
const openWhatsApp = async (phone, client, status) => {
  if (!phone) {
    alert('No hay número de teléfono disponible para este cliente');
    return;
  }
  
  // Limpiar y validar el número
  const phoneNumber = cleanPhoneNumber(phone);
  
  if (!phoneNumber) {
    alert('El número de teléfono no es válido. Por favor verifica el número del cliente.');
    console.error('Número de teléfono inválido:', phone);
    return;
  }
  
  // Validar que el número tenga al menos 10 dígitos
  if (phoneNumber.length < 10) {
    alert('El número de teléfono es muy corto. Debe tener al menos 10 dígitos.');
    console.error('Número de teléfono muy corto:', phoneNumber);
    return;
  }
  
  try {
    // Generar mensaje personalizado desde plantilla
    const message = await generateMessageFromTemplate(client, status);
    
    // Codificar el mensaje para URL (usar encodeURIComponent para caracteres especiales)
    const encodedMessage = encodeURIComponent(message);
    
    // Usar api.whatsapp.com en lugar de wa.me para mejor compatibilidad
    // Este formato mantiene mejor el mensaje al abrir WhatsApp Web
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
    
    console.log('Abriendo WhatsApp con URL:', whatsappUrl.replace(/&text=.*/, '&text=[mensaje codificado]'));
    console.log('Mensaje original:', message);
    console.log('Número de teléfono:', phoneNumber);
    
    // Abrir en la misma ventana para mejor compatibilidad
    window.location.href = whatsappUrl;
  } catch (error) {
    console.error('Error al abrir WhatsApp:', error);
    alert('Error al generar el mensaje. Por favor intenta de nuevo.');
  }
};

// Función para formatear moneda
const formatCurrency = (value) => {
  if (!value) return '$0.00';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
};

// Función para obtener el mes de instalación más común de los datos
const getMesInstalacion = (data, status) => {
  if (!data || data.length === 0) return null;
  
  // Determinar el nombre de la columna según el status
  const fechaField = status === 'M1' 
    ? 'Fecha Instalacion' 
    : 'FechaInstalacion';
  
  // Extraer todos los meses de las fechas de instalación
  const meses = [];
  const mesesEnEspanol = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  data.forEach(item => {
    // Buscar en múltiples campos de fecha
    const fecha = item[fechaField] || 
                  item['Fecha Instalacion'] || 
                  item['FechaInstalacion'] ||
                  item['Fecha Instalación'] ||
                  item['Fecha instalacion'] ||
                  item['Fecha de instalación'] ||
                  item['FECHA INSTALACION'] ||
                  item['FECHA INSTALACIÓN'] ||
                  '';
    
    if (fecha && fecha !== 'undefined' && fecha !== 'null' && String(fecha).trim() !== '') {
      try {
        const fechaStr = String(fecha).trim();
        let fechaDate = null;
        
        // Intentar parsear formato DD/MM/YYYY o DD/MM/YY
        // Nota: Asumimos formato DD/MM/YYYY (día/mes/año) que es el formato común en México
        if (fechaStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
          const partes = fechaStr.split('/');
          const dia = parseInt(partes[0]);
          const mes = parseInt(partes[1]) - 1; // Mes en JS es 0-indexed
          const anio = parseInt(partes[2].length === 2 ? '20' + partes[2] : partes[2]);
          
          // Validar que el mes sea válido (0-11) y el día sea válido
          if (mes >= 0 && mes <= 11 && dia >= 1 && dia <= 31) {
            fechaDate = new Date(anio, mes, dia);
          }
        }
        // Intentar parsear formato YYYY-MM-DD
        else if (fechaStr.match(/^\d{4}-\d{1,2}-\d{1,2}/)) {
          fechaDate = new Date(fechaStr);
        }
        // Intentar parsear como fecha estándar
        else {
          fechaDate = new Date(fechaStr);
        }
        
        if (fechaDate && !isNaN(fechaDate.getTime())) {
          const mes = fechaDate.getMonth(); // 0-11
          meses.push(mes);
        } else {
          // Si no se puede parsear, intentar extraer el mes del string
          const fechaLower = fechaStr.toLowerCase();
          if (fechaLower.includes('octubre') || fechaLower.includes('oct')) meses.push(9);
          else if (fechaLower.includes('noviembre') || fechaLower.includes('nov')) meses.push(10);
          else if (fechaLower.includes('diciembre') || fechaLower.includes('dic')) meses.push(11);
          else if (fechaLower.includes('enero') || fechaLower.includes('ene')) meses.push(0);
          else if (fechaLower.includes('febrero') || fechaLower.includes('feb')) meses.push(1);
          else if (fechaLower.includes('marzo') || fechaLower.includes('mar')) meses.push(2);
          else if (fechaLower.includes('abril') || fechaLower.includes('abr')) meses.push(3);
          else if (fechaLower.includes('mayo')) meses.push(4);
          else if (fechaLower.includes('junio') || fechaLower.includes('jun')) meses.push(5);
          else if (fechaLower.includes('julio') || fechaLower.includes('jul')) meses.push(6);
          else if (fechaLower.includes('agosto') || fechaLower.includes('ago')) meses.push(7);
          else if (fechaLower.includes('septiembre') || fechaLower.includes('sep')) meses.push(8);
        }
      } catch (e) {
        // Ignorar errores de parsing
      }
    }
  });
  
  if (meses.length === 0) return null;
  
  // Contar la frecuencia de cada mes
  const frecuenciaMeses = {};
  meses.forEach(mes => {
    frecuenciaMeses[mes] = (frecuenciaMeses[mes] || 0) + 1;
  });
  
  // Encontrar el mes más común
  let mesMasComun = meses[0];
  let maxFrecuencia = frecuenciaMeses[meses[0]];
  
  Object.keys(frecuenciaMeses).forEach(mes => {
    if (frecuenciaMeses[mes] > maxFrecuencia) {
      maxFrecuencia = frecuenciaMeses[mes];
      mesMasComun = parseInt(mes);
    }
  });
  
  // Debug: Log para verificar qué mes se está detectando
  console.log('🔍 Mes de instalación detectado:', mesesEnEspanol[mesMasComun], 'con frecuencia:', maxFrecuencia, 'de', meses.length, 'fechas');
  console.log('📊 Distribución de meses:', frecuenciaMeses);
  
  return mesesEnEspanol[mesMasComun];
};

export default function SalesStatusView({ 
  status, 
  searchTerm, 
  setSearchTerm, 
  filterVendor, 
  setFilterVendor,
  filterEstatus,
  setFilterEstatus
}) {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [mesInstalacion, setMesInstalacion] = useState(null);

  // Cargar datos solo cuando este componente se monta (pestaña M1, M2, etc.)
  useEffect(() => {
    const loadStatusData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Determinar si el usuario es vendedor para filtrar
        const isVendor = user.role === 'vendedor' || user.role === 'user';
        const vendorFilter = isVendor ? (user.name || user.username) : null;
        
        // Cargar desde la colección específica (M1, M2, M3, M4)
        let data = [];
        if (status === 'M1') {
          data = await api.getM1Master(vendorFilter);
        } else if (status === 'M2') {
          data = await api.getM2Master(vendorFilter);
        } else if (status === 'M3') {
          data = await api.getM3Master(vendorFilter);
        } else if (status === 'M4') {
          data = await api.getM4Master(vendorFilter);
        } else {
          // Fallback: usar sales_master y filtrar
          const salesData = await api.getSalesMaster();
          data = salesData.filter(item => {
            const estatus = (item.Estatus || '').toUpperCase();
            return estatus === status.toUpperCase();
          });
          // Filtrar por vendedor usando la función helper
          data = filterByVendor(data, user);
        }
        
        const dataWithIds = data.map(d => ({ id: d._id || d.id, ...d }));
        setData(dataWithIds);
        setCount(dataWithIds.length);
        
        // Determinar el mes de instalación más común
        const mes = getMesInstalacion(dataWithIds, status);
        setMesInstalacion(mes);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStatusData();
  }, [status, user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner message={`Cargando clientes ${status}...`} />
      </div>
    );
  }

  const vendors = [...new Set(
    data.map(item => item.Vendedor || item['Vendedor']).filter(Boolean)
  )].sort();
  
  // Mapeo de HUBs y PLAZAs a regiones (SURESTE, METROPOLITANA, NORESTE)
  const getRegionFromHubPlaza = (hub, plaza) => {
    if (!hub && !plaza) return null;
    
    const hubStr = hub ? String(hub).trim().toUpperCase() : '';
    const plazaStr = plaza ? String(plaza).trim().toUpperCase() : '';
    
    // Lista de HUBs de SURESTE
    const suresteHubs = [
      'HUB COATZACOALCOS', 'HUB MERIDA', 'HUB VERACRUZ', 'HUB POZA RICA',
      'HUB PUEBLA', 'HUB ATLIXCO', 'HUB TLAXCALA', 'HUB CAMPECHE',
      'HUB UMAN', 'HUB CENTRO', 'HUB CARDENAS', 'HUB COMALCALCO',
      'HUB PLAYA DEL CARMEN', 'HUB CANCUN', 'HUB VALLADOLID', 'HUB IZAMAL',
      'HUB CARMEN', 'HUB TAPACHULA', 'HUB HUAMANTLA', 'HUB SAN PABLO DEL MONTE',
      'HUB SAN MARTIN TEXMELUCAN', 'HUB CALPULALPAN', 'HUB TEHUACAN', 'HUB CHETUMAL',
      'HUB TEZIUTLAN', 'HUB PUEBLA', 'HUB JALACINGO', 'HUB YAHUQUEMEHCAN'
    ];
    
    // Lista de PLAZAs de SURESTE
    const surestePlazas = [
      'COATZACOALCOS', 'KANASIN', 'ORIZABA', 'PAPANTLA', 'SAN ANDRES CHOLULA',
      'ATLIXCO', 'TLAXCALA', 'CAMPECHE', 'POZA RICA', 'UMAN', 'CENTRO',
      'COSOLEACAQUE', 'CORDOBA', 'MERIDA', 'MINATITLAN', 'TAB CARDENAS',
      'COMALCALCO', 'PROGRESO', 'IXTENCO', 'NACAJUCA', 'TULUM', 'BUCTZOTZ',
      'TIZIMIN', 'TUXPAN VER', 'TIHUATLAN', 'APIZACO', 'IXTACUIXTLA',
      'NATIVITAS', 'MAZATECOCHO', 'PUERTO MORELOS', 'SANTA ISABEL CHOLULA',
      'TEMAX', 'TETLA', 'TIANGUISMANALCO', 'ACULTZINGO', 'RAFAEL DELGADO',
      'SAN PEDRO CHOLULA', 'MARIANO ESCOBEDO'
    ];
    
    // Lista de HUBs de METROPOLITANA (mx norte, mx sur, mx centro)
    const metropolitanaHubs = [
      'HUB CUERNAVACA', 'HUB ATIZAPAN', 'HUB IXTAPALUCA', 'HUB PACHUCA',
      'HUB ZUMPANGO', 'HUB XOCHIMILCO', 'HUB TECAMAC', 'HUB CHALCO',
      'HUB NAUCALPAN', 'HUB IZTAPALAPA', 'HUB CUAUTLA', 'HUB CUAUTITLAN',
      'HUB ECATEPEC', 'HUB AYALA', 'HUB TULTITLAN', 'HUB ALVARO OBREGON',
      'HUB GUSTAVO A MADERO', 'HUB CHIMALHUACAN', 'HUB VENUSTIANO CARRANZA',
      'HUB LA MAGDALENA CONTRERAS', 'HUB NEZAHUALCOYOTL', 'HUB TOLUCA',
      'HUB TULANCINGO', 'HUB AXOCHIAPAN', 'HUB TEPOTZOTLAN', 'HUB TLAHUAC',
      'HUB COYOACAN', 'HUB MIGUEL HIDALGO', 'HUB IZTACALCO', 'HUB TLALNEPANTLA',
      'HUB AZCAPOTZALCO', 'HUB MILPA ALTA', 'HUB TLALPAN', 'HUB CUAUHTEMOC',
      'HUB BENITO JUAREZ', 'HUB CUAJIMALPA', 'HUB ACOLMAN', 'HUB TULA',
      'HUB HUIXQUILUCAN'
    ];
    
    // Lista de PLAZAs de METROPOLITANA
    const metropolitanaPlazas = [
      'CUERNAVACA', 'ATIZAPAN', 'IXTAPALUCA LOS REYES', 'TIZAYUCA', 'ZUMPANGO',
      'XOCHIMILCO', 'TECAMAC', 'CHALCO', 'NAUCALPAN', 'IZTAPALAPA', 'CUAUTLA',
      'CUAUTITLAN', 'ECATEPEC', 'AYALA', 'TULTITLAN', 'ALVARO OBREGON CDMX - NTE',
      'ALVARO OBREGON CDMX - SUR', 'GUSTAVO A MADERO - SUR', 'GUSTAVO A MADERO - NTE',
      'CHIMALHUACAN', 'VENUSTIANO CARRANZA CDMX', 'LA MAGDALENA CONTRERAS',
      'PACHUCA', 'NEZAHUALCOYOTL', 'TOLUCA', 'TENANGO', 'TULANCINGO', 'APAN',
      'ZEMPOALA', 'CUAUTEPEC', 'JANETELCO', 'JOJUTLA', 'YAUTEPEC', 'TEPOZTLAN',
      'TEOLOYUCAN', 'AMECAMECA', 'TENANGO DEL AIRE', 'TLAHUAC', 'MILPA ALTA',
      'IZTACALCO', 'TLALNEPANTLA', 'AZCAPOTZALCO', 'TLALPAN', 'CUAUHTEMOC CDMX',
      'BENITO JUAREZ CDMX - NTE', 'CUAJIMALPA', 'ACOLMAN', 'TULA HGO',
      'SAN ANTONIO', 'ZINACANTEPEC', 'CALPUHUAC', 'LERMA', 'HUIXQUILUCAN',
      'SAN PEDRO CHOLULA', 'SAN MARTIN TEXMELUCAN'
    ];
    
    // Lista de HUBs de NORESTE (noreste 1 + noreste 2)
    const noresteHubs = [
      'HUB MONTERREY', 'HUB VICTORIA', 'HUB QUERETARO', 'HUB SAN LUIS POTOSI',
      'HUB TAMPICO', 'HUB MATAMOROS', 'HUB LINARES', 'HUB NUEVO LAREDO',
      'HUB SALTILLO', 'HUB VALLES', 'HUB GENERAL TERAN', 'HUB PANUCO',
      'HUB IRAPUATO', 'HUB MONCLOVA', 'HUB MATEHUALA', 'HUB REYNOSA',
      'HUB CELAYA', 'HUB MEXQUITIC'
    ];
    
    // Lista de PLAZAs de NORESTE
    const norestePlazas = [
      'JUAREZ NL', 'APODACA', 'EL CARMEN', 'MANTE', 'QUERETARO', 'SAN LUIS POTOSI',
      'TAMPICO', 'PESQUERIA', 'MONTERREY', 'MATAMOROS', 'EL MARQUES', 'GUADALUPE NL',
      'GENERAL ESCOBEDO', 'XICONTENCATL', 'LINARES', 'CADEREYTA', 'SALINAS VICTORIA',
      'GARCIA', 'GENERAL ZUAZUA', 'IRAPUATO', 'SALAMANCA', 'SALTILLO', 'CIUDAD VALLES',
      'GENERAL TERAN', 'PANUCO', 'CIENEGA DE FLORES', 'SANTA CATARINA', 'MONCLOVA',
      'MONTEMORELOS', 'RIO BRAVO', 'VICTORIA', 'SAN PEDRO GARZA GARCIA',
      'SAN NICOLAS DE LOS GARZA', 'CEDRAL', 'EBANO', 'PUEBLO VIEJO', 'ARTEAGA', 'MEXQUITIC'
    ];
    
    // Lista de HUBs de OCCIDENTE
    const occidenteHubs = [
      'HUB PUERTO VALLARTA', 'HUB AGUASCALIENTES', 'HUB GUADALAJARA', 'HUB OAXACA',
      'HUB ACAPULCO', 'HUB COYUCA', 'HUB LAGOS DE MORENO', 'HUB MANZANILLO',
      'HUB BAHIA DE BANDERAS', 'HUB IGUALA', 'HUB CIHUATLAN'
    ];
    
    // Lista de PLAZAs de OCCIDENTE
    const occidentePlazas = [
      'PUERTO VALLARTA', 'AGUASCALIENTES', 'GUADALAJARA', 'OAXACA', 'TLAJOMULCO',
      'ZAPOPAN', 'ACAPULCO', 'TLAQUEPAQUE', 'EL SALTO', 'CHILPANCINGO', 'LAGOS',
      'JUANACATLAN', 'TONALA JAL', 'TLATLIXTAC', 'ZUMPANGO DEL RIO', 'MANZANILLO',
      'BAHIA DE BANDERAS', 'VILLA DE ZAACHILA', 'IGUALA', 'SAN FRANCISCO DE LOS ROMO',
      'TELIXTLAHUACA', 'ZAPOTLANEJO', 'TALA', 'CIHUATLAN'
    ];
    
    // Lista de HUBs de PACIFICO (pacifico 1 + pacifico 2)
    const pacificoHubs = [
      'HUB NOGALES', 'HUB JUAREZ', 'HUB CHIHUAHUA', 'HUB DURANGO',
      'HUB SAN LUIS RIO COLORADO', 'HUB TIJUANA', 'HUB ENSENADA', 'HUB MAZATLAN',
      'HUB CUAUHTEMOC CHIH', 'HUB TEPIC', 'HUB MEXICALI', 'HUB PARRAL',
      'HUB GUADALUPE', 'HUB LA PAZ'
    ];
    
    // Lista de PLAZAs de PACIFICO
    const pacificoPlazas = [
      'NOGALES', 'CD. JUAREZ', 'CD JUAREZ', 'DELICIAS', 'DURANGO',
      'SAN LUIS RIO COLORADO', 'TIJUANA', 'ENSENADA', 'MAZATLAN',
      'CUAUHTEMOC CHIH', 'TEPIC', 'MEXICALI', 'CAMARGO CHIH', 'SAUCILLO',
      'CHIHUAHUA', 'ROSARITO', 'PARRAL', 'ZAC GUADALUPE', 'LA PAZ',
      'CASAS GRANDES'
    ];
    
    // Verificar si el HUB o PLAZA pertenece a METROPOLITANA (prioridad)
    if (hubStr && metropolitanaHubs.some(h => hubStr.includes(h.replace('HUB ', '')))) {
      return 'METROPOLITANA';
    }
    if (plazaStr && metropolitanaPlazas.some(p => plazaStr === p || plazaStr.includes(p))) {
      return 'METROPOLITANA';
    }
    
    // Verificar si el HUB o PLAZA pertenece a NORESTE
    if (hubStr && noresteHubs.some(h => hubStr.includes(h.replace('HUB ', '')))) {
      return 'NORESTE';
    }
    if (plazaStr && norestePlazas.some(p => plazaStr === p || plazaStr.includes(p))) {
      return 'NORESTE';
    }
    
    // Verificar si el HUB o PLAZA pertenece a OCCIDENTE
    if (hubStr && occidenteHubs.some(h => hubStr.includes(h.replace('HUB ', '')))) {
      return 'OCCIDENTE';
    }
    if (plazaStr && occidentePlazas.some(p => plazaStr === p || plazaStr.includes(p))) {
      return 'OCCIDENTE';
    }
    
    // Verificar si el HUB o PLAZA pertenece a PACIFICO
    if (hubStr && pacificoHubs.some(h => hubStr.includes(h.replace('HUB ', '')))) {
      return 'PACIFICO';
    }
    if (plazaStr && pacificoPlazas.some(p => plazaStr === p || plazaStr.includes(p))) {
      return 'PACIFICO';
    }
    
    // Verificar si el HUB o PLAZA pertenece a SURESTE
    if (hubStr && suresteHubs.some(h => hubStr.includes(h.replace('HUB ', '')))) {
      return 'SURESTE';
    }
    if (plazaStr && surestePlazas.some(p => plazaStr === p || plazaStr.includes(p))) {
      return 'SURESTE';
    }
    
    return null;
  };
  
  // Función para agrupar regiones según las reglas especificadas
  const getRegionGroup = (region, hub = null, plaza = null) => {
    // Primero intentar identificar por HUB/PLAZA si no hay región
    if ((!region || region === '' || region === 'undefined' || region === 'null') && (hub || plaza)) {
      const regionFromHubPlaza = getRegionFromHubPlaza(hub, plaza);
      if (regionFromHubPlaza) {
        return regionFromHubPlaza;
      }
    }
    
    if (!region || region === '' || region === 'undefined' || region === 'null') {
      // Si aún no hay región, intentar con HUB/PLAZA
      if (hub || plaza) {
        const regionFromHubPlaza = getRegionFromHubPlaza(hub, plaza);
        if (regionFromHubPlaza) return regionFromHubPlaza;
      }
      return 'Sin Dato';
    }
    
    const regionStr = String(region).trim();
    const regionLower = regionStr.toLowerCase();
    
    // SURESTE: sureste 1 + sureste 2
    if (regionLower.includes('sureste')) return 'SURESTE';
    
    // NORESTE: noreste 1 + noreste 2
    if (regionLower.includes('noreste')) return 'NORESTE';
    
    // PACIFICO: pacifico 1 + pacifico 2 (manejar caracteres especiales como í, ï¿½, etc.)
    // Normalizar caracteres especiales primero
    const normalizedRegion = regionLower
      .replace(/í/g, 'i')
      .replace(/ï¿½/g, 'i')
      .replace(/[^\w\s]/g, '') // Remover caracteres especiales
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remover tildes
    
    if (normalizedRegion.includes('pacifico') || 
        regionLower.includes('pacífico') || 
        regionLower.includes('pacifico') ||
        regionLower.includes('pacï¿½fico')) return 'PACIFICO';
    
    // METROPOLITANA: mx centro + mx norte + mx sur
    if (regionLower.includes('mx centro') || 
        regionLower.includes('mx norte') || 
        regionLower.includes('mx sur') || 
        regionLower.includes('metropolitana') || 
        regionLower.includes('metro') ||
        (regionLower.includes('centro') && regionLower.includes('mx'))) return 'METROPOLITANA';
    
    // OCCIDENTE: occidente
    if (regionLower.includes('occidente')) return 'OCCIDENTE';
    
    // Si no coincide con ninguna región en el texto, intentar con HUB/PLAZA
    if (hub || plaza) {
      const regionFromHubPlaza = getRegionFromHubPlaza(hub, plaza);
      if (regionFromHubPlaza) return regionFromHubPlaza;
    }
    
    // Si no coincide con ninguna, retornar 'Sin Dato'
    return 'Sin Dato';
  };
  
  // Función para obtener el estatus FPD de un item
  const getEstatusFPD = (item) => {
    // Para M2, M3, M4: verificar campo M2/M3/M4 primero: 0 = FPD CORRIENTE, 1 = M2/M3/M4 (debe)
    if (status === 'M2' || status === 'M3' || status === 'M4') {
      // Si ya tiene Estatus FPD guardado, usarlo primero
      const estatusFPDRaw = item['Estatus FPD'] || item['EstatusFPD'] || '';
      if (estatusFPDRaw) {
        const estatusFPD = estatusFPDRaw.toUpperCase().trim();
        if (estatusFPD === 'FPD CORRIENTE') return 'FPD CORRIENTE';
        if (estatusFPD === status) return status;
      }
      
      // Si no, usar el campo M2/M3/M4
      const campo = item[status] || item[status.toLowerCase()] || item[`${status} `] || item[`${status.toLowerCase()} `];
      
      if (campo !== null && campo !== undefined && campo !== '') {
        const campoNum = typeof campo === 'number' ? campo : parseInt(String(campo).trim(), 10);
        if (!isNaN(campoNum)) {
          if (campoNum === 0) {
            // 0 = No debe = FPD CORRIENTE
            return 'FPD CORRIENTE';
          } else if (campoNum === 1) {
            // 1 = Debe = M2/M3/M4
            return status;
          }
        }
      }
      
      // Por defecto, si no se encuentra, retornar el status actual
      return status;
    }
    
    // Para M1, usar el campo Estatus FPD
    const estatusFPDRaw = item['Estatus FPD'] || item['EstatusFPD'] || item['Estatus Fpd'] || '';
    const estatusFPD = estatusFPDRaw.toUpperCase().trim();
    
    if (estatusFPD.includes('PÉRDIDA') || estatusFPD.includes('PERDIDA') || estatusFPD.includes('PERDIDO')) {
      return 'FPD PÉRDIDA';
    } else if (estatusFPD.includes('CORRIENTE') || estatusFPD === 'FPD CORRIENTE') {
      return 'FPD CORRIENTE';
    } else {
      return 'M1';
    }
  };
  
  // Calcular estadísticas por región (para M1, M2, M3, M4)
  const regionStats = (status === 'M1' || status === 'M2' || status === 'M3' || status === 'M4') ? (() => {
    const stats = {};
    const regionValues = new Set(); // Para debugging
    
    data.forEach(item => {
      // Buscar región en SUBREGION primero (donde vienen las regiones como "sureste 1", "sureste 2", etc.)
      // Luego buscar en REGION como respaldo
      // También buscar en PLAZA que puede tener la información de región
      const regionRaw = item.SUBREGION ||
                       item['SUBREGION'] ||
                       item['Subregion'] ||
                       item['Sub Region'] ||
                       item['SUB REGION'] ||
                       item.REGION || 
                       item['REGION'] || 
                       item['Region'] ||
                       item['Region Nueva'] || 
                       item['REGION NUEVA'] ||
                       item['RegionNueva'] ||
                       item['REGIONNUEVA'] ||
                       item.PLAZA ||
                       item['PLAZA'] ||
                       item.Plaza ||
                       item.region ||
                       item.Region ||
                       '';
      
      // Obtener HUB y PLAZA para identificación de región
      const hub = item.HUB || item['HUB'] || item.Hub || '';
      const plaza = item.PLAZA || item['PLAZA'] || item.Plaza || '';
      
      // Guardar valores únicos para debugging (solo los primeros 30 para ver más variaciones)
      if (regionValues.size < 30 && regionRaw) {
        regionValues.add(String(regionRaw));
      }
      
      const region = getRegionGroup(regionRaw, hub, plaza);
      
      if (!stats[region]) {
        const statusKey = status === 'M1' ? 'm1' : status === 'M2' ? 'm2' : status === 'M3' ? 'm3' : 'm4';
        // M2, M3, M4 no tienen pérdidas, solo M1
        stats[region] = { total: 0, [statusKey]: 0, perdidas: status === 'M1' ? 0 : undefined, fpdCorriente: 0 };
      }
      stats[region].total++;
      
      const estatusFPD = getEstatusFPD(item);
      const statusKey = status === 'M1' ? 'm1' : status === 'M2' ? 'm2' : status === 'M3' ? 'm3' : 'm4';
      
      // Solo M1 tiene pérdidas, M2, M3, M4 no
      if (status === 'M1' && estatusFPD === 'FPD PÉRDIDA') {
        stats[region].perdidas++;
      } else if (estatusFPD === 'FPD CORRIENTE') {
        stats[region].fpdCorriente++;
      } else {
        stats[region][statusKey]++;
      }
    });
    
    // Debug: mostrar valores de región encontrados
    if (regionValues.size > 0) {
      console.log('🔍 Valores de región encontrados en el archivo:', Array.from(regionValues));
    }
    
    // Calcular porcentajes
    Object.keys(stats).forEach(region => {
      const s = stats[region];
      const statusKey = status === 'M1' ? 'm1' : status === 'M2' ? 'm2' : status === 'M3' ? 'm3' : 'm4';
      const statusLabel = status === 'M1' ? 'M1' : status === 'M2' ? 'M2' : status === 'M3' ? 'M3' : 'M4';
      s[`porcentaje${statusLabel}`] = s.total > 0 ? ((s[statusKey] / s.total) * 100).toFixed(1) : 0;
      // Solo M1 tiene pérdidas, M2, M3, M4 no
      if (status === 'M1') {
        s.porcentajePerdidas = s.total > 0 ? ((s.perdidas / s.total) * 100).toFixed(1) : 0;
      }
      s.porcentajeFPD = s.total > 0 ? ((s.fpdCorriente / s.total) * 100).toFixed(1) : 0;
    });
    
    // Debug: mostrar estadísticas calculadas
    console.log('📊 Estadísticas por región calculadas:', stats);
    
    // Ordenar regiones: SURESTE, NORESTE, METROPOLITANA, PACIFICO, OCCIDENTE, Sin Dato
    const regionOrder = ['SURESTE', 'NORESTE', 'METROPOLITANA', 'PACIFICO', 'OCCIDENTE', 'Sin Dato'];
    const sortedStats = {};
    regionOrder.forEach(reg => {
      if (stats[reg]) sortedStats[reg] = stats[reg];
    });
    Object.keys(stats).forEach(reg => {
      if (!sortedStats[reg]) sortedStats[reg] = stats[reg];
    });
    
    return sortedStats;
  })() : {};
  
  // Filtrar por búsqueda, vendedor y estatus
  const filteredData = data.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (item.Cliente || item['Cliente'] || '').toLowerCase().includes(searchLower) ||
      (item.CUENTA || item.Cuenta || item.cuenta || '').toString().includes(searchTerm) ||
      (item.Telefono1 || item.Telefono2 || item['Telefono1'] || item['Telefono2'] || '').toString().includes(searchTerm) ||
      (item.Vendedor || item['Vendedor'] || '').toLowerCase().includes(searchLower) ||
      (item.PLAZA || item['PLAZA'] || item.Plaza || '').toLowerCase().includes(searchLower);
    
    const matchesVendor = !filterVendor || (item.Vendedor || item['Vendedor']) === filterVendor;
    
    // Filtrar por estatus (para M1, M2, M3, M4)
    let matchesEstatus = true;
    if ((status === 'M1' || status === 'M2' || status === 'M3' || status === 'M4') && filterEstatus) {
      const itemEstatus = getEstatusFPD(item);
      matchesEstatus = itemEstatus === filterEstatus;
    }
    
    return matchesSearch && matchesVendor && matchesEstatus;
  });

  // Paginación
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold mb-2">
          Clientes {status}
          {mesInstalacion && <span className="text-slate-500 font-normal"> ({mesInstalacion})</span>}
        </h2>
        <p className="text-slate-600">
          {count === 0 
            ? `No hay clientes con estatus ${status}`
            : `Total de clientes: ${count}`
          }
        </p>
      </div>

      {/* Estadísticas por Región (para M1, M2, M3, M4) */}
      {(status === 'M1' || status === 'M2' || status === 'M3' || status === 'M4') && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-xl font-bold mb-4">Estadísticas por Región</h3>
          {Object.keys(regionStats).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Mostrar las 5 regiones principales primero, luego "Sin Dato" */}
              {['SURESTE', 'NORESTE', 'METROPOLITANA', 'PACIFICO', 'OCCIDENTE', 'Sin Dato'].map(region => {
                const stats = regionStats[region];
                if (!stats) return null;
                
                return (
                  <div key={region} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <h4 className="font-bold text-slate-800 mb-3 text-lg">{region}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center bg-white p-2 rounded">
                        <span className="text-slate-600 font-medium">Total:</span>
                        <span className="font-bold text-slate-800">{stats.total}</span>
                      </div>
                      <div className="flex justify-between items-center bg-amber-50 p-2 rounded">
                        <span className="text-amber-700 font-medium">{status}:</span>
                        <span className="font-bold text-amber-700">
                          {stats[status.toLowerCase()] || stats.m1 || stats.m2 || stats.m3 || stats.m4 || 0} ({stats[`porcentaje${status}`] || stats.porcentajeM1 || stats.porcentajeM2 || stats.porcentajeM3 || stats.porcentajeM4 || 0}%)
                        </span>
                      </div>
                      {/* Solo M1 muestra Pérdidas, M2, M3, M4 no */}
                      {status === 'M1' && (
                        <div className="flex justify-between items-center bg-red-50 p-2 rounded">
                          <span className="text-red-700 font-medium">Pérdidas:</span>
                          <span className="font-bold text-red-700">{stats.perdidas || 0} ({stats.porcentajePerdidas || 0}%)</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center bg-green-50 p-2 rounded">
                        <span className="text-green-700 font-medium">FPD Corriente:</span>
                        <span className="font-bold text-green-700">{stats.fpdCorriente} ({stats.porcentajeFPD}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No se encontraron datos de región. Revisa la consola del navegador (F12) para ver los valores encontrados.</p>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, cuenta, teléfono..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          {(status === 'M1' || status === 'M2' || status === 'M3' || status === 'M4') && (
            <select
              value={filterEstatus || ''}
              onChange={(e) => setFilterEstatus(e.target.value || null)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">Todos los estatus</option>
              <option value={status}>{status}</option>
              <option value="FPD CORRIENTE">FPD CORRIENTE</option>
              {status === 'M1' && <option value="FPD PÉRDIDA">FPD PÉRDIDA</option>}
              {/* M2, M3, M4 no tienen opción de Pérdida */}
            </select>
          )}
          <select
            value={filterVendor}
            onChange={(e) => setFilterVendor(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos los vendedores</option>
            {vendors.map(vendor => (
              <option key={vendor} value={vendor}>{vendor}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Mostrando {filteredData.length} de {count} clientes • Estatus: {status}
          {(status === 'M1' || status === 'M2' || status === 'M3' || status === 'M4') && filterEstatus && ` • Filtrado: ${filterEstatus}`}
        </p>
        
        {/* Paginación */}
        <div className="flex gap-2 items-center mt-3 flex-wrap">
          <span className="text-sm text-slate-600">Elementos por página:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={75}>75</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Lista de Cards */}
      {paginatedData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedData.map((item) => {
            // Obtener valores con diferentes nombres posibles - buscar en múltiples campos
            const cliente = item.Cliente || 
                           item['Cliente'] || 
                           item.CLIENTE ||
                           item['CLIENTE'] ||
                           item.Nombre ||
                           item['Nombre'] ||
                           item.NOMBRE ||
                           item['NOMBRE'] ||
                           item['Nombre Cliente'] ||
                           item['Nombre del Cliente'] ||
                           item['Razón Social'] ||
                           item['Razon Social'] ||
                           item['Razón social'] ||
                           item['Nombre Completo'] ||
                           item['Nombre completo'] ||
                           'Sin nombre';
            const cuenta = item.CUENTA || item.Cuenta || item.cuenta || '-';
            const telefono1 = item.Telefono1 || item['Telefono1'] || '';
            const telefono2 = item.Telefono2 || item['Telefono2'] || '';
            const telefono = telefono1 || telefono2;
            
            // Determinar el estatus principal basado en FPD
            const estatusPrincipal = getEstatusFPD(item);
            
            // Leer saldos correctamente - probar diferentes nombres de columna
            const parseMoney = (val) => {
              if (!val && val !== 0) return 0;
              if (typeof val === 'number') return val;
              const str = String(val).trim();
              if (!str || str === '-' || str === 'N/A') return 0;
              // Limpiar formato de moneda: quitar $, espacios, comas
              const cleaned = str.replace(/[$\s,]/g, '').replace(/[^0-9.-]+/g, '');
              const num = parseFloat(cleaned);
              return isNaN(num) ? 0 : num;
            };
            
            // Buscar saldo en diferentes variaciones de nombre
            const saldoRaw = item.SALDO || 
                            item['SALDO'] || 
                            item.Saldo || 
                            item['Saldo'] ||
                            item['Saldo Total'] ||
                            item['SALDO TOTAL'] ||
                            0;
            
            // Buscar saldo por vencer
            const saldoPorVencerRaw = item['SALDO POR VENCER'] || 
                                     item['SALDO POR VENCER'] || 
                                     item['Saldo por vencer'] || 
                                     item['Saldo Por Vencer'] ||
                                     item['Saldo Por Vencer'] ||
                                     item['SALDO POR VENCER '] ||
                                     0;
            
            // Buscar saldo vencido
            const saldoVencidoRaw = item['SALDO VENCIDO'] || 
                                   item['SALDO VENCIDO'] || 
                                   item['Saldo vencido'] || 
                                   item['Saldo Vencido'] ||
                                   item['SALDO VENCIDO '] ||
                                   0;
            
            const saldo = parseMoney(saldoRaw);
            const saldoPorVencer = parseMoney(saldoPorVencerRaw);
            const saldoVencido = parseMoney(saldoVencidoRaw);
            
            const vendedor = item.Vendedor || item['Vendedor'] || 'Sin dato';
            const plaza = item.PLAZA || item['PLAZA'] || item.Plaza || 'Sin dato';
            
            // Leer fecha de vencimiento correctamente - probar diferentes nombres de columna
            const fechaVencimientoRaw = item['Fecha Vencimiento'] || 
                                       item['FechaVencimiento'] || 
                                       item['FECHA VENCIMIENTO'] ||
                                       item['Fecha de Vencimiento'] ||
                                       item['FECHA DE VENCIMIENTO'] ||
                                       '';
            let fechaVencimiento = '';
            if (fechaVencimientoRaw) {
              // Si es una fecha de Excel (número serial), convertirla
              if (typeof fechaVencimientoRaw === 'number') {
                // Fecha serial de Excel
                const excelEpoch = new Date(1899, 11, 30);
                const date = new Date(excelEpoch.getTime() + fechaVencimientoRaw * 86400000);
                fechaVencimiento = date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
              } else if (fechaVencimientoRaw instanceof Date) {
                fechaVencimiento = fechaVencimientoRaw.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
              } else {
                // Intentar parsear como fecha string
                const dateStr = String(fechaVencimientoRaw).trim();
                if (dateStr) {
                  // Si ya está en formato DD/MM/YY o similar, usarlo directamente
                  if (dateStr.match(/\d{2}\/\d{2}\/\d{2,4}/)) {
                    fechaVencimiento = dateStr;
                  } else {
                    // Intentar parsear
                    const parsed = new Date(dateStr);
                    if (!isNaN(parsed.getTime())) {
                      fechaVencimiento = parsed.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    } else {
                      fechaVencimiento = dateStr;
                    }
                  }
                }
              }
            }
            
            const totalSaldo = saldoPorVencer + saldoVencido || saldo || 0;
            
            return (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
                {/* Header con nombre y saldo (ocultar saldo en M2, M3, M4) */}
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-slate-800 text-sm uppercase flex-1 pr-2">{cliente}</h3>
                  {status !== 'M2' && status !== 'M3' && status !== 'M4' && (
                    <span className="font-mono font-bold text-green-600 text-lg whitespace-nowrap">
                      {formatCurrency(totalSaldo)}
                    </span>
                  )}
                </div>
                
                {/* Badge de estatus */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                    estatusPrincipal === 'M1' ? 'bg-amber-100 text-amber-700' : 
                    estatusPrincipal === 'M2' ? 'bg-blue-100 text-blue-700' :
                    estatusPrincipal === 'FPD CORRIENTE' ? 'bg-green-100 text-green-700' :
                    estatusPrincipal === 'FPD PÉRDIDA' ? 'bg-red-100 text-red-700' :
                    status === 'M3' ? 'bg-purple-100 text-purple-700' :
                    status === 'M4' ? 'bg-pink-100 text-pink-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {estatusPrincipal}
                  </span>
                </div>
                
                {/* Información del cliente */}
                <div className="space-y-2 mb-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">#{cuenta}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-slate-400" />
                    <span>{plaza}</span>
                  </div>
                  
                  {fechaVencimiento && (
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-slate-400" />
                      <span>Vence: {fechaVencimiento}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-slate-400" />
                    <span>{telefono || 'Sin dato'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-slate-400" />
                    <span>{vendedor}</span>
                  </div>
                </div>
                
                {/* Campos editables: Teléfono y Nota/Promesa de Pago */}
                <ClientContactEditor 
                  item={item} 
                  status={status}
                  telefono={telefono}
                  notaContacto={item.notaContacto || item['Nota Contacto'] || ''}
                  fechaPromesaPago={item.fechaPromesaPago || item['Fecha Promesa Pago'] || ''}
                  onUpdate={() => {
                    // Recargar datos después de actualizar
                    window.location.reload();
                  }}
                />
                
                {/* Saldos (ocultar en M2, M3, M4) */}
                {status !== 'M2' && status !== 'M3' && status !== 'M4' && (
                  <div className="mb-3 space-y-1 text-xs">
                    {saldoPorVencer > 0 && (
                      <div className="flex justify-between">
                        <span className="text-yellow-600">Por vencer:</span>
                        <span className="font-medium text-yellow-600">{formatCurrency(saldoPorVencer)}</span>
                      </div>
                    )}
                    {saldoVencido > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-600">Vencido:</span>
                        <span className="font-bold text-red-600">{formatCurrency(saldoVencido)}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Botones de acción */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => openWhatsApp(telefono, item, status)}
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
              </div>
            );
          })}
        </div>
      )}

      {/* Controles de Paginación */}
      {filteredData.length > itemsPerPage && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between flex-wrap gap-4">
          <div className="text-sm text-slate-600">
            Mostrando {startIndex + 1} - {Math.min(endIndex, filteredData.length)} de {filteredData.length} clientes
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

