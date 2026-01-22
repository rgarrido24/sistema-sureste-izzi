import { useState, useEffect } from 'react';
import { usePackages } from '../../hooks/usePackages.js';
import * as api from '../../api.js';

function normalizeSpaces(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function slugLetters(s) {
  return normalizeSpaces(s).toUpperCase().replace(/[^A-Z0-9+.\s]/g, '');
}

function generateWizzCode({ tipo, name }) {
  const t = String(tipo || '').toUpperCase().trim();
  const text = slugLetters(name);

  // DOBLES: "WIZZ 10" -> WD10
  const dobleMatch = text.match(/^WIZZ\s+(\d{1,4})$/);
  if (t === 'DOBLE' && dobleMatch) return `WD${dobleMatch[1]}`;

  // TRIPLES: "WIZZ 10 + WIZZ TV 2.0" / "WIZZ 10 + TV BASICO" / "WIZZ 40 + IZZI TV +"
  const tripleMatch = text.match(/^WIZZ\s+(\d{1,4})\s*\+\s*(.+)$/);
  if (t === 'TRIPLE' && tripleMatch) {
    const speed = tripleMatch[1];
    const addon = normalizeSpaces(tripleMatch[2])
      .replace(/\s+/g, ' ')
      .replace(/\./g, '')
      .trim();

    if (addon === 'WIZZ TV 20' || addon === 'WIZZ TV 2 0' || addon === 'WIZZ TV 2 0 ' || addon.includes('WIZZ TV 2')) {
      return `WT${speed}WTV2`;
    }
    if (addon === 'WIZZ TV' || addon.includes('WIZZ TV')) {
      return `WT${speed}WTV`;
    }
    if (addon === 'TV BASICO' || addon.includes('TV BASICO')) {
      return `WT${speed}TVB`;
    }
    if (addon === 'TV MINI BASICO' || addon.includes('TV MINI BASICO')) {
      return `WT${speed}TVMB`;
    }
    if (addon === 'IZZI TV +' || addon === 'IZZI TV+' || addon.includes('IZZI TV')) {
      return `WT${speed}ITVP`;
    }
    return `WT${speed}X`;
  }

  // SINGLES
  if (t === 'SINGLE') {
    if (text.includes('WIZZ TV 2')) return 'WSWTV2';
    if (text.includes('WIZZ TV')) return 'WSWTV';
    if (text.includes('TV MINI BASICO')) return 'WSTVMB';
    if (text.includes('TV BASICO')) return 'WSTVB';
    if (text.includes('IZZI TV LIGHT')) return 'WSITVL';
    if (text.includes('IZZI TV+')) return 'WSITVP';
    if (text.includes('IZZI TV +')) return 'WSITVP';
  }

  // Fallback: código estable por nombre (corto)
  const compact = text.replace(/\s+/g, '');
  return `W${compact.slice(0, 10) || 'PKG'}`;
}

function parseWizzPaste(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  let tipo = null;
  const out = [];

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('TRIPLES')) { tipo = 'TRIPLE'; continue; }
    if (upper.startsWith('DOBLES')) { tipo = 'DOBLE'; continue; }
    if (upper.startsWith('SINGLES')) { tipo = 'SINGLE'; continue; }

    // Limpia posibles tabs/columnas (ej: "TRIPLES\tWIZZ 10 + ...")
    const cleaned = normalizeSpaces(line.replace(/^\w+\s+/i, line)); // no-op safe
    if (!tipo) continue;

    // Si viene "TRIPLES WIZZ 10 + ..." en la misma línea
    const inline = cleaned.replace(/^(TRIPLES|DOBLES|SINGLES)\s+/i, '');
    const name = normalizeSpaces(inline);
    if (!name) continue;

    const codigo = generateWizzCode({ tipo, name });
    out.push({
      marca: 'WIZZ',
      tipo,
      codigo,
      name,
      price: 0,
      description: '',
    });
  }

  // Dedup por codigo (por si pegan repetidos)
  const seen = new Set();
  return out.filter(p => {
    const key = `${p.marca}::${p.tipo}::${p.codigo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function PackagesModule() {
  // Solo carga cuando esta pestaña está activa
  const { packages, loading, loadPackages } = usePackages(true);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);
  const [newPackage, setNewPackage] = useState({ marca: 'IZZI', name: '', price: '', codigo: '', tipo: '' });
  const [creating, setCreating] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

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

  const handleBuildWizzPreview = () => {
    const parsed = parseWizzPaste(bulkText);
    setBulkPreview(parsed);
    if (parsed.length === 0) {
      alert('No pude detectar paquetes. Pega el texto con secciones TRIPLES / DOBLES / SINGLES como el que me enviaste.');
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkPreview.length) {
      handleBuildWizzPreview();
      return;
    }
    setBulkLoading(true);
    try {
      const resp = await api.bulkCreatePackages(bulkPreview);
      alert(`✅ Carga masiva lista. Creados: ${resp.created} | Omitidos: ${resp.skipped} | Total: ${resp.total}`);
      setBulkText('');
      setBulkPreview([]);
      await loadPackages();
    } catch (e) {
      alert('Error en carga masiva: ' + (e?.message || 'Error'));
    } finally {
      setBulkLoading(false);
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

      {/* Carga masiva WIZZ */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-xl font-bold">Carga masiva (WIZZ)</h2>
          <button
            type="button"
            onClick={() => {
              setBulkText(`TRIPLES\tWIZZ 10 + WIZZ TV 2.0
\tWIZZ 20 + WIZZ TV 2.0
\tWIZZ 50 + WIZZ TV 2.0
\tWIZZ 100 + WIZZ TV 2.0
\tWIZZ 10 + TV BASICO
\tWIZZ 20 + TV BASICO
\tWIZZ 50 + TV BASICO
\tWIZZ 40 + IZZI TV +
\tWIZZ 60 + IZZI TV +
\tWIZZ 80 + IZZI TV +
\tWIZZ 100 + IZZI TV +

DOBLES\tWIZZ 10
\tWIZZ 20
\tWIZZ 40
\tWIZZ 50
\tWIZZ 60
\tWIZZ 80
\tWIZZ 100

SINGLES\tWIZZ TV
\tWIZZ TV 2.0
\tTV MINI BASICO
\tTV BASICO
\tIZZI TV+
\tIZZI TV LIGHT`);
              setBulkPreview([]);
            }}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200"
          >
            Pegar ejemplo
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-3">
          Pega tu lista con secciones <strong>TRIPLES</strong>, <strong>DOBLES</strong>, <strong>SINGLES</strong>.
          El sistema asigna <strong>marca=WIZZ</strong>, detecta el tipo y genera una <strong>clave</strong> automática.
        </p>

        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder="Pega aquí la lista WIZZ…"
          className="w-full min-h-[160px] px-4 py-3 border border-slate-300 rounded-lg font-mono text-xs"
        />

        <div className="flex gap-3 mt-3 flex-wrap">
          <button
            type="button"
            onClick={handleBuildWizzPreview}
            className="px-5 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold hover:bg-blue-100 border border-blue-200"
          >
            Previsualizar
          </button>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={handleBulkUpload}
            className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:bg-slate-400"
          >
            {bulkLoading ? 'Cargando…' : 'Cargar a BD'}
          </button>
        </div>

        {bulkPreview.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="text-sm font-bold mb-2">Previsualización ({bulkPreview.length})</div>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-2 pr-3">Marca</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPreview.map((p, idx) => (
                    <tr key={`${p.codigo}-${idx}`} className="border-t border-slate-100">
                      <td className="py-2 pr-3 font-bold">{p.marca}</td>
                      <td className="py-2 pr-3">{p.tipo}</td>
                      <td className="py-2 pr-3 font-mono">{p.codigo}</td>
                      <td className="py-2 pr-3">{p.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

