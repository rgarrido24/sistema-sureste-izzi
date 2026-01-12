import { useState, useEffect } from 'react';
import * as api from '../../api.js';

export default function PromocionesModule() {
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPromocion, setNewPromocion] = useState({ 
    title: '', 
    description: '', 
    validFrom: '', 
    validTo: '' 
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Solo carga cuando esta pestaña está activa
    loadPromociones();
    // Polling cada 30 segundos cuando está activo
    const interval = setInterval(loadPromociones, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPromociones = async () => {
    try {
      const data = await api.getPromociones();
      setPromociones(data.map(p => ({ id: p._id || p.id, ...p })));
    } catch (error) {
      console.error('Error cargando promociones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createPromocion(
        newPromocion.title,
        newPromocion.description,
        newPromocion.validFrom,
        newPromocion.validTo
      );
      setNewPromocion({ title: '', description: '', validFrom: '', validTo: '' });
      loadPromociones();
    } catch (error) {
      alert('Error creando promoción: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-center p-8">Cargando promociones...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Formulario */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Crear Promoción</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <input
            type="text"
            placeholder="Título"
            value={newPromocion.title}
            onChange={(e) => setNewPromocion({ ...newPromocion, title: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
          <textarea
            placeholder="Descripción"
            value={newPromocion.description}
            onChange={(e) => setNewPromocion({ ...newPromocion, description: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
            rows="3"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-400"
          >
            {creating ? 'Creando...' : 'Crear Promoción'}
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Promociones ({promociones.length})</h2>
        <div className="space-y-2">
          {promociones.map((promo) => (
            <div key={promo.id} className="p-4 border rounded-lg">
              <h3 className="font-bold">{promo.title}</h3>
              <p className="text-sm text-slate-600">{promo.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

