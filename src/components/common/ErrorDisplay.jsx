import { AlertTriangle } from 'lucide-react';

/**
 * Componente para mostrar errores de forma consistente
 */
export default function ErrorDisplay({ message, details, currentKey }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-lg w-full">
        <AlertTriangle size={64} className="text-red-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-red-800 mb-2">Error de Conexión</h1>
        
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-left mb-4 text-xs text-red-800 font-mono break-all">
          {message}
        </div>

        {currentKey && (
          <div className="text-left bg-slate-100 p-3 rounded mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase">Tu Clave:</p>
            <code className="text-xs text-slate-700 break-all block mt-1 p-1 bg-white border rounded">
              {currentKey.substring(0, 10) + "..."}
            </code>
          </div>
        )}

        <p className="text-sm text-slate-600 mb-6">
          {details}
        </p>

        <button 
          onClick={() => window.location.reload()} 
          className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

