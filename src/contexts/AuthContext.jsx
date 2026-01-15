import { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../api.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'ss_auth_v1';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [vendorName, setVendorName] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [backendError, setBackendError] = useState(null);

  // Restaurar sesión desde localStorage (para que al refrescar no se pierda)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.user?.role) {
        setUser(parsed.user);
        setRole(parsed.user.role);
        setVendorName(parsed.user.name || parsed.user.username || '');
      }
    } catch (e) {
      // Si está corrupto, limpiar
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Verificar conexión con el backend
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await api.checkHealth();
        setBackendError(null);
      } catch (error) {
        // Mensaje genérico (en producción no debe mencionar localhost)
        setBackendError('No se puede conectar al backend. Verifica que el servidor esté en línea.');
        console.error('Error conectando al backend:', error);
      }
    };
    checkBackend();
  }, []);

  // Keep-alive suave mientras la app está abierta (reduce cold start durante el uso)
  useEffect(() => {
    let intervalId = null;

    const tick = async () => {
      // Evitar pings cuando la pestaña no está visible (reduce ruido)
      if (document.visibilityState !== 'visible') return;
      try {
        await api.checkHealth();
        setBackendError(null);
      } catch (error) {
        // No spamear al usuario; solo registrar y dejar el mensaje genérico
        setBackendError('No se puede conectar al backend. Verifica que el servidor esté en línea.');
        console.error('Error conectando al backend (keep-alive):', error);
      }
    };

    // Cada 8 minutos (Render suele dormir ~15 min de inactividad)
    intervalId = setInterval(tick, 8 * 60 * 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const login = async (username, password) => {
    setIsAuthenticating(true);
    setAuthError(null);
    
    try {
      // Warm-up: dispara el wake-up antes del login real (mejora primer intento post-cold-start)
      try {
        await api.checkHealth();
        setBackendError(null);
      } catch (e) {
        // ignorar (el login igualmente intentará)
      }
      const result = await api.loginUser(username, password);
      
      if (result.success) {
        setUser(result.user);
        setRole(result.user.role);
        setVendorName(result.user.name);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: result.user }));
        } catch (e) {
          // ignore
        }
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
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

