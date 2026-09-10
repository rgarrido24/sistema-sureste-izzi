import { useState, useEffect } from 'react';
import { Send, MessageCircle, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import * as api from '../../api.js';

const MODULOS = [
  { value: 'm0', label: 'M0' },
  { value: 'm1', label: 'M1' },
  { value: 'm2', label: 'M2' },
  { value: 'm3', label: 'M3' },
  { value: 'm4', label: 'M4' },
];

// Campos comunes disponibles para mapear a las variables {{n}} de la plantilla.
// Se pueden escribir otros nombres de campo a mano si no están en esta lista.
const CAMPOS_SUGERIDOS = [
  'Cliente', 'cuenta', 'SALDO', 'SALDO TOTAL', 'SALDO GLOBAL', 'SALDO VENCIDO',
  'Fecha Perdida FPD', 'Fecha Instalacion', 'PLAZA', 'Vendedor', 'Producto',
];

export default function WhatsAppBulkModule() {
  const [modulo, setModulo] = useState('m1');
  const [templates, setTemplates] = useState([]);
  const [templatesError, setTemplatesError] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [manualTemplateName, setManualTemplateName] = useState('');
  const [languageCode, setLanguageCode] = useState('es_MX');
  const [variableCount, setVariableCount] = useState(0);
  const [variableFields, setVariableFields] = useState([]);
  const [telefonoField, setTelefonoField] = useState('Telefono1');
  const [cuentasText, setCuentasText] = useState('');
  const [enviarATodas, setEnviarATodas] = useState(false);
  const [totalDisponibles, setTotalDisponibles] = useState(null);
  const [loadingTotal, setLoadingTotal] = useState(false);
  const [sending, setSending] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoadingTemplates(true);
      setTemplatesError('');
      try {
        const data = await api.getWhatsAppTemplates();
        setTemplates(data);
      } catch (e) {
        setTemplatesError(e.message || 'No se pudieron cargar las plantillas. Puedes escribir el nombre manualmente.');
      } finally {
        setLoadingTemplates(false);
      }
    })();
  }, []);

  const selectedTemplate = templates.find(t => t.name === selectedTemplateName);
  const effectiveTemplateName = selectedTemplateName || manualTemplateName;

  // Cuando cambia la plantilla seleccionada de la lista, intentar detectar cuántas variables trae
  useEffect(() => {
    if (selectedTemplate?.bodyText) {
      const matches = selectedTemplate.bodyText.match(/\{\{\d+\}\}/g) || [];
      const count = new Set(matches).size;
      setVariableCount(count);
      setVariableFields(Array.from({ length: count }, (_, i) => variableFields[i] || ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateName]);

  const handleVariableCountChange = (n) => {
    const count = Math.max(0, parseInt(n) || 0);
    setVariableCount(count);
    setVariableFields(prev => Array.from({ length: count }, (_, i) => prev[i] || ''));
  };

  const cargarTotalModulo = async () => {
    setLoadingTotal(true);
    try {
      const getters = { m0: api.getM0Master, m1: api.getM1Master, m2: api.getM2Master, m3: api.getM3Master, m4: api.getM4Master };
      const data = await getters[modulo]();
      setTotalDisponibles(data.length);
    } catch (e) {
      setTotalDisponibles(null);
    } finally {
      setLoadingTotal(false);
    }
  };

  const handleEnviar = async () => {
    setError('');
    setResultado(null);

    if (!effectiveTemplateName) {
      setError('Selecciona o escribe el nombre de la plantilla.');
      return;
    }

    let cuentas = [];
    if (enviarATodas) {
      const getters = { m0: api.getM0Master, m1: api.getM1Master, m2: api.getM2Master, m3: api.getM3Master, m4: api.getM4Master };
      try {
        const data = await getters[modulo]();
        cuentas = data.map(d => d.cuenta).filter(Boolean);
      } catch (e) {
        setError('No se pudo cargar la lista completa de cuentas del módulo.');
        return;
      }
    } else {
      cuentas = cuentasText
        .split(/[\n,]/)
        .map(c => c.trim())
        .filter(Boolean);
    }

    if (cuentas.length === 0) {
      setError('No hay cuentas para enviar. Pega una lista o marca "enviar a todas".');
      return;
    }

    const confirmacion = confirm(
      `⚠️ Vas a enviar la plantilla "${effectiveTemplateName}" a ${cuentas.length} cuenta(s) del módulo ${modulo.toUpperCase()}.\n\nEsto usa la API oficial de WhatsApp y tiene costo por mensaje.\n\n¿Continuar?`
    );
    if (!confirmacion) return;

    setSending(true);
    try {
      const result = await api.sendWhatsAppBulk({
        modulo,
        cuentas,
        templateName: effectiveTemplateName,
        languageCode,
        variableFields,
        telefonoField,
      });
      setResultado(result);
    } catch (e) {
      setError(e.message || 'Error enviando los mensajes');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle className="text-green-600" size={22} />
        <h2 className="text-lg font-bold text-slate-800">Envío masivo de WhatsApp (API oficial)</h2>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Envía una plantilla aprobada a muchas cuentas a la vez. El envío individual manual (botón por cliente) sigue disponible como siempre en cada módulo.
      </p>

      {/* Módulo */}
      <div className="mb-4">
        <label className="block text-sm font-bold text-slate-700 mb-1">Módulo</label>
        <select
          value={modulo}
          onChange={(e) => { setModulo(e.target.value); setTotalDisponibles(null); }}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
        >
          {MODULOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* Plantilla */}
      <div className="mb-4">
        <label className="block text-sm font-bold text-slate-700 mb-1">Plantilla aprobada</label>
        {loadingTemplates ? (
          <div className="text-sm text-slate-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando plantillas de Meta...</div>
        ) : templatesError ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2 flex items-center gap-2">
            <AlertTriangle size={14} /> {templatesError}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-slate-500 mb-2">No se encontraron plantillas aprobadas.</div>
        ) : (
          <select
            value={selectedTemplateName}
            onChange={(e) => setSelectedTemplateName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2"
          >
            <option value="">-- Elige una plantilla o escribe el nombre abajo --</option>
            {templates.map(t => (
              <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
            ))}
          </select>
        )}
        {selectedTemplate?.bodyText && (
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 mb-2 text-slate-600">
            "{selectedTemplate.bodyText}"
          </div>
        )}
        <input
          type="text"
          placeholder="O escribe el nombre exacto de la plantilla"
          value={manualTemplateName}
          onChange={(e) => setManualTemplateName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
        />
      </div>

      {/* Idioma */}
      <div className="mb-4">
        <label className="block text-sm font-bold text-slate-700 mb-1">Código de idioma de la plantilla</label>
        <input
          type="text"
          value={languageCode}
          onChange={(e) => setLanguageCode(e.target.value)}
          placeholder="es_MX"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
        />
      </div>

      {/* Variables */}
      <div className="mb-4">
        <label className="block text-sm font-bold text-slate-700 mb-1">
          Variables de la plantilla ({'{{1}}'}, {'{{2}}'}, ...)
        </label>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-slate-500">Cantidad de variables:</span>
          <input
            type="number"
            min="0"
            value={variableCount}
            onChange={(e) => handleVariableCountChange(e.target.value)}
            className="w-20 px-2 py-1 border border-slate-300 rounded-lg"
          />
        </div>
        {variableFields.map((field, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-slate-500 w-10">{`{{${i + 1}}}`}</span>
            <input
              list="campos-sugeridos"
              type="text"
              value={field}
              onChange={(e) => {
                const next = [...variableFields];
                next[i] = e.target.value;
                setVariableFields(next);
              }}
              placeholder="Nombre del campo (ej. Cliente, SALDO TOTAL)"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        ))}
        <datalist id="campos-sugeridos">
          {CAMPOS_SUGERIDOS.map(c => <option key={c} value={c} />)}
        </datalist>
      </div>

      {/* Teléfono a usar */}
      <div className="mb-4">
        <label className="block text-sm font-bold text-slate-700 mb-1">Campo de teléfono</label>
        <select
          value={telefonoField}
          onChange={(e) => setTelefonoField(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
        >
          <option value="Telefono1">Telefono1</option>
          <option value="Telefono2">Telefono2</option>
        </select>
      </div>

      {/* Destinatarios */}
      <div className="mb-6 border-t border-slate-200 pt-4">
        <label className="block text-sm font-bold text-slate-700 mb-2">Destinatarios</label>
        <label className="flex items-center gap-2 text-sm mb-2">
          <input
            type="checkbox"
            checked={enviarATodas}
            onChange={(e) => setEnviarATodas(e.target.checked)}
          />
          Enviar a TODAS las cuentas del módulo {modulo.toUpperCase()}
          {totalDisponibles !== null && ` (${totalDisponibles} cuentas)`}
        </label>
        {enviarATodas && (
          <button
            onClick={cargarTotalModulo}
            disabled={loadingTotal}
            className="text-xs text-blue-600 hover:underline mb-2"
          >
            {loadingTotal ? 'Consultando...' : 'Ver cuántas cuentas son'}
          </button>
        )}
        {!enviarATodas && (
          <textarea
            value={cuentasText}
            onChange={(e) => setCuentasText(e.target.value)}
            placeholder="Pega números de cuenta separados por coma o uno por línea"
            rows={5}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
          />
        )}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <button
        onClick={handleEnviar}
        disabled={sending}
        className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-slate-400 transition-colors flex items-center justify-center gap-2"
      >
        {sending ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : <><Send size={16} /> Enviar mensajes</>}
      </button>

      {resultado && (
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-slate-800 font-bold">
            <CheckCircle2 size={18} className="text-green-600" /> Resultado del envío
          </div>
          <div className="text-sm text-slate-600 space-y-1">
            <div>Total procesado: <b>{resultado.total}</b></div>
            <div className="text-green-700">Enviados: <b>{resultado.enviados}</b></div>
            <div className="text-red-700">Errores: <b>{resultado.errores}</b></div>
            <div className="text-amber-700">Omitidos (sin teléfono): <b>{resultado.omitidosSinTelefono}</b></div>
          </div>
          {resultado.detalleErrores && (
            <div className="mt-3 text-xs text-slate-500">
              <div className="font-bold mb-1">Primeros errores:</div>
              {resultado.detalleErrores.map((e, i) => (
                <div key={i}>• Cuenta {e.cuenta}: {e.error}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
