import { useEffect, useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import * as api from '../../api.js';

export default function AssistantChatView() {
  const { user } = useAuth();
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', text: 'Hola. Soy tu Asistente IA (Izzi). ¿Qué oferta comercial necesitas armar hoy?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [knowledgeSummary, setKnowledgeSummary] = useState({ packagesCount: 0, promosCount: 0, updatedAt: 0 });
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState(null);

  const refreshKnowledge = async () => {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      const data = await api.assistantKnowledgeRefresh();
      setKnowledgeSummary(data);
    } catch (e) {
      setKnowledgeError(e);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  useEffect(() => {
    // Cargar resumen de conocimiento al abrir el chat
    (async () => {
      setKnowledgeLoading(true);
      setKnowledgeError(null);
      try {
        const summary = await api.assistantKnowledgeSummary();
        setKnowledgeSummary(summary);
      } catch (e) {
        setKnowledgeError(e);
      } finally {
        setKnowledgeLoading(false);
      }
    })();
  }, []);

  const handleSend = async () => {
    if (!chatInput.trim() || loading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const result = await api.assistantChat(userMessage, [...chatHistory, { role: 'user', text: userMessage }]);
      setChatHistory(prev => [...prev, { role: 'assistant', text: result?.text || 'Error IA: Respuesta vacía' }]);
    } catch (error) {
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', text: 'Error: ' + (error?.message || String(error)) }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col" style={{ height: '70vh', minHeight: '520px' }}>
      {/* Header */}
      <div className="border-b p-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-slate-800">Asistente IA (Gema de Oferta Comercial)</div>
          <div className="text-xs text-slate-500">
            Conocimiento: {knowledgeLoading ? 'cargando…' : `paquetes=${knowledgeSummary.packagesCount || 0}, promos=${knowledgeSummary.promosCount || 0}`}
            {knowledgeError ? ' (error cargando conocimiento)' : ''}
          </div>
        </div>
        <button
          onClick={refreshKnowledge}
          disabled={knowledgeLoading}
          className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
          title="Actualizar conocimiento (paquetes/promos)"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] p-3 rounded-lg ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-3 rounded-lg">
              <p className="text-sm">Pensando…</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ej: arma una oferta para tripleplay y mensaje de WhatsApp para cliente indeciso…"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !chatInput.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2"
          >
            <Send size={18} />
          </button>
        </div>
        {knowledgeError && (
          <div className="mt-2 text-xs text-amber-700">
            No pude cargar/actualizar el conocimiento en el backend. Verifica el deploy de Render y la variable GEMINI_API_KEY.
          </div>
        )}
      </div>
    </div>
  );
}

