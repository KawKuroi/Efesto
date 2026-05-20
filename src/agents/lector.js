import { callGemini } from '../utils/api-gemini.js';
import { READER_PROMPT } from '../utils/prompts.js';
import { readDoc, writeDoc, getDirectoryFiles, readProjectFile } from '../utils/files.js';
import { formatTokenReport } from '../utils/token-counter.js';

/**
 * Ejecuta el agente Lector.
 * @param {Object} options
 * @param {string} options.userRequest Solicitud del usuario (feature / bug)
 * @returns {Promise<Object>} Resultado { selectedFiles: Array, activeTaskPath: string, report: string }
 */
export async function runReader({ userRequest }) {
  const model = 'gemini-2.5-flash';
  
  // Leer archivos de documentación base
  const architecture = readDoc('ARCHITECTURE.md');
  const globalRules = readDoc('GLOBAL.md');
  const currentStatus = readDoc('CURRENT.md');
  
  // Obtener lista completa de archivos del proyecto
  const projectFiles = getDirectoryFiles();
  
  // Construir el prompt de entrada
  const prompt = `
=== SOLICITUD DEL USUARIO ===
"${userRequest}"

=== ARCHITECTURE.md ===
${architecture}

=== GLOBAL.md ===
${globalRules}

=== CURRENT.md ===
${currentStatus}

=== ÁRBOL DE DIRECTORIOS DEL PROYECTO ===
${projectFiles.join('\n')}
`;

  const response = await callGemini({
    model,
    system: READER_PROMPT + '\nResponde estrictamente en formato JSON.',
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

  // Leer físicamente el código de cada archivo seleccionado por la IA
  const selectedFiles = data.selectedFiles || [];
  let filesContentSection = '\n\n#### Código de Archivos Afectados:\n';
  
  for (const filepath of selectedFiles) {
    const fileContent = readProjectFile(filepath);
    const extension = filepath.split('.').pop();
    filesContentSection += `\n**Archivo: \`${filepath}\`**\n\`\`\`${extension}\n${fileContent || '// [Archivo vacío o no encontrado]'}\n\`\`\`\n`;
  }

  // Escribir el nuevo archivo ACTIVE_TASK.md en /docs
  const activeTaskContent = `# TAREA ACTIVA: ${userRequest}

## Descripción
${data.reason}

### 1. Contexto y Archivos Afectados
${data.markdownContext}
${filesContentSection}
`;

  writeDoc('ACTIVE_TASK.md', activeTaskContent);

  const report = formatTokenReport('LECTOR', model, response.usage.inputTokens, response.usage.outputTokens);

  return {
    selectedFiles,
    activeTaskPath: './docs/ACTIVE_TASK.md',
    report
  };
}
