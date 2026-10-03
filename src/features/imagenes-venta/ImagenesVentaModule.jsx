import { useState, useEffect } from 'react';
import { Image as ImageIcon, UploadCloud, Download, Trash2, Loader2 } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

export default function ImagenesVentaModule() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director';

  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await api.getImagenesVenta();
      setImagenes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleSubir = async () => {
    if (!file) return;
    setSubiendo(true);
    try {
      await api.subirImagenVenta(file, titulo);
      setFile(null);
      setTitulo('');
      cargar();
    } catch (e) {
      alert('Error subiendo imagen: ' + e.message);
    } finally {
      setSubiendo(false);
    }
  };

  const handleDescargar = (img) => {
    const a = document.createElement('a');
    a.href = img.imagenBase64;
    a.download = (img.titulo || 'imagen') + (img.mimetype?.includes('png') ? '.png' : '.jpg');
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Borrar esta imagen?')) return;
    try {
      await api.eliminarImagenVenta(id);
      setImagenes(prev => prev.filter(i => i._id !== id));
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ImageIcon className="text-blue-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Imágenes de Venta</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        {canManage ? 'Sube material gráfico para que los vendedores lo descarguen y usen en sus ventas.' : 'Descarga el material gráfico para usarlo en tus ventas.'}
      </p>

      {canManage && (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (opcional)"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[150px]"
          />
          <button
            onClick={handleSubir}
            disabled={!file || subiendo}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2"
          >
            {subiendo ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            Subir
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {imagenes.map(img => (
          <div key={img._id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
              {img.imagenBase64
                ? <img src={img.imagenBase64} alt={img.titulo} className="w-full h-full object-cover" />
                : <ImageIcon size={32} className="text-slate-300" />}
            </div>
            <div className="p-2">
              <p className="text-xs font-bold text-slate-700 truncate" title={img.titulo}>{img.titulo || 'Sin título'}</p>
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => handleDescargar(img)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Descargar"
                >
                  <Download size={16} />
                </button>
                {canManage && (
                  <button onClick={() => handleEliminar(img._id)} className="text-red-500 hover:text-red-700" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {imagenes.length === 0 && (
        <p className="text-center text-slate-400 py-12">Todavía no hay imágenes subidas.</p>
      )}
    </div>
  );
}
