import { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [vendorName, setVendorName] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [backendError, setBackendError] = useState(null);

  // Verificar conexión con el backend
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await api.checkHealth();
        setBackendError(null);
      } catch (error) {
        setBackendError('No se puede conectar al backend. Asegúrate de que esté corriendo en http://localhost:3001');
        console.error('Error conectando al backend:', error);
      }
    };
    checkBackend();
  }, []);

  const login = async (username, password) => {
    setIsAuthenticating(true);
    setAuthError(null);
    
    try {
      const result = await api.loginUser(username, password);
      
      if (result.success) {
        setUser(result.user);
        setRole(result.user.role);
        setVendorName(result.user.name);
        return { success: true };
      } else {
        setAuthError(new Error(result.error || 'Error al iniciar sesión'));
        return { success: false, error: result.error };
      }
    } catch (error) {
      setAuthError(error);
      return { success: false, error: error.message };
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    setVendorName('');
    setAuthError(null);
  };

  const value = {
    user,
    role,
    vendorName,
    isAuthenticating,
    authError,
    backendError,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}

