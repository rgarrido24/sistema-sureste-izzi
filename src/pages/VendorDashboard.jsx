import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import VendorLayout from '../components/vendor/VendorLayout.jsx';
import VendorSalesView from '../features/vendor/VendorSalesView.jsx';
import VendorOperacionView from '../features/vendor/VendorOperacionView.jsx';
import VendorReportsView from '../features/vendor/VendorReportsView.jsx';
import VendorChatView from '../features/vendor/VendorChatView.jsx';
import AccountModule from '../features/account/AccountModule.jsx';
import CapacitacionesModule from '../features/capacitaciones/CapacitacionesModule.jsx';
import CapacitacionesIzziModule from '../features/capacitaciones-izzi/CapacitacionesIzziModule.jsx';
import ImagenesVentaModule from '../features/imagenes-venta/ImagenesVentaModule.jsx';
import RankingVentaDirectaModule from '../features/ranking/RankingVentaDirectaModule.jsx';
import PuntosModule from '../features/puntos/PuntosModule.jsx';
import ArranqueModule from '../features/arranque/ArranqueModule.jsx';

export default function VendorDashboard({ user, myName }) {
  const { logout } = useAuth();
  const [activeView, setActiveView] = useState(user?.role === 'redes_sociales' ? 'arranque' : 'cobranza'); // Cambiar a 'cobranza' por defecto
  const [cobranzaView, setCobranzaView] = useState('m1'); // Vista dentro de cobranza

  // Manejar cambio de pestaña principal
  const handleViewChange = (view) => {
    setActiveView(view);
    if (view === 'cobranza' && !cobranzaView) {
      setCobranzaView('m1'); // Por defecto M1 cuando se entra a cobranza
    }
  };

  return (
    <VendorLayout
      user={user}
      myName={myName}
      activeView={activeView === 'cobranza' ? cobranzaView : activeView}
      setActiveView={(view) => {
        if (view === 'm0' || view === 'm1' || view === 'm2' || view === 'm3' || view === 'm4' || view === 'm5' || view === 'm6') {
          setCobranzaView(view);
          setActiveView('cobranza');
        } else {
          handleViewChange(view);
        }
      }}
      onLogout={logout}
    >
      {(activeView === 'cobranza' || activeView === 'm0' || activeView === 'm1' || activeView === 'm2' || activeView === 'm3' || activeView === 'm4' || activeView === 'm5' || activeView === 'm6') && (
        <VendorSalesView myName={myName} status={cobranzaView.toUpperCase()} />
      )}
      {activeView === 'instalaciones' && (
        <VendorOperacionView myName={myName} />
      )}
      {activeView === 'reports' && <VendorReportsView myName={myName} />}
      {activeView === 'chat' && <VendorChatView />}
      {activeView === 'capacitaciones' && <CapacitacionesModule />}
      {activeView === 'capacitacionesIzzi' && <CapacitacionesIzziModule />}
      {activeView === 'imagenesVenta' && <ImagenesVentaModule />}
      {activeView === 'ranking' && <RankingVentaDirectaModule />}
      {activeView === 'puntos' && <PuntosModule />}
      {activeView === 'arranque' && <ArranqueModule />}
      {activeView === 'account' && <AccountModule />}
    </VendorLayout>
  );
}

