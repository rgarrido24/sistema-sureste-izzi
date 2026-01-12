import { useState, useCallback } from 'react';
import * as api from '../api.js';

/**
 * Hook para gestionar paquetes (carga bajo demanda)
 */
export function usePackages(enabled = false) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadPackages = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    try {
      const data = await api.getPackages();
      setPackages(data.map(p => ({ id: p._id || p.id, ...p })));
    } catch (error) {
      console.error('Error cargando paquetes:', error);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  return { packages, loading, loadPackages };
}

