import { callGemini } from '../utils/api-gemini.js';
import { PLANNER_PROMPT } from '../utils/prompts.js';
import { readDoc, writeDoc } from '../utils/files.js';
import { formatTokenReport } from '../utils/token-counter.js';

/**
 * Ejecuta el agente Planificador.
 * @returns {Promise<Object>} Resultado { rationale: string, report: string }
 */
export async function runPlanner() {
  const model = 'gemini-1.5-pro'; // Modelo premium recomendado para planeación
  
  // Leer contexto
  const activeTask = readDoc('ACTIVE_TASK.md');
  const globalRules = readDoc('GLOBAL.md');
  const prd = readDoc('PRD.md');
  
  const prompt = `
=== TAREA ACTIVA ===
${activeTask}

=== GLOBAL.md ===
${globalRules}

=== PRD.md ===
${prd}
`;

  const response = await callGemini({
    model,
    system: PLANNER_PROMPT + '\nResponde estrictamente en formato JSON.',
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

  // Modificar ACTIVE_TASK.md para agregar el plan generado
  const baseActiveTask = readDoc('ACTIVE_TASK.md');
  
  // Eliminar un plan anterior si existe para evitar duplicación
  const cleanedActiveTask = baseActiveTask.split('### 2. Plan de Acción Detallado')[0].trim();
  
  const updatedActiveTask = `${cleanedActiveTask}\n\n${data.planMarkdown.trim()}`;
  writeDoc('ACTIVE_TASK.md', updatedActiveTask);

  const report = formatTokenReport('PLANIFICADOR', model, response.usage.inputTokens, response.usage.outputTokens);

  return {
    rationale: data.rationale,
    report
  };
}
