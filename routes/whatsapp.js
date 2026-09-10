import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendWhatsAppTemplate, normalizePhoneMx, sleep } from '../utils/whatsappSender.js';
import WhatsAppLog from '../models/WhatsAppLog.js';
import M0Master from '../models/M0Master.js';
import M1Master from '../models/M1Master.js';
import M2Master from '../models/M2Master.js';
import M3Master from '../models/M3Master.js';
import M4Master from '../models/M4Master.js';

const router = express.Router();
router.use(requireAuth);

const MODELS_BY_MODULE = {
  m0: M0Master,
  m1: M1Master,
  m2: M2Master,
  m3: M3Master,
  m4: M4Master,
};

// Roles autorizados a disparar envíos masivos
const CAN_SEND_BULK = ['admin', 'admin_general', 'mesa_control'];

// Listar las plantillas aprobadas en Meta Business Manager (si WHATSAPP_BUSINESS_ACCOUNT_ID está configurado)
router.get('/templates', async (req, res) => {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!token || !wabaId) {
      return res.status(400).json({
        error: 'WHATSAPP_TOKEN o WHATSAPP_BUSINESS_ACCOUNT_ID no configurados en el servidor'
      });
    }

    const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=100`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: result?.error?.message || 'Error consultando plantillas' });
    }

    const templates = (result.data || [])
      .filter(t => t.status === 'APPROVED')
      .map(t => ({
        name: t.name,
        language: t.language,
        category: t.category,
        // Extraer el texto del cuerpo y cuántas variables {{n}} tiene, para guiar el mapeo en el frontend
        bodyText: t.components?.find(c => c.type === 'BODY')?.text || '',
      }));

    res.json(templates);
  } catch (error) {
    console.error('Error obteniendo plantillas de WhatsApp:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Envío masivo: recibe una lista de cuentas de un módulo (m0-m4), una plantilla y el mapeo de variables
router.post('/send-bulk', async (req, res) => {
  try {
    if (!CAN_SEND_BULK.includes(req.user?.role)) {
      return res.status(403).json({ error: 'No autorizado para enviar mensajes masivos' });
    }

    const {
      modulo,           // 'm0' | 'm1' | 'm2' | 'm3' | 'm4'
      cuentas,          // array de números de cuenta a los que enviar
      templateName,     // nombre exacto de la plantilla aprobada
      languageCode,     // ej. 'es_MX'
      variableFields,   // array de nombres de campo del documento, en orden, para llenar {{1}}, {{2}}, ...
      telefonoField,    // 'Telefono1' (default) o 'Telefono2'
    } = req.body;

    const Model = MODELS_BY_MODULE[modulo];
    if (!Model) {
      return res.status(400).json({ error: 'Módulo inválido. Usa m0, m1, m2, m3 o m4' });
    }
    if (!Array.isArray(cuentas) || cuentas.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de cuentas' });
    }
    if (!templateName) {
      return res.status(400).json({ error: 'Falta el nombre de la plantilla' });
    }

    const phoneField = telefonoField || 'Telefono1';
    const batchId = `${modulo}-${Date.now()}`;

    const docs = await Model.find({ cuenta: { $in: cuentas } }).lean();
    const docsByCuenta = new Map(docs.map(d => [d.cuenta, d]));

    let enviados = 0;
    let errores = 0;
    let omitidosSinTelefono = 0;
    const detalleErrores = [];

    // Enviar en lotes pequeños con pausa entre lotes para no saturar el rate limit de Meta
    const CONCURRENCY = 5;
    const DELAY_BETWEEN_BATCHES_MS = 1200;

    for (let i = 0; i < cuentas.length; i += CONCURRENCY) {
      const lote = cuentas.slice(i, i + CONCURRENCY);

      const resultados = await Promise.all(lote.map(async (cuenta) => {
        const doc = docsByCuenta.get(cuenta);
        if (!doc) {
          return { cuenta, status: 'error', errorMessage: 'Cuenta no encontrada en el módulo' };
        }

        const rawPhone = doc[phoneField] || doc.Telefono1 || doc.Telefono2 || '';
        const telefono = normalizePhoneMx(rawPhone);
        if (!telefono) {
          return { cuenta, status: 'omitido_sin_telefono', telefono: rawPhone };
        }

        const bodyParams = (variableFields || []).map(field => doc[field] ?? '');
        const result = await sendWhatsAppTemplate(telefono, templateName, languageCode, bodyParams);

        if (result.success) {
          return { cuenta, status: 'enviado', telefono, providerMessageId: result.messageId };
        }
        return { cuenta, status: 'error', telefono, errorMessage: result.error };
      }));

      // Registrar en log y contar
      const logDocs = resultados.map(r => ({
        cuenta: r.cuenta,
        telefono: r.telefono || '',
        modulo,
        templateName,
        languageCode: languageCode || 'es_MX',
        status: r.status,
        providerMessageId: r.providerMessageId || '',
        errorMessage: r.errorMessage || '',
        sentBy: req.user?.username || '',
        batchId,
      }));
      if (logDocs.length > 0) {
        try { await WhatsAppLog.insertMany(logDocs, { ordered: false }); } catch (e) { /* no bloquear por error de log */ }
      }

      resultados.forEach(r => {
        if (r.status === 'enviado') enviados++;
        else if (r.status === 'omitido_sin_telefono') omitidosSinTelefono++;
        else {
          errores++;
          if (detalleErrores.length < 20) detalleErrores.push({ cuenta: r.cuenta, error: r.errorMessage });
        }
      });

      if (i + CONCURRENCY < cuentas.length) {
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    res.json({
      success: true,
      batchId,
      total: cuentas.length,
      enviados,
      errores,
      omitidosSinTelefono,
      detalleErrores: detalleErrores.length > 0 ? detalleErrores : undefined,
    });
  } catch (error) {
    console.error('Error en envío masivo de WhatsApp:', error);
    res.status(500).json({ error: 'Error del servidor', message: error.message });
  }
});

// Historial de envíos (para revisar qué se mandó y qué falló)
router.get('/logs', async (req, res) => {
  try {
    const { batchId, modulo, status, limit = 200 } = req.query;
    const query = {};
    if (batchId) query.batchId = batchId;
    if (modulo) query.modulo = modulo;
    if (status) query.status = status;

    const logs = await WhatsAppLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit) || 200, 1000))
      .lean();

    res.json(logs);
  } catch (error) {
    console.error('Error obteniendo logs de WhatsApp:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Resumen de un batch (para la pantalla de "resultado del envío masivo")
router.get('/logs/summary/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const logs = await WhatsAppLog.find({ batchId }).lean();
    const summary = {
      batchId,
      total: logs.length,
      enviados: logs.filter(l => l.status === 'enviado').length,
      errores: logs.filter(l => l.status === 'error').length,
      omitidosSinTelefono: logs.filter(l => l.status === 'omitido_sin_telefono').length,
    };
    res.json(summary);
  } catch (error) {
    console.error('Error obteniendo resumen de batch:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
