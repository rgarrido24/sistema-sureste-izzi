import express from 'express';
import Template from '../models/Template.js';

const router = express.Router();

// Obtener todas las plantillas
router.get('/', async (req, res) => {
  try {
    const { module } = req.query;
    
    // Si se especifica un módulo, buscar con coincidencia flexible
    let query = {};
    
    // Si no se especifica módulo, obtener todas las plantillas activas
    if (!module) {
      query = { isActive: true };
    } else {
      // Búsqueda flexible: coincidencia exacta o case-insensitive
      query.$or = [
        { module: module },
        { module: module.toUpperCase() },
        { module: module.toLowerCase() },
        { module: module.charAt(0).toUpperCase() + module.slice(1).toLowerCase() }
      ];
      
      // Para M1, también buscar "cobranza" y "general"
      if (module === 'M1' || module === 'm1') {
        query.$or.push(
          { module: 'cobranza' },
          { module: 'COBRANZA' },
          { module: 'Cobranza' },
          { module: 'general' },
          { module: 'GENERAL' },
          { module: 'General' }
        );
      }
      
      // Para M2, M3, M4, también buscar "general"
      if (module === 'M2' || module === 'm2' || module === 'M3' || module === 'm3' || module === 'M4' || module === 'm4') {
        query.$or.push(
          { module: 'general' },
          { module: 'GENERAL' },
          { module: 'General' }
        );
      }
      
      // Para operacion, también buscar "general" y variaciones
      if (module === 'operacion' || module === 'OPERACION' || module === 'Operacion' || 
          module === 'operación' || module === 'OPERACIÓN' || module === 'Operación') {
        query.$or.push(
          { module: 'general' },
          { module: 'GENERAL' },
          { module: 'General' },
          { module: 'operacion' },
          { module: 'OPERACION' },
          { module: 'Operacion' },
          { module: 'operación' },
          { module: 'OPERACIÓN' },
          { module: 'Operación' }
        );
      }
    }
    
    const templates = await Template.find(query).sort({ createdAt: -1 });
    console.log(`📋 Plantillas encontradas: ${templates.length} para módulo: ${module || 'todos'}`);
    res.json(templates);
  } catch (error) {
    console.error('❌ Error obteniendo plantillas:', error);
    console.error('Detalles:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message || 'Error del servidor' });
  }
});

// Obtener una plantilla por ID
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error obteniendo plantilla:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear plantilla
router.post('/', async (req, res) => {
  try {
    const { name, module, content, videoUrl, variables, isActive, createdBy } = req.body;
    
    console.log('📝 Creando plantilla con datos:', { name, module, content: content?.substring(0, 50) + '...', videoUrl, variables, isActive });
    
    // Validar campos requeridos
    if (!name || !module || !content) {
      return res.status(400).json({ error: 'Nombre, módulo y contenido son requeridos' });
    }
    
    const template = new Template({
      name,
      module,
      content,
      videoUrl: videoUrl || '',
      variables: variables || [],
      isActive: isActive !== undefined ? isActive : true,
      createdBy: createdBy || 'admin'
    });
    
    const savedTemplate = await template.save();
    console.log('✅ Plantilla creada exitosamente:', savedTemplate._id);
    res.json(savedTemplate);
  } catch (error) {
    console.error('❌ Error creando plantilla:', error);
    console.error('Detalles del error:', error.message);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(e => e.message).join(', ');
      console.error('Errores de validación:', validationErrors);
      return res.status(400).json({ error: `Error de validación: ${validationErrors}` });
    }
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message || 'Error del servidor' });
  }
});

// Actualizar plantilla
router.put('/:id', async (req, res) => {
  try {
    const { name, module, content, videoUrl, variables, isActive } = req.body;
    
    console.log('📝 Actualizando plantilla:', req.params.id);
    console.log('Datos recibidos:', { name, module, content: content?.substring(0, 50) + '...', videoUrl, variables, isActive });
    
    // Validar campos requeridos
    if (!name || !module || !content) {
      return res.status(400).json({ error: 'Nombre, módulo y contenido son requeridos' });
    }
    
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      {
        name,
        module,
        content,
        videoUrl: videoUrl || '',
        variables: variables || [],
        isActive: isActive !== undefined ? isActive : true
      },
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    
    console.log('✅ Plantilla actualizada exitosamente');
    res.json(template);
  } catch (error) {
    console.error('❌ Error actualizando plantilla:', error);
    console.error('Detalles del error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message || 'Error del servidor' });
  }
});

// Eliminar plantilla
router.delete('/:id', async (req, res) => {
  try {
    const template = await Template.findByIdAndDelete(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando plantilla:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;

