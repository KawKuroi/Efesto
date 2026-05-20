import dotenv from 'dotenv';
dotenv.config();

/**
 * Llama a la API de Anthropic (Claude) usando fetch nativo.
 * @param {Object} options
 * @param {string} options.model Modelo de Claude (ej. claude-3-5-sonnet-20241022)
 * @param {string} options.system Prompt de sistema
 * @param {Array} options.messages Mensajes en formato [{ role, content }]
 * @param {number} [options.maxTokens=4000] Cantidad máxima de tokens de respuesta
 * @returns {Promise<Object>} Respuesta estructurada { text, usage }
 */
export async function callAnthropic({ model, system, messages, maxTokens = 4000 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno ANTHROPIC_API_KEY en tu archivo .env');
  }

  // Filtrar o normalizar mensajes
  const formattedMessages = messages.map(m => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.content
  }));

  const url = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  };

  const body = {
    model: model || 'claude-3-5-sonnet-20241022',
    max_tokens: maxTokens,
    messages: formattedMessages
  };

  if (system) {
    body.system = system;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en API de Anthropic (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  return {
    text: data.content[0].text,
    usage: {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens
    }
  };
}
