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
import CapacitacionesModule from '../features/capacitaciones/CapacitacionesModule.jsx';
import CapacitacionesIzziModule from '../features/capacitaciones-izzi/CapacitacionesIzziModule.jsx';
import ImagenesVentaModule from '../features/imagenes-venta/ImagenesVentaModule.jsx';
import RankingVentaDirectaModule from '../features/ranking/RankingVentaDirectaModule.jsx';
import PuntosModule from '../features/puntos/PuntosModule.jsx';
import ComisionesModule from '../features/comisiones/ComisionesModule.jsx';
import ArranqueModule from '../features/arranque/ArranqueModule.jsx';
import EstatusModule from '../features/estatus/EstatusModule.jsx';

export default function AdminDashboard({ user }) {
  const { logout } = useAuth();
  // Rol 'usuarios' inicia en Administración > Usuarios; también puede entrar a Claves
  const initialModule =
    user?.role === 'usuarios'
      ? MODULES.ADMIN
      : user?.role === 'cobranza_mx' || user?.role === 'supervisor'
        ? MODULES.SALES
        : user?.role === 'coordinador_claves'
          ? MODULES.CLAVES
          : user?.role === 'marketing'
            ? MODULES.ARRANQUE
            : user?.role === 'reclutador'
            ? MODULES.ARRANQUE
            : MODULES.SALES;
  const initialTab =
    user?.role === 'usuarios'
      ? 'users'
      : user?.role === 'cobranza_mx' || user?.role === 'supervisor'
        ? 'm1'
        : user?.role === 'coordinador_claves'
          ? 'claves'
          : user?.role === 'marketing'
            ? 'arranque'
            : user?.role === 'reclutador'
            ? 'arranque'
            : 'dashboard';
  const [currentModule, setCurrentModule] = useState(initialModule);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Rol 'usuarios': Administración (crear usuarios) y Claves CVVEN
  const handleModuleChange = (module) => {
    if (user?.role === 'usuarios' && module !== MODULES.ADMIN && module !== MODULES.CLAVES) {
      return;
    }
    if (user?.role === 'cobranza_mx' && module !== MODULES.SALES && module !== MODULES.CAPACITACIONES && module !== MODULES.CAPACITACIONES_IZZI) {
      // Cobranza MX: no permitir salir del módulo de Cobranza (excepto Capacitaciones)
      return;
    }
    if (user?.role === 'supervisor' && module !== MODULES.SALES && module !== MODULES.ADMIN && module !== MODULES.CAPACITACIONES && module !== MODULES.CAPACITACIONES_IZZI && module !== MODULES.IMAGENES_VENTA && module !== MODULES.RANKING && module !== MODULES.PUNTOS && module !== MODULES.ARRANQUE) {
      return;
    }
    if (user?.role === 'coordinador_claves' && module !== MODULES.CLAVES) {
      // Coordinador de claves: solo puede ver Claves CVVEN
      return;
    }
    if (user?.role === 'marketing' && module !== MODULES.ADMIN && module !== MODULES.IMAGENES_VENTA && module !== MODULES.CAPACITACIONES && module !== MODULES.CAPACITACIONES_IZZI && module !== MODULES.ARRANQUE) {
      // Marketing: solo Conocimiento (dentro de Administración), Imágenes y Capacitaciones
      return;
    }
    if (user?.role === 'reclutador' && ![MODULES.ARRANQUE, MODULES.IMAGENES_VENTA, MODULES.PUNTOS, MODULES.CAPACITACIONES, MODULES.CAPACITACIONES_IZZI, MODULES.ADMIN].includes(module)) {
      // Reclutador: solo Arranque (sus reclutados), Imágenes, Puntos, Capacitaciones y Mi Cuenta
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
      {activeTab === 'dashboard' && user?.role !== 'usuarios' && user?.role !== 'cobranza_mx' && user?.role !== 'supervisor' && <DashboardModule currentModule={currentModule} />}
      
      {/* Módulo de Cobranza - Para admin, admin_general, director, mesa_control, regionales, cobranza_mx y supervisor */}
      {currentModule === MODULES.SALES && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control' || user?.role === 'regionales' || user?.role === 'cobranza_mx' || user?.role === 'supervisor') && (
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

      {/* Calendario de capacitaciones — visible para todos los roles del panel admin */}
      {currentModule === MODULES.CAPACITACIONES && <CapacitacionesModule />}

      {/* Capacitaciones de Izzi: abiertas para todos los roles con capacitaciones */}
      {currentModule === MODULES.CAPACITACIONES_IZZI && <CapacitacionesIzziModule />}

      {/* Arranque de Redes Sociales: seguimiento para staff/marketing */}
      {currentModule === MODULES.ARRANQUE && <ArranqueModule />}

      {/* Imágenes de venta — visible para todos los roles del panel admin */}
      {currentModule === MODULES.IMAGENES_VENTA && <ImagenesVentaModule />}

      {/* Ranking de venta directa — visible para todos los roles del panel admin */}
      {currentModule === MODULES.RANKING && <RankingVentaDirectaModule />}

      {/* Puntos de venta — visible para todos los roles del panel admin */}
      {currentModule === MODULES.PUNTOS && <PuntosModule />}

      {/* Factor de comisión — NUNCA para vendedor, solo admin/director/supervisor/regionales */}
      {currentModule === MODULES.COMISIONES && (user?.role === 'admin' || user?.role === 'admin_general') && (
        <ComisionesModule />
      )}

      {/* Estatus de órdenes Izzi (captura del portal + chatbot) */}
      {currentModule === MODULES.ESTATUS && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'mesa_control') && (
        <EstatusModule canManageKeys={user?.role !== 'mesa_control'} />
      )}

      {/* Módulo de Administración */}
      {currentModule === MODULES.ADMIN && (
        <>
          {activeTab === 'account' && <AccountModule />}
          {activeTab === 'users' && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'usuarios') && <UsersModule />}
          {activeTab === 'template' && (user?.role === 'admin' || user?.role === 'admin_general') && <TemplateModule />}
          {activeTab === 'packages' && (user?.role === 'admin' || user?.role === 'admin_general') && <PackagesModule />}
          {activeTab === 'promociones' && (user?.role === 'admin' || user?.role === 'admin_general') && <PromocionesModule />}
          {activeTab === 'knowledge' && (user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'marketing') && <KnowledgeModule />}
          {activeTab === 'actividad' && (user?.role === 'admin' || user?.role === 'admin_general') && <AdminActivityDashboard />}
        </>
      )}
    </AdminLayout>
  );
}

