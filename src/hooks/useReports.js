import { useState, useCallback } from 'react';
import * as api from '../api.js';

/**
 * Hook para gestionar reportes (carga bajo demanda)
 */
export function useReports(enabled = false) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    try {
      const data = await api.getSalesReports();
      const formatted = data.map(r => ({
        id: r._id || r.id,
        ...r,
        createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString() : 'Reciente'
      }));
      setReports(formatted);
    } catch (error) {
      console.error('Error cargando reportes:', error);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  return { reports, loading, loadReports };
}

