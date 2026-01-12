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

export default function AdminDashboard({ user }) {
  const { logout } = useAuth();
  const [currentModule, setCurrentModule] = useState(MODULES.SALES);
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <AdminLayout
      user={user}
      currentModule={currentModule}
      setModule={setCurrentModule}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={logout}
    >
      {/* Dashboard - Siempre disponible */}
      {activeTab === 'dashboard' && <DashboardModule currentModule={currentModule} />}
      
      {/* Módulo de Cobranza */}
      {currentModule === MODULES.SALES && (
        <>
          {(activeTab === 'm1' || activeTab === 'm2' || activeTab === 'm3' || activeTab === 'm4' || activeTab === 'view') && (
            <SalesModule activeTab={activeTab} />
          )}
          {activeTab === 'upload' && <UploadModule currentModule={currentModule} />}
        </>
      )}

      {/* Módulo de Instalaciones */}
      {currentModule === MODULES.INSTALL && (
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
          {activeTab === 'users' && <UsersModule />}
          {activeTab === 'template' && <TemplateModule />}
          {activeTab === 'promociones' && <PromocionesModule />}
        </>
      )}
    </AdminLayout>
  );
}

