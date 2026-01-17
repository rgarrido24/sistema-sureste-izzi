import { GEMINI_API_KEY, GEMINI_MODELS } from '../utils/constants.js';

/**
 * Llama a la API de Gemini para obtener respuestas de IA
 */
export async function callGemini(prompt, pdfUrls = []) {
  // Compatibilidad: el sistema ahora usa /api/assistant en backend.
  // Si por alguna razón este servicio se usa, guiar al usuario a configurar backend.
  console.log('Gemini (legacy) - API Key en frontend:', GEMINI_API_KEY ? 'Presente' : 'Falta');
  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
    return "La IA ahora corre desde el backend. Configura GEMINI_API_KEY en Render y usa el módulo Asistente IA.";
  }
  
  try {
    let enhancedPrompt = prompt;
    
    if (pdfUrls && pdfUrls.length > 0) {
      enhancedPrompt += `\n\n📄 DOCUMENTOS PDF DISPONIBLES (${pdfUrls.length} documento(s)):\n`;
      pdfUrls.forEach((url, idx) => {
        enhancedPrompt += `- Documento ${idx + 1}: ${url}\n`;
      });
      enhancedPrompt += `\nIMPORTANTE: Estos PDFs contienen información actualizada sobre promociones, servicios, paquetes y políticas de Izzi. Lee y analiza el contenido completo de estos documentos para responder las preguntas. Si la información está en los PDFs, úsala como fuente principal. Si no encuentras la información en los PDFs, usa la información de paquetes y promociones que se te proporcionó anteriormente.`;
    }
    
    let lastError = null;
    
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(url, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            contents: [{ 
              parts: [{ text: enhancedPrompt }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          }) 
        });
        
        const data = await response.json();
        
        if (data.error) {
          lastError = data.error;
          if (data.error.message?.includes('quota') || data.error.message?.includes('Quota exceeded')) {
            console.log(`Modelo ${model} sin cuota, intentando siguiente...`);
            continue;
          }
          return "Error: " + (data.error.message || "Error al procesar la solicitud");
        }
        
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Error IA: No se recibió respuesta";
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    
    if (lastError?.message?.includes('quota') || lastError?.message?.includes('Quota exceeded')) {
      return "⚠️ Cuota de API excedida. Por favor:\n1. Ve a https://aistudio.google.com/apikey\n2. Verifica tu plan y facturación\n3. O espera unos minutos y vuelve a intentar";
    }
    
    return "Error: " + (lastError?.message || "No se pudo conectar con ningún modelo de Gemini");
  } catch (error) { 
    console.error('Error Gemini:', error);
    return "Error conexión IA: " + error.message; 
  }
}

