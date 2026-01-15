import { LogOut } from 'lucide-react';
import { MODULES } from '../../utils/constants.js';
import RGOLogo from '../common/RGOLogo.jsx';

export default function AdminLayout({ 
  user, 
  currentModule, 
  setModule, 
  activeTab, 
  setActiveTab, 
  onLogout, 
  children 
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-2xl shadow-md border border-slate-200">
          <div className="flex items-center gap-4">
            {/* Logo RGO */}
            <div className="flex items-center gap-3">
              <RGOLogo size={50} showText={false} />
              <div>
                {/* Mostrar mensaje de bienvenida para director, mesa_control y regionales */}
                {(user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales') ? (
                  <>
                    <h1 className="text-xl font-bold text-slate-800">Bienvenido, {user?.name || 'Usuario'}</h1>
                    <p className="text-sm text-slate-500">
                      {user?.role === 'director' && 'Panel de Director'}
                      {user?.role === 'mesa_control' && 'Panel de Mesa de Control'}
                      {user?.role === 'regionales' && `Panel Regional - ${user?.region || 'Región'}`}
                    </p>
                  </>
                ) : (
                  <h1 className="text-lg font-bold text-[#1e3a8a] flex items-center gap-2">
                    Admin
                  </h1>
                )}
              </div>
            </div>
            <div className="flex bg-gradient-to-r from-slate-100 to-slate-50 p-1 rounded-lg border border-slate-200">
              {(user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales') && (
                <button 
                  onClick={() => setModule(MODULES.SALES)} 
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                    currentModule === MODULES.SALES 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb]'
                  }`}
                >
                  Cobranza
                </button>
              )}
              {/* El rol 'usuarios' no ve Instalaciones, solo Administración */}
              {(user?.role !== 'usuarios' && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales')) && (
                <button 
                  onClick={() => setModule(MODULES.INSTALL)} 
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                    currentModule === MODULES.INSTALL 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb]'
                  }`}
                >
                  Instalaciones
                </button>
              )}
              {/* Administración (Mi Cuenta) disponible para todos los roles de panel */}
              {(user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'usuarios' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales') && (
                <button 
                  onClick={() => {
                    setModule(MODULES.ADMIN);
                    // Por defecto: Mi Cuenta. Excepción: rol 'usuarios' inicia en Users.
                    if (user?.role === 'usuarios') setActiveTab('users');
                    else setActiveTab('account');
                  }}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                    currentModule === MODULES.ADMIN 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb]'
                  }`}
                >
                  Administración
                </button>
              )}
            </div>
          </div>
          
          <button 
            onClick={onLogout} 
            className="text-slate-600 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200 mb-6">
          <div className="flex flex-wrap gap-2">
            {/* Dashboard - Visible excepto para rol 'usuarios' */}
            {user?.role !== 'usuarios' && (
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'dashboard' 
                    ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-lg' 
                    : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                }`}
              >
                Dashboard
              </button>
            )}

            {/* Tabs de Cobranza - Para admin, admin_general, director, mesa_control y regionales */}
            {currentModule === MODULES.SALES && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales') && (
              <>
                <button 
                  onClick={() => setActiveTab('m1')} 
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    activeTab === 'm1' 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                  }`}
                >
                  M1
                </button>
                <button 
                  onClick={() => setActiveTab('m2')} 
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    activeTab === 'm2' 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                  }`}
                >
                  M2
                </button>
                <button 
                  onClick={() => setActiveTab('m3')} 
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    activeTab === 'm3' 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                  }`}
                >
                  M3
                </button>
                <button 
                  onClick={() => setActiveTab('m4')} 
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    activeTab === 'm4' 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                  }`}
                >
                  M4
                </button>
                {(user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'mesa_control') && (
                  <button 
                    onClick={() => setActiveTab('upload')} 
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'upload' 
                        ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                        : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                    }`}
                  >
                    Cargar
                  </button>
                )}
                <button 
                  onClick={() => setActiveTab('view')} 
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'view' 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                  }`}
                >
                  Ver BD
                </button>
              </>
            )}
            
            {/* Tabs de Instalaciones - Disponible para admin, admin_general, director, mesa_control y regionales */}
            {currentModule === MODULES.INSTALL && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales') && (
              <>
                <button 
                  onClick={() => setActiveTab('operacion')} 
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'operacion' 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                  }`}
                >
                  Operación
                </button>
                <button 
                  onClick={() => setActiveTab('packages')} 
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'packages' 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                  }`}
                >
                  Paquetes
                </button>
                {(user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'mesa_control') && (
                  <button 
                    onClick={() => setActiveTab('upload')} 
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'upload' 
                        ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                        : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                    }`}
                  >
                    Cargar
                  </button>
                )}
              </>
            )}

            {/* Tabs de Administración */}
            {currentModule === MODULES.ADMIN && (
              <>
                <button 
                  onClick={() => setActiveTab('account')} 
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'account' 
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                      : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                  }`}
                >
                  Mi Cuenta
                </button>
                {(user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'usuarios') && (
                  <button 
                    onClick={() => setActiveTab('users')} 
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'users' 
                        ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                        : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                    }`}
                  >
                    Usuarios
                  </button>
                )}
                {/* El rol 'usuarios' solo ve la pestaña de Usuarios */}
                {user?.role !== 'usuarios' && (user?.role === 'admin' || user?.role === 'admin_general') && (
                  <>
                    <button 
                      onClick={() => setActiveTab('template')} 
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'template' 
                          ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                          : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                      }`}
                    >
                      Plantilla
                    </button>
                    <button 
                      onClick={() => setActiveTab('promociones')} 
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'promociones' 
                          ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white shadow-md' 
                          : 'text-slate-600 hover:text-[#2563eb] hover:bg-slate-50'
                      }`}
                    >
                      Promociones
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}

