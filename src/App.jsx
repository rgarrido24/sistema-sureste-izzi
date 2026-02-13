import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import ErrorDisplay from './components/common/ErrorDisplay.jsx';
import LoadingSpinner from './components/common/LoadingSpinner.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import VendorDashboard from './pages/VendorDashboard.jsx';

// Componente principal que usa el contexto de autenticación
function AppContent() {
  const { user, role, vendorName, isAuthenticating, authError, backendError } = useAuth();

  if (backendError) {
    return <ErrorDisplay 
      message={backendError} 
      details="El servidor backend no está respondiendo. Verifica que esté corriendo en el puerto 3001." 
    />;
  }

  if (authError) {
    return <ErrorDisplay 
      message={authError.message} 
      details="Error de autenticación. Verifica tus credenciales." 
    />;
  }

  if (isAuthenticating) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner message="Iniciando SalesMaster..." />
      </div>
    );
  }

  if (!role) {
    return <LoginPage />;
  }

  // Determinar tipo de dashboard según rol
  if (role === 'admin' || role === 'admin_general' || role === 'admin_region' || role === 'director' || role === 'usuarios' || role === 'mesa_control' || role === 'regionales' || role === 'cobranza_mx') {
    return <AdminDashboard user={user} />;
  } else {
    return <VendorDashboard user={user} myName={vendorName} />;
  }
}

// Componente raíz con el provider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
