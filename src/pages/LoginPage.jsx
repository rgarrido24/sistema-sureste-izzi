import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import RGOLogo from '../components/common/RGOLogo.jsx';

export default function LoginPage() {
  const { login, isAuthenticating } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Completa todos los campos');
      return;
    }

    setError('');
    const result = await login(username.trim(), password);
    
    if (!result.success) {
      setError(result.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-2xl border border-slate-200">
        {/* Logo RGO */}
        <div className="flex justify-center mb-6">
          <RGOLogo size={100} showText={false} />
        </div>
        <p className="text-slate-600 mb-8 text-center text-sm font-medium">
          Sistema de Cobranza y Ventas
        </p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-2">Usuario</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="Tu usuario" 
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 mb-2 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
              autoComplete="username"
              disabled={isAuthenticating}
            />
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-2">Contraseña</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Tu contraseña" 
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 mb-4 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
              autoComplete="current-password"
              disabled={isAuthenticating}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isAuthenticating}
            className="w-full bg-gradient-to-r from-[#1e40af] to-[#2563eb] hover:from-[#1e3a8a] hover:to-[#1e40af] disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isAuthenticating ? (
              <>
                <span className="animate-spin">⏳</span>
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

