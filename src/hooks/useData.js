import { useState, useEffect, useCallback } from 'react';
import * as api from '../api.js';
import { MODULES } from '../utils/constants.js';

/**
 * Hook para cargar datos bajo demanda (lazy loading)
 * Solo carga cuando se llama explícitamente o cuando cambian las dependencias
 */
export function useData(currentModule, user, enabled = false) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dbCount, setDbCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!user || !enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (currentModule === MODULES.SALES) {
        const salesData = await api.getSalesMaster();
        setData(salesData.map(d => ({ id: d._id || d.id, ...d })));
        setDbCount(salesData.length);
      } else if (currentModule === MODULES.INSTALL) {
        const installData = await api.getInstallMaster();
        setData(installData.map(d => ({ id: d._id || d.id, ...d })));
        setDbCount(installData.length);
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentModule, user, enabled]);

  // Solo carga si enabled es true
  useEffect(() => {
    if (enabled) {
      loadData();
    }
  }, [enabled, loadData]);

  return { 
    data, 
    loading, 
    error, 
    dbCount, 
    refetch: loadData,
    loadData // Función para cargar manualmente
  };
}

