import { useState, useEffect } from 'react';
import { usePackages } from '../../hooks/usePackages.js';
import * as api from '../../api.js';

export default function PackagesModule() {
  // Solo carga cuando esta pestaña está activa
  const { packages, loading, loadPackages } = usePackages(true);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);
  const [newPackage, setNewPackage] = useState({ marca: 'IZZI', name: '', price: '', codigo: '', tipo: '' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createPackage(
        newPackage.name, 
        parseFloat(newPackage.price), 
        '', 
        newPackage.codigo || '', 
        newPackage.tipo || '',
        newPackage.marca || 'IZZI'
      );
      setNewPackage({ marca: 'IZZI', name: '', price: '', codigo: '', tipo: '' });
      await loadPackages();
    } catch (error) {
      alert('Error creando paquete: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este paquete?')) return;
    try {
      await api.deletePackage(id);
    } catch (error) {
      alert('Error eliminando paquete: ' + error.message);
    }
  };

  if (loading) {
    return <div className="text-center p-8">Cargando paquetes...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Formulario */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Crear Paquete</h2>
        <form onSubmit={handleCreate} className="flex gap-4 flex-wrap">
          <select
            value={newPackage.marca || 'IZZI'}
            onChange={(e) => setNewPackage({ ...newPackage, marca: e.target.value })}
            className="w-28 px-4 py-2 border rounded-lg"
          >
            <option value="IZZI">IZZI</option>
            <option value="WIZZ">WIZZ</option>
          </select>
          <input
            type="text"
            placeholder="Código (ej: TI60M)"
            value={newPackage.codigo || ''}
            onChange={(e) => setNewPackage({ ...newPackage, codigo: e.target.value })}
            className="w-32 px-4 py-2 border rounded-lg"
          />
          <input
            type="text"
            placeholder="Nombre del paquete"
            value={newPackage.name}
            onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
            className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg"
            required
          />
          <input
            type="number"
            placeholder="Precio"
            value={newPackage.price}
            onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
            className="w-32 px-4 py-2 border rounded-lg"
            required
          />
          <select
            value={newPackage.tipo || ''}
            onChange={(e) => setNewPackage({ ...newPackage, tipo: e.target.value })}
            className="w-40 px-4 py-2 border rounded-lg"
          >
            <option value="">Tipo...</option>
            <option value="TRIPLE">TRIPLE</option>
            <option value="DOBLE">DOBLE</option>
            <option value="SINGLE">SINGLE</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-400"
          >
            {creating ? 'Creando...' : 'Crear'}
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Paquetes ({packages.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className="p-4 border rounded-lg">
              {pkg.marca && (
                <div className="text-[10px] text-slate-500 mb-1 font-bold">
                  {String(pkg.marca).toUpperCase()}
                </div>
              )}
              {pkg.codigo && (
                <div className="text-xs text-slate-500 mb-1 font-mono">
                  {pkg.codigo}
                </div>
              )}
              <h3 className="font-bold">{pkg.name}</h3>
              <p className="text-blue-600 font-bold">${pkg.price}</p>
              {pkg.tipo && (
                <span className="text-xs text-slate-500">
                  {pkg.tipo}
                </span>
              )}
              <button
                onClick={() => handleDelete(pkg.id)}
                className="mt-2 text-red-600 text-sm hover:underline"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

