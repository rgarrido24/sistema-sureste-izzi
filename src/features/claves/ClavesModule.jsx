import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Search, History, Key, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as api from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

const TABS = { LISTADO: 'listado', SUBIR: 'subir', AGREGAR: 'agregar', HISTORIAL: 'historial' };

// Orden de columnas para el Excel de exportación (mismo formato que la plantilla de Izzi)
const COLUMNAS_EXPORT = [
  'REGION', 'SUBREGION', 'HUB', 'PLAZA', 'NOMBRE DEL VENDEDOR', 'DISTRIBUIDOR', 'RAZON SOCIAL',
  'KAM', 'ESTATUS', 'JORNADA', 'SUPERVISOR INTERNO (IZZI)', 'GERENTE INTERNO (IZZI)',
  'CANAL DE DISTRIBUCION', 'TIPO DE USUARIO', 'CLASIFICACION DE CLAVE', 'RFC VENDEDOR',
  'USUARIO DE RED', 'CLAVES', 'No. EMPLEADO', 'SALES FORCE (SKY)', 'FECHA ALTA', 'FECHA BAJA',
  'SUPERVISOR', 'RFC SUP. DISTR.', 'CLAVE SUP.', 'GERENTE DISTRIBUIDOR', 'SUBDISTRIBUIDOR',
  'TEL. SUBDISTR.', 'ID'
];

// Campos del formulario de alta manual: los repetitivos usan datalist (autocompletar),
// los únicos por persona son texto libre.
const CAMPOS_FORM_DATALIST = [
  'REGION', 'SUBREGION', 'HUB', 'PLAZA', 'DISTRIBUIDOR', 'RAZON SOCIAL', 'KAM', 'ESTATUS',
  'JORNADA', 'SUPERVISOR INTERNO (IZZI)', 'GERENTE INTERNO (IZZI)', 'CANAL DE DISTRIBUCION',
  'TIPO DE USUARIO', 'CLASIFICACION DE CLAVE', 'SUPERVISOR', 'GERENTE DISTRIBUIDOR', 'SUBDISTRIBUIDOR'
];
const CAMPOS_FORM_LIBRES = [
  'NOMBRE DEL VENDEDOR', 'RFC VENDEDOR', 'USUARIO DE RED', 'CLAVES', 'No. EMPLEADO',
  'FECHA ALTA', 'FECHA BAJA', 'RFC SUP. DISTR.', 'CLAVE SUP.', 'TEL. SUBDISTR.'
];

export default function ClavesModule() {
  const { user } = useAuth();
  const [tab, setTab] = useState(TABS.LISTADO);

  const canDeleteAll = user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'director';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Key className="text-blue-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Claves CVVEN (asignación a vendedores)</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Control de qué clave se le asignó a cada vendedor, quién la subió/entregó y cuándo.
      </p>

      <div className="flex gap-2 mb-4 border-b border-slate-200">
        {[
          { key: TABS.LISTADO, label: 'Listado actual' },
          { key: TABS.SUBIR, label: 'Subir plantilla' },
          { key: TABS.AGREGAR, label: 'Agregar vendedor' },
          { key: TABS.HISTORIAL, label: 'Historial de cargas' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === TABS.LISTADO && <ListadoClaves />}
      {tab === TABS.SUBIR && <SubirPlantilla onUploaded={() => setTab(TABS.LISTADO)} />}
      {tab === TABS.AGREGAR && <AgregarVendedor onAdded={() => setTab(TABS.LISTADO)} />}
      {tab === TABS.HISTORIAL && <HistorialCargas canDeleteAll={canDeleteAll} />}
    </div>
  );
}

function ListadoClaves() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const cargar = async (params = {}) => {
    setLoading(true);
    try {
      const data = await api.getClaves(params);
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    cargar(search ? { search } : {});
  };

  const handleExport = () => {
    const porHoja = new Map();
    for (const r of rows) {
      const hoja = r.hojaOrigen || 'Claves';
      if (!porHoja.has(hoja)) porHoja.set(hoja, []);
      porHoja.get(hoja).push(
        Object.fromEntries(COLUMNAS_EXPORT.map(col => [col, r[col] ?? '']))
      );
    }

    const wb = XLSX.utils.book_new();
    for (const [hoja, filas] of porHoja) {
      const ws = XLSX.utils.json_to_sheet(filas, { header: COLUMNAS_EXPORT });
      XLSX.utils.book_append_sheet(wb, ws, String(hoja).slice(0, 31));
    }
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Claves_CVVEN_${fecha}.xlsx`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vendedor, clave, distribuidor, plaza..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm">Buscar</button>
        <button
          type="button"
          onClick={handleExport}
          disabled={rows.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm disabled:bg-slate-300"
        >
          Descargar Excel
        </button>
      </form>

      <p className="text-sm text-slate-500 mb-2">{rows.length} registros</p>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 whitespace-nowrap">Vendedor</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Clave</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Distribuidor</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Plaza</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Estatus</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Fecha Alta</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Subido por</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Cuándo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap font-medium">{r['NOMBRE DEL VENDEDOR'] || '-'}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{r['CLAVES'] || '-'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r['DISTRIBUIDOR'] || '-'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r['PLAZA'] || '-'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r['ESTATUS'] || '-'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r['FECHA ALTA'] || '-'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.subidoPorNombre || '-'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString('es-MX') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-slate-400 py-8">Sin registros todavía. Sube tu primera plantilla.</p>
        )}
      </div>
    </div>
  );
}

function SubirPlantilla({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResultado(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      let allRows = [];
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
        const withSheet = data.map(row => ({ ...row, __hojaOrigen: sheetName }));
        allRows = allRows.concat(withSheet);
      }

      // Quitar filas completamente vacías
      allRows = allRows.filter(row =>
        Object.entries(row).some(([k, v]) => k !== '__hojaOrigen' && String(v || '').trim() !== '')
      );

      if (allRows.length === 0) {
        setError('No se encontraron filas con datos en el archivo.');
        setUploading(false);
        return;
      }

      const result = await api.bulkUploadClaves(allRows);
      setResultado(result);
      setFile(null);
      if (onUploaded) setTimeout(onUploaded, 1200);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Error procesando el archivo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
        <UploadCloud className="mx-auto text-slate-400 mb-3" size={40} />
        <p className="text-sm text-slate-600 mb-3">
          Sube la plantilla de Izzi (el archivo con las hojas MX NORTE / MX CENTRO / MX SUR, o el que uses).
          Se van a incluir automáticamente todas las hojas que traiga el archivo.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mx-auto"
        />
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-400 transition-colors flex items-center justify-center gap-2"
      >
        {uploading ? <><Loader2 size={16} className="animate-spin" /> Subiendo...</> : 'Subir plantilla'}
      </button>

      {resultado && (
        <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 size={16} />
          Se guardaron {resultado.total} registros. Queda registrado que los subiste tú, ahorita.
        </div>
      )}
    </div>
  );
}

function AgregarVendedor({ onAdded }) {
  const [valoresDistintos, setValoresDistintos] = useState({});
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.getClavesValoresDistintos().then(setValoresDistintos).catch(() => {});
  }, []);

  const handleChange = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOk(false);

    if (!form['NOMBRE DEL VENDEDOR'] || !form['CLAVES']) {
      setError('Nombre del vendedor y Clave son obligatorios.');
      return;
    }

    setSaving(true);
    try {
      await api.crearClaveManual(form);
      setOk(true);
      setForm({});
      if (onAdded) setTimeout(onAdded, 1000);
    } catch (e) {
      setError(e.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <p className="text-sm text-slate-500 mb-4">
        Los campos repetitivos (región, distribuidor, hub, etc.) te sugieren lo que ya se ha usado antes — puedes escribir uno nuevo si no está en la lista.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {CAMPOS_FORM_LIBRES.map(campo => (
          <div key={campo}>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              {campo} {(campo === 'NOMBRE DEL VENDEDOR' || campo === 'CLAVES') && <span className="text-red-500">*</span>}
            </label>
            <input
              type={campo.includes('FECHA') ? 'date' : 'text'}
              value={form[campo] || ''}
              onChange={(e) => handleChange(campo, e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {CAMPOS_FORM_DATALIST.map(campo => (
          <div key={campo}>
            <label className="block text-xs font-bold text-slate-600 mb-1">{campo}</label>
            <input
              list={`datalist-${campo}`}
              value={form[campo] || ''}
              onChange={(e) => handleChange(campo, e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <datalist id={`datalist-${campo}`}>
              {(valoresDistintos[campo] || []).map(v => <option key={v} value={v} />)}
            </datalist>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {ok && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 size={16} /> Vendedor agregado correctamente.
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-400"
      >
        {saving ? 'Guardando...' : 'Agregar vendedor'}
      </button>
    </form>
  );
}

function HistorialCargas({ canDeleteAll }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getClavesHistorial();
        setHistorial(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const verDetalle = async (batchId) => {
    setDetalleLoading(true);
    try {
      const data = await api.getClavesHistorialDetalle(batchId);
      setDetalle({ batchId, rows: data });
    } catch (e) {
      console.error(e);
    } finally {
      setDetalleLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    const c1 = confirm('⚠️ Esto va a BORRAR TODOS los registros de claves (todas las cargas). ¿Continuar?');
    if (!c1) return;
    const c2 = prompt('Para confirmar, escribe "Claves" y presiona OK:');
    if (c2 !== 'Claves') { alert('Cancelado.'); return; }
    try {
      await api.deleteAllClaves();
      alert('Eliminado correctamente.');
      window.location.reload();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <History size={18} className="text-slate-500" />
        <h3 className="font-bold text-slate-700">Quién subió cada lote</h3>
      </div>

      <div className="space-y-2">
        {historial.map((h) => (
          <div key={h.batchId} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">{h.subidoPorNombre || h.subidoPorUsername || 'Desconocido'}</p>
              <p className="text-xs text-slate-500">
                {new Date(h.fecha).toLocaleString('es-MX')} • {h.total} registros
                {h.hojas?.length > 0 && ` • Hojas: ${h.hojas.join(', ')}`}
              </p>
            </div>
            <button
              onClick={() => verDetalle(h.batchId)}
              className="text-sm text-blue-600 hover:underline"
            >
              Ver detalle
            </button>
          </div>
        ))}
        {historial.length === 0 && (
          <p className="text-center text-slate-400 py-8">Todavía no hay cargas registradas.</p>
        )}
      </div>

      {detalleLoading && <LoadingSpinner />}
      {detalle && !detalleLoading && (
        <div className="mt-4 border border-slate-200 rounded-lg p-3">
          <p className="font-bold text-sm mb-2">Detalle del lote ({detalle.rows.length} registros)</p>
          <div className="max-h-64 overflow-y-auto text-xs space-y-1">
            {detalle.rows.map(r => (
              <div key={r._id} className="border-b border-slate-100 py-1">
                {r['NOMBRE DEL VENDEDOR']} — {r['CLAVES']} — {r['DISTRIBUIDOR']}
              </div>
            ))}
          </div>
        </div>
      )}

      {canDeleteAll && (
        <div className="mt-8 pt-4 border-t border-red-200">
          <button
            onClick={handleDeleteAll}
            className="px-4 py-2 bg-red-50 text-red-700 border border-red-300 rounded-lg font-bold text-sm hover:bg-red-100"
          >
            Borrar todos los registros de claves
          </button>
        </div>
      )}
    </div>
  );
}
