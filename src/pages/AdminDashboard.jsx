import { useState } from 'react';
import { Shield, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { MODULES } from '../utils/constants.js';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import SalesModule from '../features/sales/SalesModule.jsx';
import InstallModule from '../features/install/InstallModule.jsx';
import OperacionModule from '../features/operacion/OperacionModule.jsx';
import UsersModule from '../features/users/UsersModule.jsx';
import PackagesModule from '../features/packages/PackagesModule.jsx';
import PromocionesModule from '../features/promociones/PromocionesModule.jsx';
import UploadModule from '../features/upload/UploadModule.jsx';
import TemplateModule from '../features/template/TemplateModule.jsx';
import DashboardModule from '../features/dashboard/DashboardModule.jsx';
import AccountModule from '../features/account/AccountModule.jsx';
import AssistantChatView from '../features/assistant/AssistantChatView.jsx';
import KnowledgeModule from '../features/knowledge/KnowledgeModule.jsx';
import AdminActivityDashboard from '../features/activity/AdminActivityDashboard.jsx';
import WhatsAppBulkModule from '../features/whatsapp/WhatsAppBulkModule.jsx';
import ClavesModule from '../features/claves/ClavesModule.jsx';

export default function AdminDashboard({ user }) {
  const { logout } = useAuth();
  // Rol 'usuarios' inicia en Administración > Usuarios; también puede entrar a Claves
  const initialModule =
    user?.role === 'usuarios'
      ? MODULES.ADMIN
      : user?.role === 'cobranza_mx'
        ? MODULES.SALES
        : user?.role === 'coordinador_claves'
          ? MODULES.CLAVES
          : MODULES.SALES;
  const initialTab =
    user?.role === 'usuarios'
      ? 'users'
      : user?.role === 'cobranza_mx'
        ? 'm1'
        : user?.role === 'coordinador_claves'
          ? 'claves'
          : 'dashboard';
  const [currentModule, setCurrentModule] = useState(initialModule);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Rol 'usuarios': Administración (crear usuarios) y Claves CVVEN
  const handleModuleChange = (module) => {
    if (user?.role === 'usuarios' && module !== MODULES.ADMIN && module !== MODULES.CLAVES) {
      return;
    }
    if (user?.role === 'cobranza_mx' && module !== MODULES.SALES) {
      // Cobranza MX: no permitir salir del módulo de Cobranza
      return;
    }
    if (user?.role === 'coordinador_claves' && module !== MODULES.CLAVES) {
      // Coordinador de claves: solo puede ver Claves CVVEN
      return;
    }
    setCurrentModule(module);
  };

  return (
    <AdminLayout
      user={user}
      currentModule={user?.role === 'coordinador_claves' ? MODULES.CLAVES : currentModule}
      setModule={handleModuleChange}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={logout}
    >
      {/* Asistente IA - Disponible para todos los roles */}
      {activeTab === 'chat' && <AssistantChatView />}

      {/* Dashboard - No disponible para rol 'usuarios' */}
      {activeTab === 'dashboard' && user?.role !== 'usuarios' && user?.role !== 'cobranza_mx' && <DashboardModule currentModule={currentModule} />}
      
      {/* Módulo de Cobranza - Para admin, admin_general, director, mesa_control y regionales */}
      {currentModule === MODULES.SALES && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales' || user?.role === 'cobranza_mx') && (
        <>
          {(activeTab === 'm0' || activeTab === 'm1' || activeTab === 'm2' || activeTab === 'm3' || activeTab === 'm4' || activeTab === 'm5' || activeTab === 'm6' || activeTab === 'view') && (
            <SalesModule activeTab={activeTab} />
          )}
          {activeTab === 'upload' && <UploadModule currentModule={currentModule} />}
          {activeTab === 'whatsapp' && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'mesa_control') && (
            <WhatsAppBulkModule />
          )}
        </>
      )}

      {/* Módulo de Instalaciones - Disponible para admin, admin_general, director, mesa_control y regionales */}
      {currentModule === MODULES.INSTALL && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales') && (
        <>
          {activeTab === 'operacion' && <OperacionModule />}
          {activeTab === 'packages' && <PackagesModule />}
          {activeTab === 'upload' && <UploadModule currentModule={currentModule} />}
          {activeTab === 'clients' && <InstallModule activeTab={activeTab} />}
        </>
      )}

      {/* Módulo de Claves CVVEN — misma base para admin y rol usuarios */}
      {currentModule === MODULES.CLAVES && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'coordinador_claves' || user?.role === 'usuarios') && activeTab !== 'chat' && (
        <ClavesModule />
      )}

      {/* Módulo de Administración */}
      {currentModule === MODULES.ADMIN && (
        <>
          {activeTab === 'account' && <AccountModule />}
          {activeTab === 'users' && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'usuarios') && <UsersModule />}
          {activeTab === 'template' && (user?.role === 'admin' || user?.role === 'admin_general') && <TemplateModule />}
          {activeTab === 'packages' && (user?.role === 'admin' || user?.role === 'admin_general') && <PackagesModule />}
          {activeTab === 'promociones' && (user?.role === 'admin' || user?.role === 'admin_general') && <PromocionesModule />}
          {activeTab === 'knowledge' && (user?.role === 'admin' || user?.role === 'admin_general') && <KnowledgeModule />}
          {activeTab === 'actividad' && (user?.role === 'admin' || user?.role === 'admin_general') && <AdminActivityDashboard />}
        </>
      )}
    </AdminLayout>
  );
}

