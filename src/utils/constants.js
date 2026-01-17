// Constantes globales de la aplicación
export const APP_ID = 'sales-master-production';

// La IA ahora se consume desde el backend (/api/assistant) para no exponer llaves en el navegador.
// Se deja por compatibilidad con código antiguo, pero debe permanecer vacío en producción.
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro'
];

export const USER_ROLES = {
  ADMIN: 'admin',
  ADMIN_GENERAL: 'admin_general',
  ADMIN_REGION: 'admin_region',
  VENDOR: 'vendor'
};

export const MODULES = {
  SALES: 'sales',
  INSTALL: 'install',
  ADMIN: 'admin'
};

export const COLLECTIONS = {
  SALES_MASTER: 'sales_master',
  INSTALL_MASTER: 'install_master',
  OPERACION_DIA: 'operacion_dia',
  SALES_REPORTS: 'sales_reports',
  IZZI_PACKAGES: 'izzi_packages',
  IZZI_PROMOCIONES: 'izzi_promociones',
  KNOWLEDGE_PDFS: 'knowledge_pdfs',
  USERS: 'users'
};

export const STATUS_TYPES = {
  M1: 'M1',
  M2: 'M2',
  M3: 'M3',
  M4: 'M4',
  FPD_CORRIENTE: 'FPD Corriente'
};

