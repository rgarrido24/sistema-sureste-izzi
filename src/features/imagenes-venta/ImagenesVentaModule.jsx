import { useState, useEffect } from 'react';
import { Image as ImageIcon, UploadCloud, Download, Trash2, Loader2, Link2, ExternalLink } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

const CATEGORIAS = [
  { value: 'rgo', label: 'Propias de RGO' },
  { value: 'izzi', label: 'De Izzi (mes a mes)' },
  { value: 'liga', label: 'Ligas de flyers digitales' },
  { value: 'reclutamiento', label: 'Reclutamiento', soloEquipo: true },
];
// Quién ve la pestaña de Reclutamiento (el servidor también lo valida)
const VE_RECLUTAMIENTO = ['admin', 'admin_general', 'director', 'marketing', 'supervisor', 'regionales', 'reclutador'];

export default function ImagenesVentaModule() {
  const { user } = useAuth();
  const veReclutamiento = VE_RECLUTAMIENTO.includes(user?.role);
  const categoriasVisibles = CATEGORIAS.filter(c => !c.soloEquipo || veReclutamiento);
  const canManage = user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director' || user?.role === 'marketing';

  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState('rgo');

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

  if (loading) return <LoadingSpinner />;

  const filtradas = imagenes.filter(img => (img.categoria || 'rgo') === categoria);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ImageIcon className="text-blue-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Imágenes de Venta</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        {canManage ? 'Sube material gráfico o liga de flyers para que los vendedores lo usen.' : 'Descarga el material gráfico o abre los flyers para usarlos en tus ventas.'}
      </p>

      <div className="flex gap-2 mb-4 border-b border-slate-200">
        {categoriasVisibles.map(c => (
          <button
            key={c.value}
            onClick={() => setCategoria(c.value)}
            className={`px-4 py-2 text-sm font-bold border-b-2 ${categoria === c.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {categoria === 'liga' ? (
        <LigasTab canManage={canManage} imagenes={filtradas} onChange={cargar} />
      ) : (
        <GaleriaTab canManage={canManage} categoria={categoria} imagenes={filtradas} onChange={cargar} />
      )}
    </div>
  );
}

function GaleriaTab({ canManage, categoria, imagenes, onChange }) {
  const [files, setFiles] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [avance, setAvance] = useState('');

  // Se pueden elegir varias imágenes a la vez; si son varias, cada una usa el nombre de su archivo como título
  const handleSubir = async () => {
    if (files.length === 0) return;
    setSubiendo(true);
    const fallas = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setAvance(`Subiendo ${i + 1} de ${files.length}...`);
        const f = files[i];
        const tituloImg = files.length === 1 ? titulo : f.name.replace(/\.[^.]+$/, '');
        try {
          await api.subirImagenVenta(f, tituloImg, categoria);
        } catch (e) {
          fallas.push(`${f.name}: ${e.message}`);
        }
      }
      setFiles([]);
      setTitulo('');
      onChange();
      if (fallas.length) alert('No se pudieron subir:\n' + fallas.join('\n'));
    } finally {
      setSubiendo(false);
      setAvance('');
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
      onChange();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div>
      {canManage && (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
          <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (opcional)"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[150px]"
          />
          <button
            onClick={handleSubir}
            disabled={files.length === 0 || subiendo}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2"
          >
            {subiendo ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {subiendo ? avance : files.length > 1 ? `Subir ${files.length} imágenes` : 'Subir'}
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
                <button onClick={() => handleDescargar(img)} className="text-blue-600 hover:text-blue-800" title="Descargar">
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
      {imagenes.length === 0 && <p className="text-center text-slate-400 py-12">Todavía no hay imágenes en esta categoría.</p>}
    </div>
  );
}

function LigasTab({ canManage, imagenes, onChange }) {
  const [titulo, setTitulo] = useState('');
  const [link, setLink] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleAgregar = async () => {
    if (!link.trim()) return;
    setGuardando(true);
    try {
      await api.agregarLigaFlyer(titulo, link.trim());
      setTitulo('');
      setLink('');
      onChange();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar esta liga?')) return;
    try {
      await api.eliminarImagenVenta(id);
      onChange();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div>
      {canManage && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 flex flex-wrap gap-2">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título del flyer"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[150px]"
          />
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Liga (Canva, Drive, etc.)"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[200px]"
          />
          <button
            onClick={handleAgregar}
            disabled={!link.trim() || guardando}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-400 flex items-center gap-2"
          >
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            Agregar liga
          </button>
        </div>
      )}

      <div className="space-y-2">
        {imagenes.map(img => (
          <div key={img._id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg p-3 bg-white">
            <a href={img.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-700 font-medium truncate">
              <ExternalLink size={16} className="shrink-0" />
              {img.titulo || img.link}
            </a>
            {canManage && (
              <button onClick={() => handleEliminar(img._id)} className="text-red-500 hover:text-red-700 shrink-0">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {imagenes.length === 0 && <p className="text-center text-slate-400 py-12">Sin ligas cargadas todavía.</p>}
      </div>
    </div>
  );
}
