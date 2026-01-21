// Servicio API para comunicarse con el backend MongoDB
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const AUTH_STORAGE_KEY = 'ss_auth_v1';

function getAuthToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

// Función auxiliar para hacer peticiones
async function apiRequest(endpoint, options = {}) {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      // Si no está autenticado, limpiar sesión local para forzar login
      if (response.status === 401) {
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {
          // ignore
        }
        try {
          // Permite que AuthContext fuerce logout y evite estados "medio logueados"
          window.dispatchEvent(new Event('ss:unauthorized'));
        } catch {
          // ignore
        }
      }
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { 
          error: `Error ${response.status}: ${response.statusText}`,
          message: `El servidor respondió con código ${response.status}`
        };
      }
      
      const error = new Error(errorData.error || errorData.message || `Error ${response.status}`);
      error.status = response.status;
      error.details = errorData;
      throw error;
    }

    return await response.json();
  } catch (error) {
    console.error('Error en API request:', error);
    console.error('Endpoint:', endpoint);
    console.error('Error completo:', error);
    
    // Si es un error de red, agregar más información
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('No se pudo conectar al servidor. Verifica que el backend esté en línea y accesible.');
    }
    
    throw error;
  }
}

// ========== USUARIOS ==========
export async function loginUser(username, password) {
  return apiRequest('/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function createUser(username, password, name, role, email = '', region = '') {
  return apiRequest('/users/create', {
    method: 'POST',
    body: JSON.stringify({ username, password, name, role, email, region }),
  });
}

export async function getAllUsers() {
  return apiRequest('/users');
}

export async function deleteUser(userId) {
  return apiRequest(`/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function updateUserPassword(userId, password) {
  return apiRequest(`/users/${userId}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
}

export async function updateUser(userId, updates) {
  return apiRequest(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// ========== SALES MASTER ==========
export async function getSalesMaster() {
  return apiRequest('/sales');
}

export async function getSalesMasterCount() {
  const result = await apiRequest('/sales/count');
  return result.count;
}

export async function bulkUpsertSales(data, updateExisting = true) {
  return apiRequest('/sales/bulk', {
    method: 'POST',
    body: JSON.stringify({ data, updateExisting }),
  });
}

export async function deleteAllSales() {
  return apiRequest('/sales/all', {
    method: 'DELETE',
  });
}

export async function updateSale(id, data) {
  return apiRequest(`/sales/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ========== INSTALL MASTER ==========
export async function getInstallMaster() {
  return apiRequest('/install');
}

export async function getInstallMasterCount() {
  const result = await apiRequest('/install/count');
  return result.count;
}

export async function bulkUpsertInstall(data, updateExisting = true) {
  return apiRequest('/install/bulk', {
    method: 'POST',
    body: JSON.stringify({ data, updateExisting }),
  });
}

export async function deleteAllInstall() {
  return apiRequest('/install/all', {
    method: 'DELETE',
  });
}

export async function updateInstall(id, data) {
  return apiRequest(`/install/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ========== OPERACION DIA ==========
export async function getOperacionDia(vendedor = null) {
  const endpoint = vendedor ? `/operacion?vendedor=${encodeURIComponent(vendedor)}` : '/operacion';
  return apiRequest(endpoint);
}

// Para exportar (permite limit=0 para traer todo, con cap del backend)
export async function getOperacionDiaExport({ vendedor = null, limit = 0 } = {}) {
  const params = new URLSearchParams();
  if (vendedor) params.set('vendedor', vendedor);
  if (limit !== undefined && limit !== null) params.set('limit', String(limit));
  const qs = params.toString();
  const endpoint = qs ? `/operacion?${qs}` : '/operacion';
  return apiRequest(endpoint);
}

export async function updateOperacionVendedor(operacionId, vendedor, usuarioModificadoPor = null, usuarioModificadoPorNombre = null) {
  return apiRequest(`/operacion/${operacionId}/vendedor`, {
    method: 'PUT',
    body: JSON.stringify({ 
      vendedor,
      usuarioModificadoPor,
      usuarioModificadoPorNombre
    }),
  });
}

export async function getOperacionVendors() {
  return apiRequest('/operacion/vendors');
}

export async function getOperacionDiaCount() {
  const result = await apiRequest('/operacion/count');
  return result.count;
}

export async function bulkUpsertOperacion(data, updateExisting = true) {
  return apiRequest('/operacion/bulk', {
    method: 'POST',
    body: JSON.stringify({ data, updateExisting }),
  });
}

export async function deleteAllOperacion() {
  return apiRequest('/operacion/all', {
    method: 'DELETE',
  });
}

export async function updateOperacion(id, data) {
  return apiRequest(`/operacion/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ========== REPORTS ==========
export async function getSalesReports() {
  return apiRequest('/reports');
}

export async function createSalesReport(title, description, data, createdBy, module) {
  return apiRequest('/reports', {
    method: 'POST',
    body: JSON.stringify({ title, description, data, createdBy, module }),
  });
}

export async function deleteAllReports() {
  return apiRequest('/reports/all', {
    method: 'DELETE',
  });
}

// ========== PACKAGES ==========
export async function getPackages() {
  return apiRequest('/packages');
}

export async function createPackage(name, price, description = '', codigo = '', tipo = '') {
  return apiRequest('/packages', {
    method: 'POST',
    body: JSON.stringify({ name, price, description, codigo, tipo }),
  });
}

export async function bulkCreatePackages(packages) {
  return apiRequest('/packages/bulk', {
    method: 'POST',
    body: JSON.stringify({ packages }),
  });
}

export async function deletePackage(id) {
  return apiRequest(`/packages/${id}`, {
    method: 'DELETE',
  });
}

// ========== PROMOCIONES ==========
export async function getPromociones() {
  return apiRequest('/promociones');
}

export async function createPromocion(title, description, validFrom, validTo) {
  return apiRequest('/promociones', {
    method: 'POST',
    body: JSON.stringify({ title, description, validFrom, validTo }),
  });
}

export async function deletePromocion(id) {
  return apiRequest(`/promociones/${id}`, {
    method: 'DELETE',
  });
}

// ========== PDFs ==========
export async function getPDFs() {
  return apiRequest('/pdfs');
}

export async function createPDF(name, url, description = '') {
  return apiRequest('/pdfs', {
    method: 'POST',
    body: JSON.stringify({ name, url, description }),
  });
}

export async function deletePDF(id) {
  return apiRequest(`/pdfs/${id}`, {
    method: 'DELETE',
  });
}

// ========== HEALTH CHECK ==========
export async function checkHealth() {
  return apiRequest('/health');
}

// ========== ACTIVIDAD / AUDITORÍA ==========
export async function getCobranzaLastUpdate() {
  return apiRequest('/activity/cobranza/last-update');
}

export async function getAdminActivitySummary() {
  return apiRequest('/activity/admin/summary');
}

export async function logWhatsAppEvent({ module = 'cobranza', status = '', cuenta = '', phone = '' } = {}) {
  return apiRequest('/activity/whatsapp', {
    method: 'POST',
    body: JSON.stringify({ module, status, cuenta, phone }),
  });
}

// ========== M1 MASTER ==========
export async function getM1Master(vendedor = null) {
  const endpoint = vendedor ? `/m1?vendedor=${encodeURIComponent(vendedor)}` : '/m1';
  return apiRequest(endpoint);
}

export async function getM1MasterCount(estatusFPD = 'M1') {
  const result = await apiRequest(`/m1/count?estatusFPD=${estatusFPD}`);
  return result.count;
}

export async function bulkUpsertM1(data, updateExisting = true, replaceAll = false) {
  return apiRequest('/m1/bulk', {
    method: 'POST',
    body: JSON.stringify({ data, updateExisting, replaceAll }),
  });
}

export async function getM1ByCuenta(cuenta) {
  return apiRequest(`/m1/cuenta/${encodeURIComponent(cuenta)}`);
}

export async function updateM1Estado(id, estado) {
  return apiRequest(`/m1/${id}/estado`, {
    method: 'PUT',
    body: JSON.stringify({ estado }),
  });
}

export async function updateM1Contacto(id, telefono, notaContacto, fechaPromesaPago) {
  return apiRequest(`/m1/${id}/contacto`, {
    method: 'PUT',
    body: JSON.stringify({ telefono, notaContacto, fechaPromesaPago }),
  });
}

export async function deleteAllM1() {
  return apiRequest('/m1/all', { method: 'DELETE' });
}

// ========== M2 MASTER ==========
export async function getM2Master(vendedor = null) {
  const endpoint = vendedor ? `/m2?vendedor=${encodeURIComponent(vendedor)}` : '/m2';
  return apiRequest(endpoint);
}

export async function getM2MasterCount(estatusFPD = null, vendedor = null) {
  let endpoint = '/m2/count';
  const params = [];
  if (estatusFPD) {
    params.push(`estatusFPD=${encodeURIComponent(estatusFPD)}`);
  }
  if (vendedor) {
    params.push(`vendedor=${encodeURIComponent(vendedor)}`);
  }
  if (params.length > 0) {
    endpoint += `?${params.join('&')}`;
  }
  console.log(`🔍 Llamando a ${endpoint} para conteo M2`);
  const result = await apiRequest(endpoint);
  console.log(`📊 Resultado del conteo M2:`, result);
  return result.count;
}

export async function bulkUpsertM2(data, updateExisting = true, replaceAll = false) {
  return apiRequest('/m2/bulk', {
    method: 'POST',
    body: JSON.stringify({ data, updateExisting, replaceAll }),
  });
}

export async function updateM2Estado(id, estado) {
  return apiRequest(`/m2/${id}/estado`, {
    method: 'PUT',
    body: JSON.stringify({ estado }),
  });
}

export async function updateM2Contacto(id, telefono, notaContacto, fechaPromesaPago) {
  return apiRequest(`/m2/${id}/contacto`, {
    method: 'PUT',
    body: JSON.stringify({ telefono, notaContacto, fechaPromesaPago }),
  });
}

export async function deleteAllM2() {
  return apiRequest('/m2/all', { method: 'DELETE' });
}

// ========== M3 MASTER ==========
export async function getM3Master(vendedor = null) {
  const endpoint = vendedor ? `/m3?vendedor=${encodeURIComponent(vendedor)}` : '/m3';
  return apiRequest(endpoint);
}

export async function getM3MasterCount(estatusFPD = null, vendedor = null) {
  let endpoint = '/m3/count';
  const params = [];
  if (estatusFPD) {
    params.push(`estatusFPD=${encodeURIComponent(estatusFPD)}`);
  }
  if (vendedor) {
    params.push(`vendedor=${encodeURIComponent(vendedor)}`);
  }
  if (params.length > 0) {
    endpoint += `?${params.join('&')}`;
  }
  console.log(`🔍 Llamando a ${endpoint} para conteo M3`);
  const result = await apiRequest(endpoint);
  console.log(`📊 Resultado del conteo M3:`, result);
  return result.count;
}

export async function bulkUpsertM3(data, updateExisting = true, replaceAll = false) {
  return apiRequest('/m3/bulk', {
    method: 'POST',
    body: JSON.stringify({ data, updateExisting, replaceAll }),
  });
}

export async function updateM3Estado(id, estado) {
  return apiRequest(`/m3/${id}/estado`, {
    method: 'PUT',
    body: JSON.stringify({ estado }),
  });
}

export async function updateM3Contacto(id, telefono, notaContacto, fechaPromesaPago) {
  return apiRequest(`/m3/${id}/contacto`, {
    method: 'PUT',
    body: JSON.stringify({ telefono, notaContacto, fechaPromesaPago }),
  });
}

export async function deleteAllM3() {
  return apiRequest('/m3/all', { method: 'DELETE' });
}

// ========== M4 MASTER ==========
export async function getM4Master(vendedor = null) {
  const endpoint = vendedor ? `/m4?vendedor=${encodeURIComponent(vendedor)}` : '/m4';
  return apiRequest(endpoint);
}

export async function getM4MasterCount(estatusFPD = null, vendedor = null) {
  let endpoint = '/m4/count';
  const params = [];
  if (estatusFPD) {
    params.push(`estatusFPD=${encodeURIComponent(estatusFPD)}`);
  }
  if (vendedor) {
    params.push(`vendedor=${encodeURIComponent(vendedor)}`);
  }
  if (params.length > 0) {
    endpoint += `?${params.join('&')}`;
  }
  console.log(`🔍 Llamando a ${endpoint} para conteo M4`);
  const result = await apiRequest(endpoint);
  console.log(`📊 Resultado del conteo M4:`, result);
  return result.count;
}

export async function bulkUpsertM4(data, updateExisting = true, replaceAll = false) {
  return apiRequest('/m4/bulk', {
    method: 'POST',
    body: JSON.stringify({ data, updateExisting, replaceAll }),
  });
}

export async function updateM4Estado(id, estado) {
  return apiRequest(`/m4/${id}/estado`, {
    method: 'PUT',
    body: JSON.stringify({ estado }),
  });
}

export async function updateM4Contacto(id, telefono, notaContacto, fechaPromesaPago) {
  return apiRequest(`/m4/${id}/contacto`, {
    method: 'PUT',
    body: JSON.stringify({ telefono, notaContacto, fechaPromesaPago }),
  });
}

export async function deleteAllM4() {
  return apiRequest('/m4/all', { method: 'DELETE' });
}

// ========== TEMPLATES ==========
export async function getTemplates(module = null) {
  // Si se especifica un módulo, buscar plantillas para ese módulo
  // Si no, obtener todas las plantillas activas
  const endpoint = module ? `/templates?module=${encodeURIComponent(module)}` : '/templates';
  const templates = await apiRequest(endpoint);
  console.log('📋 Plantillas obtenidas del API:', templates.length, 'para módulo:', module || 'todos');
  return templates;
}

export async function getTemplate(id) {
  return apiRequest(`/templates/${id}`);
}

export async function createTemplate(name, module, content, videoUrl = '', variables = [], isActive = true, createdBy = 'admin') {
  return apiRequest('/templates', {
    method: 'POST',
    body: JSON.stringify({ name, module, content, videoUrl, variables, isActive, createdBy }),
  });
}

export async function updateTemplate(id, name, module, content, videoUrl = '', variables = [], isActive = true) {
  return apiRequest(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, module, content, videoUrl, variables, isActive }),
  });
}

export async function deleteTemplate(id) {
  return apiRequest(`/templates/${id}`, {
    method: 'DELETE',
  });
}

// ========== ASISTENTE IA (GEMA CENTRAL) ==========
export async function assistantKnowledgeSummary() {
  return apiRequest('/assistant/knowledge/summary');
}

export async function assistantKnowledgeRefresh() {
  return apiRequest('/assistant/knowledge/refresh', { method: 'POST' });
}

export async function assistantChat(message, history = []) {
  return apiRequest('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history })
  });
}

export async function assistantUsageSummary() {
  return apiRequest('/assistant/usage/summary');
}

// ========== CONOCIMIENTO (PDF) ==========
export async function uploadKnowledgePDF(file, name = '', description = '') {
  const token = (() => {
    try {
      const raw = localStorage.getItem('ss_auth_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.token || null;
    } catch { return null; }
  })();

  const form = new FormData();
  form.append('pdf', file);
  if (name) form.append('name', name);
  if (description) form.append('description', description);

  const res = await fetch(`${API_BASE_URL}/pdfs/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: form
  });

  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { err = null; }
    throw new Error(err?.error || `Error ${res.status}`);
  }

  return await res.json();
}

export async function updatePDF(id, updates) {
  return apiRequest(`/pdfs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}
