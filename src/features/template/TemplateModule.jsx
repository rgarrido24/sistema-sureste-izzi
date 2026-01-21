import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Video, FileText } from 'lucide-react';
import * as api from '../../api.js';

export default function TemplateModule() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    module: 'M1',
    content: '',
    videoUrl: '',
    variables: [],
    isActive: true,
    visibility: 'all'
  });

  // Variables disponibles para usar en plantillas
  const availableVariables = [
    { key: '{nombre}', description: 'Nombre del cliente' },
    { key: '{cuenta}', description: 'Número de cuenta' },
    { key: '{monto}', description: 'Monto total adeudado' },
    { key: '{porVencer}', description: 'Monto por vencer' },
    { key: '{vencido}', description: 'Monto vencido' },
    { key: '{vendedor}', description: 'Nombre del vendedor' },
    { key: '{plaza}', description: 'Plaza del cliente' },
    { key: '{estatus}', description: 'Estatus del cliente (M1, M2, M3, M4)' },
    { key: '{orden}', description: 'Número de orden (Operación del Día)' },
    { key: '{estado}', description: 'Estado de la orden (Operación del Día)' },
    { key: '{fechaSolicitada}', description: 'Fecha solicitada (Operación del Día)' },
    { key: '{fecha}', description: 'Fecha solicitada (Operación del Día)' },
    { key: '{hub}', description: 'Hub (Operación del Día)' }
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error cargando plantillas:', error);
      alert('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateTemplate(
          editingId,
          formData.name,
          formData.module,
          formData.content,
          formData.videoUrl || '',
          formData.variables || [],
          formData.isActive,
          formData.visibility || 'all'
        );
      } else {
        await api.createTemplate(
          formData.name,
          formData.module,
          formData.content,
          formData.videoUrl || '',
          formData.variables || [],
          formData.isActive,
          'admin',
          formData.visibility || 'all'
        );
      }
      await loadTemplates();
      resetForm();
      alert('✅ Plantilla guardada correctamente');
    } catch (error) {
      console.error('Error guardando plantilla:', error);
      console.error('Detalles completos:', error);
      const errorMessage = error.message || error.details?.error || 'Error al guardar plantilla';
      alert(`Error al guardar plantilla: ${errorMessage}`);
    }
  };

  const handleEdit = (template) => {
    setFormData({
      name: template.name,
      module: template.module,
      content: template.content,
      videoUrl: template.videoUrl || '',
      variables: template.variables || [],
      isActive: template.isActive !== undefined ? template.isActive : true,
      visibility: template.visibility || 'all'
    });
    setEditingId(template._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;
    try {
      await api.deleteTemplate(id);
      await loadTemplates();
    } catch (error) {
      console.error('Error eliminando plantilla:', error);
      alert('Error al eliminar plantilla');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      module: 'M1',
      content: '',
      videoUrl: '',
      variables: [],
      isActive: true,
      visibility: 'all'
    });
    setEditingId(null);
    setShowForm(false);
  };

  const insertVariable = (variable) => {
    const textarea = document.querySelector('textarea[placeholder*="Escribe el mensaje"]');
    if (textarea) {
      const start = textarea.selectionStart || formData.content.length;
      const end = textarea.selectionEnd || formData.content.length;
      const newContent = formData.content.substring(0, start) + variable + formData.content.substring(end);
      setFormData({
        ...formData,
        content: newContent
      });
      // Restaurar el foco y posición del cursor después de actualizar
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      // Fallback: agregar al final si no hay textarea
      setFormData({
        ...formData,
        content: formData.content + variable
      });
    }
  };

  const modules = [
    'M1', 'M2', 'M3', 'M4',
    'COBRANZA', 'general',
    'operacion',
    'COBRANZA_RECOMENDACION_FPD_CORRIENTE'
  ];

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <p className="text-slate-600">Cargando plantillas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold mb-2">Plantillas de Mensajes</h2>
            <p className="text-slate-600">
              Crea y gestiona plantillas personalizadas para enviar mensajes de WhatsApp a clientes
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Nueva Plantilla
          </button>
        </div>
      </div>

      {/* Formulario de creación/edición */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">
              {editingId ? 'Editar Plantilla' : 'Nueva Plantilla'}
            </h3>
            <button
              onClick={resetForm}
              className="text-slate-500 hover:text-slate-700"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre de la Plantilla
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Módulo
                </label>
                <select
                  value={formData.module}
                  onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                >
                  {modules.map(module => (
                    <option key={module} value={module}>{module}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="tplVisibilityAdminOnly"
                type="checkbox"
                checked={(formData.visibility || 'all') === 'admin_only'}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.checked ? 'admin_only' : 'all' })}
              />
              <label htmlFor="tplVisibilityAdminOnly" className="text-sm text-slate-700">
                Solo visible para Administrador (recomendación interna)
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Variables Disponibles
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg">
                {availableVariables.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => insertVariable(variable.key)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded text-sm hover:bg-blue-50 hover:border-blue-500 transition-colors"
                    title={variable.description}
                  >
                    {variable.key}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contenido del Mensaje
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                rows={8}
                placeholder="Escribe el mensaje aquí. Usa las variables disponibles arriba."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                URL del Video (Opcional)
              </label>
              <div className="flex items-center gap-2">
                <Video size={20} className="text-slate-400" />
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="https://youtube.com/watch?v=... o https://ejemplo.com/video.mp4"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Pega la URL del video (YouTube, Vimeo, etc.)
              </p>
              {/* Mostrar video actual si existe */}
              {formData.videoUrl && (
                <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">Video actual:</p>
                  <p className="text-xs text-blue-600 break-all">{formData.videoUrl}</p>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, videoUrl: '' })}
                    className="mt-1 text-xs text-red-600 hover:underline"
                  >
                    Eliminar video
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700">
                Plantilla activa
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Save size={20} />
                Guardar
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de plantillas */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold mb-4">Plantillas Existentes</h3>
        
        {templates.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            No hay plantillas creadas. Crea una nueva plantilla para comenzar.
          </p>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template._id}
                className={`p-4 border rounded-lg ${
                  template.isActive
                    ? 'border-green-200 bg-green-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-lg">{template.name}</h4>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        {template.module}
                      </span>
                      {!template.isActive && (
                        <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-sm mb-2 whitespace-pre-wrap">
                      {template.content}
                    </p>
                    {template.videoUrl && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                        <Video size={16} />
                        <a
                          href={template.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          Ver video
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(template._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
