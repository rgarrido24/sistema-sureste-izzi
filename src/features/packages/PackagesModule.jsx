import { useState, useEffect } from 'react';
import { usePackages } from '../../hooks/usePackages.js';
import * as api from '../../api.js';

// Catálogo base IZZI (histórico). Sirve para cargar de golpe lo que antes estaba "hardcodeado".
const IZZI_BASE_PACKAGES = [
  // TRIPLE
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TI60M', name: 'IZZI 60 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TI80M', name: 'IZZI 80 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TI100M2', name: 'IZZI 100 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TI150M', name: 'IZZI 150 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TI200M2', name: 'IZZI 200 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TI500M2', name: 'IZZI 500 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TI1000M2', name: 'IZZI 1000 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG30', name: 'IZZI NEGOCIOS 30 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG40', name: 'IZZI NEGOCIOS 40 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG50', name: 'IZZI NEGOCIOS 50 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG60', name: 'IZZI NEGOCIOS 60 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG80', name: 'IZZI NEGOCIOS 80 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG100', name: 'IZZI NEGOCIOS 100 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG125', name: 'IZZI NEGOCIOS 125 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG150', name: 'IZZI NEGOCIOS 150 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG200', name: 'IZZI NEGOCIOS 200 MEGAS + IZZI TV HD', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'TRIPLE', codigo: 'TIG500', name: 'IZZI NEGOCIOS 500 MEGAS + IZZI TV HD', price: 0, description: '' },
  // DOBLE
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DI60M', name: 'IZZI 60 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DI80M', name: 'IZZI 80 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DI100M', name: 'IZZI 100 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DI150M', name: 'IZZI 150 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DI200M', name: 'IZZI 200 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DI500M', name: 'IZZI 500 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DI1000M', name: 'IZZI 1000 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DIN40M', name: 'IZZI NEGOCIOS 40 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DIN60M', name: 'IZZI NEGOCIOS 60 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DIN80M', name: 'IZZI NEGOCIOS 80 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DIN100M', name: 'IZZI NEGOCIOS 100 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DIN150M', name: 'IZZI NEGOCIOS 150 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DIN200M', name: 'IZZI NEGOCIOS 200 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DIN500M', name: 'IZZI NEGOCIOS 500 MEGAS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'DOBLE', codigo: 'DIN1000M', name: 'IZZI NEGOCIOS 1000 MEGAS', price: 0, description: '' },
  // SINGLE
  { marca: 'IZZI', tipo: 'SINGLE', codigo: 'SITVL', name: 'IZZI TV LIGHT', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'SINGLE', codigo: 'SPTVM', name: 'PACK TV MINI', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'SINGLE', codigo: 'SITVP', name: 'IZZI TV +', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'SINGLE', codigo: 'SITVPB', name: 'IZZI TV + BÁSICO', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'SINGLE', codigo: 'SITVPP', name: 'IZZI TV + PREMIUM', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'SINGLE', codigo: 'SPTVP', name: 'PACK TV PLUS', price: 0, description: '' },
  { marca: 'IZZI', tipo: 'SINGLE', codigo: 'SIHD', name: 'IZZI TV HD', price: 0, description: '' },
];

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

function parseIzziPaste(text) {
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
    if (!tipo) continue;

    const cleaned = normalizeSpaces(line.replace(/^(TRIPLES|DOBLES|SINGLES)\s+/i, ''));
    if (!cleaned) continue;

    // Formatos aceptados:
    // - "TI60M\tIZZI 60 MEGAS + IZZI TV HD"
    // - "TI60M - IZZI 60 MEGAS + IZZI TV HD"
    // - "TI60M IZZI 60 MEGAS + IZZI TV HD"
    let codigo = '';
    let name = cleaned;

    const tabParts = cleaned.split('\t').map(s => s.trim()).filter(Boolean);
    if (tabParts.length >= 2 && /^[A-Z]{1,4}\d{1,4}[A-Z0-9+]*$/i.test(tabParts[0])) {
      codigo = tabParts[0].toUpperCase();
      name = tabParts.slice(1).join(' ');
    } else {
      const dashParts = cleaned.split(/\s-\s/).map(s => s.trim()).filter(Boolean);
      if (dashParts.length >= 2 && /^[A-Z]{1,4}\d{1,4}[A-Z0-9+]*$/i.test(dashParts[0])) {
        codigo = dashParts[0].toUpperCase();
        name = dashParts.slice(1).join(' ');
      } else {
        const m = cleaned.match(/^([A-Z]{1,4}\d{1,4}[A-Z0-9+]*)\s+(.+)$/i);
        if (m) {
          codigo = String(m[1]).toUpperCase();
          name = String(m[2]).trim();
        }
      }
    }

    // Si no trae código, lo generamos básico para no bloquear la carga.
    if (!codigo) {
      const base = slugLetters(name).replace(/\s+/g, '').slice(0, 10) || 'PKG';
      codigo = `IZ${base}`;
    }

    out.push({
      marca: 'IZZI',
      tipo,
      codigo,
      name,
      price: 0,
      description: '',
    });
  }

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
  const [bulkMarca, setBulkMarca] = useState('WIZZ');

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

  const handleBuildBulkPreview = () => {
    const parsed = bulkMarca === 'IZZI' ? parseIzziPaste(bulkText) : parseWizzPaste(bulkText);
    setBulkPreview(parsed);
    if (parsed.length === 0) {
      alert('No pude detectar paquetes. Pega el texto con secciones TRIPLES / DOBLES / SINGLES como el que me enviaste.');
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkPreview.length) {
      handleBuildBulkPreview();
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

  const handleSeedIzziBase = async () => {
    setBulkLoading(true);
    try {
      const resp = await api.bulkCreatePackages(IZZI_BASE_PACKAGES);
      alert(`✅ IZZI cargado. Creados: ${resp.created} | Omitidos: ${resp.skipped} | Total: ${resp.total}`);
      await loadPackages();
    } catch (e) {
      alert('Error cargando IZZI base: ' + (e?.message || 'Error'));
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

      {/* Carga masiva (IZZI/WIZZ) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-xl font-bold">Carga masiva (IZZI / WIZZ)</h2>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={bulkMarca}
              onChange={(e) => {
                setBulkMarca(e.target.value);
                setBulkPreview([]);
              }}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="WIZZ">WIZZ</option>
              <option value="IZZI">IZZI</option>
            </select>
            {bulkMarca === 'IZZI' && (
              <button
                type="button"
                disabled={bulkLoading}
                onClick={handleSeedIzziBase}
                className="px-4 py-2 bg-emerald-50 text-emerald-800 rounded-lg font-semibold hover:bg-emerald-100 border border-emerald-200 disabled:opacity-60"
                title="Carga en un clic la lista base de IZZI (la que antes estaba hardcodeada)"
              >
                Cargar IZZI base (1 clic)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (bulkMarca === 'IZZI') {
                  setBulkText(`TRIPLES\tTI60M\tIZZI 60 MEGAS + IZZI TV HD
\tTI80M\tIZZI 80 MEGAS + IZZI TV HD
\tTI100M2\tIZZI 100 MEGAS + IZZI TV HD

DOBLES\tDI60M\tIZZI 60 MEGAS
\tDI80M\tIZZI 80 MEGAS

SINGLES\tSITVL\tIZZI TV LIGHT`);
                } else {
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
                }
                setBulkPreview([]);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200"
            >
              Pegar ejemplo
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-3">
          Pega tu lista con secciones <strong>TRIPLES</strong>, <strong>DOBLES</strong>, <strong>SINGLES</strong>.
          {bulkMarca === 'WIZZ' ? (
            <> El sistema asigna <strong>marca=WIZZ</strong>, detecta el tipo y genera una <strong>clave</strong> automática.</>
          ) : (
            <> Para IZZI, puedes pegar con código y nombre (tabulados) o usar <strong>"Cargar IZZI base"</strong> (recomendado).</>
          )}
        </p>

        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={bulkMarca === 'IZZI' ? 'Pega aquí la lista IZZI…' : 'Pega aquí la lista WIZZ…'}
          className="w-full min-h-[160px] px-4 py-3 border border-slate-300 rounded-lg font-mono text-xs"
        />

        <div className="flex gap-3 mt-3 flex-wrap">
          <button
            type="button"
            onClick={handleBuildBulkPreview}
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

