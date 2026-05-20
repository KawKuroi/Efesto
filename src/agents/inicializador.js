import { callGemini } from '../utils/api-gemini.js';
import { INITIALIZER_PROMPT } from '../utils/prompts.js';
import { writeDoc, docExists } from '../utils/files.js';
import { formatTokenReport } from '../utils/token-counter.js';
import pc from 'picocolors';

/**
 * Ejecuta el agente Inicializador.
 * @param {Object} options
 * @param {Array} options.conversationHistory Historial del chat interactivo
 * @returns {Promise<Object>} Resultado { finished: boolean, questions: Array, filesCreated: Array, report: string }
 */
export async function runInitializer({ conversationHistory }) {
  const model = 'gemini-2.5-flash';
  
  // Agregar una instrucción para asegurar el formato JSON
  const systemInstruction = INITIALIZER_PROMPT + '\nDebes responder estrictamente en formato JSON válido.';
  
  // Preparar mensajes para la API
  const messages = [
    ...conversationHistory
  ];

  const response = await callGemini({
    model,
    system: systemInstruction,
    messages,
    jsonMode: true
  });

  let data;
  try {
    data = JSON.parse(response.text.trim());
  } catch (err) {
    // Si falla el parseo, intentar limpiar marcas de formato
    const cleanedText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    data = JSON.parse(cleanedText);
  }

  const report = formatTokenReport('INICIALIZADOR', model, response.usage.inputTokens, response.usage.outputTokens);

  if (data.finished && data.files) {
    const filesCreated = [];
    for (const [filename, content] of Object.entries(data.files)) {
      writeDoc(filename, content);
      filesCreated.push(filename);
    }
    
    return {
      finished: true,
      questions: [],
      filesCreated,
      report
    };
  }

  return {
    finished: false,
    questions: data.questions || ['¿Podrías darme más detalles de la idea de tu aplicación?'],
    filesCreated: [],
    report
  };
}

/**
 * Verifica si los archivos de documentación requeridos ya existen.
 * @returns {boolean}
 */
export function isDocsInitialized() {
  const requiredFiles = ['PRD.md', 'ARCHITECTURE.md', 'ROADMAP.md', 'CURRENT.md', 'GLOBAL.md'];
  return requiredFiles.every(file => docExists(file));
}
