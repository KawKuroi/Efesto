import { callGemini } from '../utils/api-gemini.js';
import { ORCHESTRATOR_PROMPT } from '../utils/prompts.js';
import { readDoc, docExists } from '../utils/files.js';
import { isDocsInitialized } from './inicializador.js';
import { formatTokenReport } from '../utils/token-counter.js';

/**
 * Ejecuta el agente Orquestador para decidir el próximo paso.
 * @param {Object} options
 * @param {string} [options.userRequest] Petición del usuario actual
 * @returns {Promise<Object>} Resultado { nextAgent: string, reason: string, report: string }
 */
export async function runOrchestrator({ userRequest = '' } = {}) {
  const model = 'gemini-2.5-flash';

  // Regla cortocircuito: si no hay documentación básica, forzar Inicializador
  if (!isDocsInitialized()) {
    return {
      nextAgent: 'INITIALIZER',
      reason: 'El proyecto no cuenta con la documentación básica de Efesto en /docs. Se requiere inicializar.',
      report: '📊 [ORQUESTADOR] Cortocircuito local: Forzando INITIALIZER'
    };
  }

  // Leer estado actual
  const activeTask = readDoc('ACTIVE_TASK.md');
  const currentStatus = readDoc('CURRENT.md');

  const prompt = `
=== PETICIÓN DEL USUARIO ===
"${userRequest}"

=== ACTIVE_TASK.md ===
${activeTask || '[No existe una tarea activa]'}

=== CURRENT.md ===
${currentStatus || '[No existe el estado actual del proyecto]'}
`;

  const response = await callGemini({
    model,
    system: ORCHESTRATOR_PROMPT + '\nResponde estrictamente en formato JSON.',
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

  const report = formatTokenReport('ORQUESTADOR', model, response.usage.inputTokens, response.usage.outputTokens);

  return {
    nextAgent: data.nextAgent,
    reason: data.reason,
    report
  };
}
