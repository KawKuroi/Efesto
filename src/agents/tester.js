import { execSync } from 'child_process';
import { callGemini } from '../utils/api-gemini.js';
import { TESTER_PROMPT } from '../utils/prompts.js';
import { readDoc, writeDoc } from '../utils/files.js';
import { formatTokenReport } from '../utils/token-counter.js';

/**
 * Ejecuta el agente Tester.
 * @param {Object} options
 * @param {string} [options.testCommand] Comando opcional de consola para validaciones (ej. 'npm run test')
 * @returns {Promise<Object>} Resultado { passed: boolean, errors: Array, reportMarkdown: string, report: string }
 */
export async function runTester({ testCommand = '' } = {}) {
  const model = 'gemini-2.5-flash'; // Flash es veloz y excelente para auditorías basadas en reglas
  
  let consoleOutput = 'No se especificó un comando de prueba en consola.';
  
  // Si hay un comando, ejecutarlo y capturar salida
  if (testCommand) {
    try {
      console.log(`\n⚙ Ejecutando comando de prueba en consola: "${testCommand}"...`);
      const output = execSync(testCommand, { encoding: 'utf-8', stdio: 'pipe' });
      consoleOutput = `Comando ejecutado con ÉXITO.\n\nSalida:\n${output}`;
    } catch (err) {
      consoleOutput = `Comando FALLÓ durante la ejecución.\n\nCódigo de salida: ${err.status}\n\nError/Salida:\n${err.stdout}\n${err.stderr}`;
    }
  }

  // Leer estado y directrices
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

=== SALIDA DE COMANDOS DE CONSOLA (TESTS/BUILD) ===
${consoleOutput}
`;

  const response = await callGemini({
    model,
    system: TESTER_PROMPT + '\nResponde estrictamente en formato JSON.',
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

  // Escribir o actualizar la sección ### 3. Reporte de Pruebas en ACTIVE_TASK.md
  const baseActiveTask = readDoc('ACTIVE_TASK.md');
  const cleanedActiveTask = baseActiveTask.split('### 3. Reporte de Pruebas')[0].trim();
  
  const updatedActiveTask = `${cleanedActiveTask}\n\n${data.reportMarkdown.trim()}`;
  writeDoc('ACTIVE_TASK.md', updatedActiveTask);

  const report = formatTokenReport('TESTER', model, response.usage.inputTokens, response.usage.outputTokens);

  return {
    passed: data.passed,
    errors: data.errors || [],
    reportMarkdown: data.reportMarkdown,
    commandToFix: data.commandToFix || '',
    report
  };
}
