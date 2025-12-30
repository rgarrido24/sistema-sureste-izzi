// Servicio API para comunicarse con el backend MongoDB
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Función auxiliar para hacer peticiones
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Error del servidor' }));
      throw new Error(error.error || `Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error en API request:', error);
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

export async function createUser(username, password, name, role, email = '') {
  return apiRequest('/users/create', {
    method: 'POST',
    body: JSON.stringify({ username, password, name, role, email }),
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
export async function getOperacionDia() {
  return apiRequest('/operacion');
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

export async function createPackage(name, price, description = '') {
  return apiRequest('/packages', {
    method: 'POST',
    body: JSON.stringify({ name, price, description }),
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

