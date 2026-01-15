import { useState } from 'react';
import { Shield, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { MODULES } from '../utils/constants.js';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import SalesModule from '../features/sales/SalesModule.jsx';
import InstallModule from '../features/install/InstallModule.jsx';
import OperacionModule from '../features/operacion/OperacionModule.jsx';
import ReportsModule from '../features/reports/ReportsModule.jsx';
import UsersModule from '../features/users/UsersModule.jsx';
import PackagesModule from '../features/packages/PackagesModule.jsx';
import PromocionesModule from '../features/promociones/PromocionesModule.jsx';
import UploadModule from '../features/upload/UploadModule.jsx';
import TemplateModule from '../features/template/TemplateModule.jsx';
import DashboardModule from '../features/dashboard/DashboardModule.jsx';
import AccountModule from '../features/account/AccountModule.jsx';

export default function AdminDashboard({ user }) {
  const { logout } = useAuth();
  // Si es rol 'usuarios', iniciar directamente en Administración > Usuarios
  // Si es rol 'usuarios', forzar que siempre esté en Administración
  const initialModule = user?.role === 'usuarios' ? MODULES.ADMIN : MODULES.SALES;
  const initialTab = user?.role === 'usuarios' ? 'users' : 'dashboard';
  const [currentModule, setCurrentModule] = useState(initialModule);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Si el rol es 'usuarios' y cambia a otro módulo, forzar volver a Administración
  const handleModuleChange = (module) => {
    if (user?.role === 'usuarios' && module !== MODULES.ADMIN) {
      // No permitir cambiar a otros módulos
      return;
    }
    setCurrentModule(module);
  };

  return (
    <AdminLayout
      user={user}
      currentModule={user?.role === 'usuarios' ? MODULES.ADMIN : currentModule}
      setModule={handleModuleChange}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={logout}
    >
      {/* Dashboard - No disponible para rol 'usuarios' */}
      {activeTab === 'dashboard' && user?.role !== 'usuarios' && <DashboardModule currentModule={currentModule} />}
      
      {/* Módulo de Cobranza - Para admin, admin_general, director, mesa_control y regionales */}
      {currentModule === MODULES.SALES && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales') && (
        <>
          {(activeTab === 'm1' || activeTab === 'm2' || activeTab === 'm3' || activeTab === 'm4' || activeTab === 'view') && (
            <SalesModule activeTab={activeTab} />
          )}
          {activeTab === 'upload' && <UploadModule currentModule={currentModule} />}
        </>
      )}

      {/* Módulo de Instalaciones - Disponible para admin, admin_general, director, mesa_control y regionales */}
      {currentModule === MODULES.INSTALL && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales') && (
        <>
          {activeTab === 'operacion' && <OperacionModule />}
          {activeTab === 'reports' && <ReportsModule />}
          {activeTab === 'packages' && <PackagesModule />}
          {activeTab === 'upload' && <UploadModule currentModule={currentModule} />}
          {activeTab === 'clients' && <InstallModule activeTab={activeTab} />}
        </>
      )}

      {/* Módulo de Administración */}
      {currentModule === MODULES.ADMIN && (
        <>
          {activeTab === 'account' && <AccountModule />}
          {activeTab === 'users' && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'usuarios') && <UsersModule />}
          {activeTab === 'template' && (user?.role === 'admin' || user?.role === 'admin_general') && <TemplateModule />}
          {activeTab === 'promociones' && (user?.role === 'admin' || user?.role === 'admin_general') && <PromocionesModule />}
        </>
      )}
    </AdminLayout>
  );
}

