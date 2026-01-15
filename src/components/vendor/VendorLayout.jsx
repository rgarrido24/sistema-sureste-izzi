import { LogOut } from 'lucide-react';

export default function VendorLayout({ 
  user, 
  myName, 
  activeView, 
  setActiveView, 
  onLogout, 
  children 
}) {
  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Bienvenido, {myName}</h1>
            <p className="text-sm text-slate-500">Panel de Vendedor</p>
          </div>
          <button 
            onClick={onLogout} 
            className="text-red-500 hover:bg-red-50 p-2 rounded-full"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Navigation - Pestañas principales */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4">
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={() => setActiveView('cobranza')} 
              className={`px-6 py-2 rounded-lg font-bold text-sm ${
                activeView === 'cobranza' || activeView === 'm1' || activeView === 'm2' || activeView === 'm3' || activeView === 'm4'
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Cobranza
            </button>
            <button 
              onClick={() => setActiveView('instalaciones')} 
              className={`px-6 py-2 rounded-lg font-bold text-sm ${
                activeView === 'instalaciones'
                  ? 'bg-green-600 text-white' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Instalaciones
            </button>
            <button 
              onClick={() => setActiveView('reports')} 
              className={`px-6 py-2 rounded-lg font-bold text-sm ${
                activeView === 'reports' 
                  ? 'bg-amber-600 text-white' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Mis Reportes
            </button>
            <button 
              onClick={() => setActiveView('chat')} 
              className={`px-6 py-2 rounded-lg font-bold text-sm ${
                activeView === 'chat' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Asistente IA
            </button>
            <button 
              onClick={() => setActiveView('account')} 
              className={`px-6 py-2 rounded-lg font-bold text-sm ${
                activeView === 'account' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Mi Cuenta
            </button>
          </div>
        </div>

        {/* Sub-navegación para Cobranza */}
        {(activeView === 'cobranza' || activeView === 'm1' || activeView === 'm2' || activeView === 'm3' || activeView === 'm4') && (
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={() => setActiveView('m1')} 
                className={`px-4 py-2 rounded-lg font-bold text-sm ${
                  activeView === 'm1' 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                M1
              </button>
              <button 
                onClick={() => setActiveView('m2')} 
                className={`px-4 py-2 rounded-lg font-bold text-sm ${
                  activeView === 'm2' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                M2
              </button>
              <button 
                onClick={() => setActiveView('m3')} 
                className={`px-4 py-2 rounded-lg font-bold text-sm ${
                  activeView === 'm3' 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                M3
              </button>
              <button 
                onClick={() => setActiveView('m4')} 
                className={`px-4 py-2 rounded-lg font-bold text-sm ${
                  activeView === 'm4' 
                    ? 'bg-pink-100 text-pink-700' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                M4
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
}

