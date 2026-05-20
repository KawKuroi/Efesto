import { callGemini } from '../utils/api-gemini.js';
import { COMPLETADOR_PROMPT } from '../utils/prompts.js';
import { readDoc, writeDoc } from '../utils/files.js';
import { formatTokenReport } from '../utils/token-counter.js';

/**
 * Ejecuta el agente Completador para actualizar la documentación.
 * @returns {Promise<Object>} Resultado { summary: string, phaseTransition: boolean, report: string }
 */
export async function runCompleter() {
  const model = 'gemini-2.5-flash';

  const activeTask = readDoc('ACTIVE_TASK.md');
  const current = readDoc('CURRENT.md');
  const roadmap = readDoc('ROADMAP.md');

  const prompt = `
=== ACTIVE_TASK.md ===
${activeTask || '[No existe una tarea activa]'}

=== CURRENT.md ===
${current || '[No existe el estado actual del proyecto]'}

=== ROADMAP.md ===
${roadmap || '[No existe el roadmap del proyecto]'}
`;

  const response = await callGemini({
    model,
    system: COMPLETADOR_PROMPT + '\nResponde estrictamente en formato JSON.',
    messages: [{ role: 'user', content: prompt }],
    jsonMode: true
  });

  let data;
  try {
    data = JSON.parse(response.text.trim());
  } catch (err) {
    const cleanedText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    data = JSON.parse(cleanedText);
  }

  // Escribir los cambios de archivos a disco
  if (data.files) {
    for (const [filename, content] of Object.entries(data.files)) {
      if (content) {
        writeDoc(filename, content);
      }
    }
  }

  const report = formatTokenReport('COMPLETADOR', model, response.usage.inputTokens, response.usage.outputTokens);

  return {
    summary: data.summary || 'Documentación actualizada con éxito.',
    phaseTransition: !!data.phaseTransition,
    report
  };
}
