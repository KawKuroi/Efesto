import dotenv from 'dotenv';
dotenv.config();

/**
 * Llama a la API de Google Gemini usando fetch nativo.
 * @param {Object} options
 * @param {string} options.model Modelo de Gemini (ej. gemini-1.5-flash, gemini-1.5-pro, gemini-2.5-flash)
 * @param {string} options.system Prompt de sistema
 * @param {Array} options.messages Mensajes en formato [{ role, content }]
 * @param {boolean} [options.jsonMode=false] Si se requiere respuesta en formato JSON estructurado
 * @returns {Promise<Object>} Respuesta estructurada { text, usage }
 */
export async function callGemini({ model, system, messages, jsonMode = false }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno GEMINI_API_KEY en tu archivo .env');
  }

  // Normalizar los mensajes para el formato requerido por Gemini REST API
  const contents = messages.map(m => {
    // Para Gemini, el rol del asistente debe ser 'model' y el del usuario 'user'
    const role = m.role === 'assistant' ? 'model' : 'user';
    return {
      role,
      parts: [{ text: m.content }]
    };
  });

  const selectedModel = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  const body = {
    contents
  };

  if (system) {
    body.systemInstruction = {
      parts: [{ text: system }]
    };
  }

  if (jsonMode) {
    body.generationConfig = {
      responseMimeType: 'application/json'
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en API de Gemini (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error(`Gemini no retornó candidatos de respuesta. Respuesta de la API: ${JSON.stringify(data)}`);
  }

  const text = data.candidates[0].content.parts[0].text;
  const usage = data.usageMetadata ? {
    inputTokens: data.usageMetadata.promptTokenCount || 0,
    outputTokens: data.usageMetadata.candidatesTokenCount || 0
  } : { inputTokens: 0, outputTokens: 0 };

  return {
    text,
    usage
  };
}
