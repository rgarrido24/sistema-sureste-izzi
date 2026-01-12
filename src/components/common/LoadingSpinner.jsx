import { RefreshCw } from 'lucide-react';

/**
 * Componente de carga/spinner reutilizable
 */
export default function LoadingSpinner({ message = 'Cargando...', size = 24 }) {
  return (
    <div className="flex items-center justify-center gap-3 text-blue-600">
      <RefreshCw size={size} className="animate-spin" />
      <span>{message}</span>
    </div>
  );
}

