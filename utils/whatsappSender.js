// Envío de plantillas de WhatsApp vía Meta Cloud API (API oficial)
// Credenciales SIEMPRE desde variables de entorno, nunca hardcodeadas.

const GRAPH_API_VERSION = 'v21.0';

/**
 * Normaliza un teléfono mexicano a formato E.164 para WhatsApp Cloud API.
 * Meta ya NO requiere el "1" extra después del 52 para números móviles de México
 * (cambio de política de 2022). Se toman los últimos 10 dígitos y se antepone "52".
 */
export function normalizePhoneMx(rawPhone) {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return null;

  // Ya viene con código de país 52 + 10 dígitos (12 en total)
  if (digits.length === 12 && digits.startsWith('52')) {
    return digits;
  }
  // Viene con el "1" extra antiguo: 52 1 XXXXXXXXXX (13 dígitos)
  if (digits.length === 13 && digits.startsWith('521')) {
    return '52' + digits.slice(3);
  }
  // Solo 10 dígitos locales
  if (digits.length === 10) {
    return '52' + digits;
  }
  // Fallback: tomar los últimos 10 dígitos disponibles
  if (digits.length > 10) {
    return '52' + digits.slice(-10);
  }
  return null; // Muy corto para ser un teléfono válido
}

/**
 * Envía un mensaje de plantilla de WhatsApp a un número.
 * @param {string} to - Teléfono ya normalizado en E.164 (sin '+', ej. 5219991234567... según normalizePhoneMx)
 * @param {string} templateName - Nombre exacto de la plantilla aprobada en Meta Business Manager
 * @param {string} languageCode - Código de idioma de la plantilla (ej. 'es_MX', 'es')
 * @param {string[]} bodyParams - Valores en orden para las variables {{1}}, {{2}}, ... del cuerpo de la plantilla
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendWhatsAppTemplate(to, templateName, languageCode, bodyParams = []) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { success: false, error: 'WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados en el servidor' };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode || 'es_MX' },
      components: bodyParams.length > 0 ? [
        {
          type: 'body',
          parameters: bodyParams.map(value => ({ type: 'text', text: String(value ?? '') }))
        }
      ] : []
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMsg = result?.error?.message || `Error HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    const messageId = result?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: error.message || 'Error de red al llamar a la API de WhatsApp' };
  }
}

/** Pequeña espera, usada para no saturar el rate limit de la API */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
