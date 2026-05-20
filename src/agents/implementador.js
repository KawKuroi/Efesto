import { callAnthropic } from '../utils/api-anthropic.js';
import { callGemini } from '../utils/api-gemini.js';
import { IMPLEMENTER_PROMPT } from '../utils/prompts.js';
import { readDoc, writeDoc, writeProjectFile } from '../utils/files.js';
import { formatTokenReport } from '../utils/token-counter.js';

/**
 * Ejecuta el agente Implementador.
 * Intenta utilizar Claude 3.5 Sonnet por defecto, cayendo en Gemini 1.5 Pro si no hay API Key de Anthropic.
 * @returns {Promise<Object>} Resultado { summary: string, filesUpdated: Array, report: string }
 */
export async function runImplementer() {
  let model = 'claude-3-5-sonnet-20241022';
  let response;
  
  const activeTask = readDoc('ACTIVE_TASK.md');
  const globalRules = readDoc('GLOBAL.md');
  
  const prompt = `
=== TAREA ACTIVA ===
${activeTask}

=== GLOBAL.md ===
${globalRules}
`;

  // Intentar usar Anthropic primero
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      response = await callAnthropic({
        model,
        system: IMPLEMENTER_PROMPT + '\nResponde estrictamente en formato JSON válido conteniendo el mapa de archivos modificados.',
        messages: [{ role: 'user', content: prompt }]
      });
    } catch (err) {
      console.warn(`[Aviso] Falla al usar Anthropic, reintentando con Gemini 1.5 Pro: ${err.message}`);
      model = 'gemini-1.5-pro';
      response = await callGemini({
        model,
        system: IMPLEMENTER_PROMPT,
        messages: [{ role: 'user', content: prompt }],
        jsonMode: true
      });
    }
  } else {
    model = 'gemini-1.5-pro';
    response = await callGemini({
      model,
      system: IMPLEMENTER_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      jsonMode: true
    });
  }

  let data;
  try {
    data = JSON.parse(response.text.trim());
  } catch (err) {
    const cleanedText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    data = JSON.parse(cleanedText);
  }

  // Modificar físicamente los archivos del proyecto
  const filesUpdated = [];
  if (data.files) {
    for (const [filepath, content] of Object.entries(data.files)) {
      writeProjectFile(filepath, content);
      filesUpdated.push(filepath);
    }
  }

  // Marcar los checkboxes del plan como completados
  let updatedActiveTask = readDoc('ACTIVE_TASK.md');
  updatedActiveTask = updatedActiveTask.replace(/- \[\s*\]/g, '- [x]');
  writeDoc('ACTIVE_TASK.md', updatedActiveTask);

  const report = formatTokenReport('IMPLEMENTADOR', model, response.usage.inputTokens, response.usage.outputTokens);

  return {
    summary: data.summary || 'Código implementado con éxito.',
    filesUpdated,
    report
  };
}
