import { useEffect, useState } from 'react';
import { Upload, Trash2, ToggleLeft, ToggleRight, FileText } from 'lucide-react';
import * as api from '../../api.js';

export default function KnowledgeModule() {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [modoTexto, setModoTexto] = useState(false);
  const [nombreTexto, setNombreTexto] = useState('');
  const [descripcionTexto, setDescripcionTexto] = useState('');
  const [textoPegado, setTextoPegado] = useState('');
  const [guardandoTexto, setGuardandoTexto] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getPDFs();
      setPdfs(data.map(d => ({ id: d._id || d.id, ...d })));
    } catch (e) {
      console.error(e);
      alert('Error cargando PDFs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      await api.uploadKnowledgePDF(file, name || file.name, description);
      setFile(null);
      setName('');
      setDescription('');
      await load();
      alert('✅ PDF cargado y procesado.');
    } catch (e) {
      console.error(e);
      alert('Error subiendo PDF: ' + (e?.message || String(e)));
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (id, isActive) => {
    try {
      await api.updatePDF(id, { isActive: !isActive });
      await load();
    } catch (e) {
      alert('Error actualizando PDF: ' + (e?.message || String(e)));
    }
  };

  const del = async (id) => {
    if (!confirm('¿Eliminar este PDF de conocimiento?')) return;
    try {
      await api.deletePDF(id);
      await load();
    } catch (e) {
      alert('Error eliminando PDF: ' + (e?.message || String(e)));
    }
  };

  const onGuardarTexto = async () => {
    if (!textoPegado.trim()) return;
    try {
      setGuardandoTexto(true);
      await api.crearConocimientoTexto(textoPegado, nombreTexto, descripcionTexto);
      setTextoPegado('');
      setNombreTexto('');
      setDescripcionTexto('');
      await load();
      alert('✅ Conocimiento de texto cargado.');
    } catch (e) {
      console.error(e);
      alert('Error guardando texto: ' + (e?.message || String(e)));
    } finally {
      setGuardandoTexto(false);
    }
  };

  if (loading) return <div className="text-center p-8">Cargando conocimiento…</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-2">Conocimiento</h2>
        <p className="text-sm text-slate-600 mb-4">
          Sube PDFs o pega texto de promociones/oferta (ej. tu gema de Gemini, con qué plazas aplica cada una). El asistente los usará como "gema" central para responder a todos los perfiles.
        </p>

        <div className="flex gap-2 mb-4 border-b border-slate-200">
          <button
            onClick={() => setModoTexto(false)}
            className={`px-4 py-2 text-sm font-bold border-b-2 ${!modoTexto ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
          >
            Subir PDF
          </button>
          <button
            onClick={() => setModoTexto(true)}
            className={`px-4 py-2 text-sm font-bold border-b-2 ${modoTexto ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
          >
            Pegar texto
          </button>
        </div>

        {!modoTexto ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="px-4 py-2 border rounded-lg"
                placeholder="Nombre (opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="px-4 py-2 border rounded-lg md:col-span-2"
                placeholder="Descripción (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block"
              />
              <button
                onClick={onUpload}
                disabled={!file || uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2"
              >
                <Upload size={18} />
                {uploading ? 'Procesando…' : 'Subir PDF'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input
                className="px-4 py-2 border rounded-lg"
                placeholder="Nombre (ej. Promociones por plaza)"
                value={nombreTexto}
                onChange={(e) => setNombreTexto(e.target.value)}
              />
              <input
                className="px-4 py-2 border rounded-lg md:col-span-2"
                placeholder="Descripción (opcional)"
                value={descripcionTexto}
                onChange={(e) => setDescripcionTexto(e.target.value)}
              />
            </div>
            <textarea
              className="w-full px-4 py-2 border rounded-lg text-sm font-mono"
              rows={10}
              placeholder="Pega aquí el texto de tu gema (promociones, precios, en qué plazas aplica y en cuáles no, etc.)"
              value={textoPegado}
              onChange={(e) => setTextoPegado(e.target.value)}
            />
            <button
              onClick={onGuardarTexto}
              disabled={!textoPegado.trim() || guardandoTexto}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2"
            >
              <FileText size={18} />
              {guardandoTexto ? 'Guardando…' : 'Guardar texto'}
            </button>
          </>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-3">Documentos de conocimiento ({pdfs.length})</h3>
        <div className="space-y-2">
          {pdfs.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
              <div className="min-w-0">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {p.description || 'Sin descripción'} • chunks: {p.chunks?.length || 0} • {p.isActive ? 'ACTIVO' : 'INACTIVO'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(p.id, p.isActive)}
                  className="px-3 py-2 rounded-lg text-sm font-bold bg-slate-100 hover:bg-slate-200 flex items-center gap-1"
                  title="Activar/Desactivar"
                >
                  {p.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {p.isActive ? 'Activo' : 'Inactivo'}
                </button>
                <button
                  onClick={() => del(p.id)}
                  className="px-3 py-2 rounded-lg text-sm font-bold bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {pdfs.length === 0 && (
            <div className="text-sm text-slate-600">Aún no hay PDFs cargados.</div>
          )}
        </div>
      </div>
    </div>
  );
}

