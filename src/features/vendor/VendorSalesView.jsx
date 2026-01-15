import { useState, useEffect } from 'react';
import { Search, Phone, MessageCircle, CalendarDays, MapPin, User as UserIcon, Edit2, Save, X } from 'lucide-react';
import * as api from '../../api.js';
import { MODULES } from '../../utils/constants.js';
import { filterByVendor } from '../../utils/vendorFilter.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

// Componente para editar teléfono y notas (compartido con SalesStatusView)
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
    const normalize = (v) => String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

    const normStatus = normalize(status);
    const isCobranza = ['M1', 'M2', 'M3', 'M4'].includes(normStatus);

    // Obtener plantillas activas (sin filtro) y seleccionar con match tolerante
    const templates = await api.getTemplates();

    const candidates = new Set([normStatus]);
    if (isCobranza) {
      candidates.add('COBRANZA');
      candidates.add('GENERAL');
      // Si quieres que una plantilla "M1" sirva como fallback general de cobranza
      candidates.add('M1');
    }

    const activeTemplate = templates.find(t => {
      if (!t?.isActive) return false;
      const mod = normalize(t.module);
      return candidates.has(mod);
    });
    
    if (!activeTemplate) {
      // Si no hay plantilla, usar mensaje por defecto
      return `Hola ${client.nombre || 'cliente'}, te contactamos sobre tu cuenta ${client.cuenta || ''}.`;
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
    console.error('Error generando mensaje desde plantilla:', error);
    // Mensaje por defecto si hay error
    const nombre = client.Cliente || client['Cliente'] || client.nombre || 'Cliente';
    const cuenta = client.cuenta || client.CUENTA || client['CUENTA'] || 'N/A';
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
    const fecha = item[fechaField] || 
                  item['Fecha Instalacion'] || 
                  item['FechaInstalacion'] ||
                  item['FechaInstalación'] ||
                  '';
    
    if (fecha) {
      try {
        // Intentar parsear la fecha (puede venir en varios formatos)
        const fechaDate = new Date(fecha);
        if (!isNaN(fechaDate.getTime())) {
          const mes = fechaDate.getMonth(); // 0-11
          meses.push(mes);
        }
      } catch (e) {
        // Si no se puede parsear, intentar extraer el mes del string
        const fechaStr = String(fecha).toLowerCase();
        if (fechaStr.includes('octubre') || fechaStr.includes('oct')) meses.push(9);
        else if (fechaStr.includes('noviembre') || fechaStr.includes('nov')) meses.push(10);
        else if (fechaStr.includes('diciembre') || fechaStr.includes('dic')) meses.push(11);
        else if (fechaStr.includes('enero') || fechaStr.includes('ene')) meses.push(0);
        else if (fechaStr.includes('febrero') || fechaStr.includes('feb')) meses.push(1);
        else if (fechaStr.includes('marzo') || fechaStr.includes('mar')) meses.push(2);
        else if (fechaStr.includes('abril') || fechaStr.includes('abr')) meses.push(3);
        else if (fechaStr.includes('mayo')) meses.push(4);
        else if (fechaStr.includes('junio') || fechaStr.includes('jun')) meses.push(5);
        else if (fechaStr.includes('julio') || fechaStr.includes('jul')) meses.push(6);
        else if (fechaStr.includes('agosto') || fechaStr.includes('ago')) meses.push(7);
        else if (fechaStr.includes('septiembre') || fechaStr.includes('sep')) meses.push(8);
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
  
  return mesesEnEspanol[mesMasComun];
};

// Función para obtener el estatus FPD de un item
const getEstatusFPD = (item, status) => {
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
          return 'FPD CORRIENTE';
        } else if (campoNum === 1) {
          return status;
        }
      }
    }
    
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
    return status || 'M1';
  }
};

export default function VendorSalesView({ myName, status = 'M1' }) {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('');
  const [mesInstalacion, setMesInstalacion] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!user || !myName) return;
      
      try {
        console.log(`🔍 VendorSalesView - Cargando datos ${status} para:`, myName);
        
        // Determinar si el usuario es vendedor para filtrar
        const isVendor = user.role === 'vendedor' || user.role === 'user';
        const vendorFilter = isVendor ? (user.name || user.username) : null;
        
        // Cargar datos según el status (M1, M2, M3, M4) con filtro de vendedor si aplica
        let allData = [];
        if (status === 'M1') {
          allData = await api.getM1Master(vendorFilter);
        } else if (status === 'M2') {
          allData = await api.getM2Master(vendorFilter);
        } else if (status === 'M3') {
          allData = await api.getM3Master(vendorFilter);
        } else if (status === 'M4') {
          allData = await api.getM4Master(vendorFilter);
        } else {
          // Fallback a M1
          allData = await api.getM1Master(vendorFilter);
        }
        
        console.log(`📊 Total de registros ${status} cargados:`, allData.length);
        console.log(`🔍 Filtro de vendedor aplicado:`, vendorFilter || 'Ninguno (admin)');
        
        // Si es admin, no necesita filtrar de nuevo (ya viene filtrado del backend)
        // Si es vendedor, el backend ya filtró, pero por seguridad aplicamos el filtro de nuevo
        const myData = isVendor ? filterByVendor(allData, user) : allData;
        console.log(`✅ Registros ${status} filtrados para ${myName}:`, myData.length);
        
        const dataWithIds = myData.map(d => ({ id: d._id || d.id, ...d }));
        setData(dataWithIds);
        
        // Determinar el mes de instalación más común
        const mes = getMesInstalacion(dataWithIds, status);
        setMesInstalacion(mes);
      } catch (error) {
        console.error('❌ Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000); // Cada 30 segundos
    return () => clearInterval(interval);
  }, [myName, user, status]);

  // Filtrar por búsqueda y estatus
  const filteredData = data.filter(item => {
    // Filtro de búsqueda
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (item.Cliente || item['Cliente'] || '').toLowerCase().includes(searchLower) ||
      (item.CUENTA || item.Cuenta || item.cuenta || '').toString().includes(searchTerm) ||
      (item.Telefono1 || item.Telefono2 || item['Telefono1'] || item['Telefono2'] || '').toString().includes(searchTerm) ||
      (item.PLAZA || item['PLAZA'] || item.Plaza || '').toLowerCase().includes(searchLower);
    
    // Filtro de estatus (solo para M1 y M2)
    let matchesEstatus = true;
    // Aplicar filtro de estatus para M1, M2, M3, M4
    if ((status === 'M1' || status === 'M2' || status === 'M3' || status === 'M4') && filterEstatus) {
      const itemEstatusFPD = getEstatusFPD(item, status);
      matchesEstatus = itemEstatusFPD === filterEstatus;
    }
    
    return matchesSearch && matchesEstatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner message="Cargando tus clientes..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold mb-2">
          Mis Clientes {status}
          {mesInstalacion && <span className="text-slate-500 font-normal"> ({mesInstalacion})</span>}
        </h2>
        <p className="text-slate-600">
          {data.length === 0 
            ? `No tienes clientes ${status} asignados aún`
            : `Total de clientes ${status}: ${data.length}`
          }
        </p>
      </div>

      {/* Filtros de búsqueda y estatus */}
      {data.length > 0 && (
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
                value={filterEstatus}
                onChange={(e) => setFilterEstatus(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 min-w-[150px]"
              >
                <option value="">Todos los estatus</option>
                <option value={status}>{status}</option>
                <option value="FPD CORRIENTE">FPD CORRIENTE</option>
                {status === 'M1' && <option value="FPD PÉRDIDA">FPD PÉRDIDA</option>}
              </select>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Mostrando {filteredData.length} de {data.length} clientes
            {filterEstatus && ` • Filtrado: ${filterEstatus}`}
          </p>
        </div>
      )}

      {/* Lista de Cards */}
      {filteredData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredData.map((item) => {
            // Obtener valores con diferentes nombres posibles
            const cliente = item.Cliente || item['Cliente'] || 'Sin nombre';
            const cuenta = item.CUENTA || item.Cuenta || item.cuenta || '-';
            const telefono1 = item.Telefono1 || item['Telefono1'] || '';
            const telefono2 = item.Telefono2 || item['Telefono2'] || '';
            const telefono = telefono1 || telefono2;
            
            // Estatus FPD
            const estatusPrincipal = getEstatusFPD(item, status);
            let estatusColor = 'bg-amber-100 text-amber-700';
            if (estatusPrincipal === 'FPD PÉRDIDA') {
              estatusColor = 'bg-red-100 text-red-700';
            } else if (estatusPrincipal === 'FPD CORRIENTE') {
              estatusColor = 'bg-green-100 text-green-700';
            } else if (estatusPrincipal === 'M2') {
              estatusColor = 'bg-blue-100 text-blue-700';
            } else if (estatusPrincipal === 'M3') {
              estatusColor = 'bg-purple-100 text-purple-700';
            } else if (estatusPrincipal === 'M4') {
              estatusColor = 'bg-pink-100 text-pink-700';
            }
            
            // Leer saldos correctamente
            const parseMoney = (val) => {
              if (!val && val !== 0) return 0;
              if (typeof val === 'number') return val;
              const str = String(val).trim();
              if (!str || str === '-' || str === 'N/A') return 0;
              const cleaned = str.replace(/[$\s,]/g, '').replace(/[^0-9.-]+/g, '');
              const num = parseFloat(cleaned);
              return isNaN(num) ? 0 : num;
            };
            
            const saldoRaw = item.SALDO || item['SALDO'] || item.Saldo || item['Saldo'] || 0;
            const saldoPorVencerRaw = item['SALDO POR VENCER'] || item['SALDO POR VENCER'] || item['Saldo por vencer'] || item['Saldo Por Vencer'] || 0;
            const saldoVencidoRaw = item['SALDO VENCIDO'] || item['SALDO VENCIDO'] || item['Saldo vencido'] || item['Saldo Vencido'] || 0;
            
            const saldo = parseMoney(saldoRaw);
            const saldoPorVencer = parseMoney(saldoPorVencerRaw);
            const saldoVencido = parseMoney(saldoVencidoRaw);
            
            const vendedor = item.Vendedor || item['Vendedor'] || 'Sin dato';
            const plaza = item.PLAZA || item['PLAZA'] || item.Plaza || 'Sin dato';
            
            // Leer fecha de vencimiento
            const fechaVencimientoRaw = item['Fecha Vencimiento'] || item['FechaVencimiento'] || item['Fecha Vencimiento'] || '';
            let fechaVencimiento = '';
            if (fechaVencimientoRaw) {
              if (typeof fechaVencimientoRaw === 'number') {
                const excelEpoch = new Date(1899, 11, 30);
                const date = new Date(excelEpoch.getTime() + fechaVencimientoRaw * 86400000);
                fechaVencimiento = date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
              } else {
                const date = new Date(fechaVencimientoRaw);
                if (!isNaN(date.getTime())) {
                  fechaVencimiento = date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
                } else {
                  fechaVencimiento = String(fechaVencimientoRaw);
                }
              }
            }
            
            const totalSaldo = saldoPorVencer + saldoVencido || saldo || 0;
            
            return (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
                {/* Header con nombre y saldo (ocultar saldo en M2, M3, M4) */}
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-slate-800 text-sm uppercase flex-1 pr-2">{cliente}</h3>
                  {status === 'M1' && (
                    <span className="font-mono font-bold text-green-600 text-lg whitespace-nowrap">
                      {formatCurrency(totalSaldo)}
                    </span>
                  )}
                </div>

                {/* Estatus */}
                <div className="flex gap-2 mb-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${estatusColor}`}>
                    {estatusPrincipal}
                  </span>
                </div>

                {/* Detalles */}
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Cuenta:</span> #{cuenta}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-slate-400" />
                    <span>{plaza}</span>
                  </div>
                  {fechaVencimiento && (
                    <div className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-slate-400" />
                      <span>Vence: {fechaVencimiento}</span>
                    </div>
                  )}
                  {telefono && (
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-slate-400" />
                      <span>{telefono}</span>
                    </div>
                  )}
                  {vendedor && (
                    <div className="flex items-center gap-2">
                      <UserIcon size={16} className="text-slate-400" />
                      <span>{vendedor}</span>
                    </div>
                  )}
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

                {/* Saldos detallados (solo para M1) */}
                {status === 'M1' && (
                  <div className="mt-4 pt-3 border-t border-slate-100 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Por vencer:</span>
                      <span className="font-bold text-blue-600">{formatCurrency(saldoPorVencer)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Vencido:</span>
                      <span className="font-bold text-red-600">{formatCurrency(saldoVencido)}</span>
                    </div>
                  </div>
                )}

                {/* Acciones */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {telefono && (
                    <button
                      onClick={() => openWhatsApp(telefono, item, status)}
                      className="bg-green-500 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                    >
                      <MessageCircle size={16} /> WhatsApp
                    </button>
                  )}
                  {telefono && (
                    <a
                      href={`tel:${telefono}`}
                      className="bg-slate-100 text-slate-700 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                    >
                      <Phone size={16} /> Llamar
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-center py-8">
            No tienes clientes asignados aún
          </p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-center py-8">
            No se encontraron clientes que coincidan con tu búsqueda
          </p>
        </div>
      )}
    </div>
  );
}

