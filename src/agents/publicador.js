import { execSync } from 'child_process';
import pc from 'picocolors';
import { callGemini } from '../utils/api-gemini.js';
import { PUBLICADOR_PROMPT } from '../utils/prompts.js';
import { readDoc } from '../utils/files.js';
import { formatTokenReport } from '../utils/token-counter.js';

/**
 * Ejecuta el agente Publicador para el flujo de Git y GitHub.
 * @param {Object} options
 * @param {Function} options.askQuestion Función interactiva de CLI
 * @returns {Promise<Object>} Resultado { success: boolean, reason: string, commitMessage: string, report: string }
 */
export async function runPublisher({ askQuestion }) {
  const model = 'gemini-2.5-flash';
  
  // 1. Verificar si está dentro de un repositorio de git
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  } catch (err) {
    const init = await askQuestion(pc.yellow('El directorio actual no es un repositorio Git. ¿Deseas inicializarlo con "git init"? (s/n) > '));
    if (init.trim().toLowerCase() === 's') {
      execSync('git init');
      console.log(pc.green('✔ Repositorio Git inicializado.'));
    } else {
      return { success: false, reason: 'No se puede continuar sin un repositorio Git.' };
    }
  }

  // 2. Verificar origen remoto
  let hasRemote = true;
  try {
    execSync('git remote get-url origin', { stdio: 'ignore' });
  } catch (err) {
    hasRemote = false;
    const remoteUrl = await askQuestion(pc.yellow('No se ha detectado un control remoto "origin". ¿Deseas ingresar la URL del repositorio remoto? (Deja vacío para omitir push) > '));
    if (remoteUrl.trim()) {
      execSync(`git remote add origin ${remoteUrl.trim()}`);
      hasRemote = true;
      console.log(pc.green(`✔ Origen remoto "origin" configurado: ${remoteUrl.trim()}`));
    }
  }

  // 3. Stagear todos los cambios
  console.log(pc.gray('\nStaging de cambios en curso (git add .)...'));
  execSync('git add .');

  // 4. Verificar si hay cambios en staging
  let stagedFiles = '';
  try {
    stagedFiles = execSync('git diff --staged --name-status', { encoding: 'utf-8' }).trim();
  } catch (e) {
    // Silencioso
  }

  if (!stagedFiles) {
    console.log(pc.red('No hay cambios pendientes para realizar commit.'));
    return { success: false, reason: 'Staging vacío.' };
  }

  // 5. Obtener diff y rama actual
  const stagedDiff = execSync('git diff --staged', { encoding: 'utf-8' });
  let currentBranch = 'main';
  try {
    currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch (e) {
    // Silencioso
  }

  const activeTask = readDoc('ACTIVE_TASK.md');

  // 6. Consultar al LLM el mensaje de commit
  console.log(pc.gray('[Generando mensaje de commit con Conventional Commits...]'));
  const prompt = `
=== TAREA ACTIVA ===
${activeTask}

=== STAGED DIFF ===
${stagedDiff}
`;

  const response = await callGemini({
    model,
    system: PUBLICADOR_PROMPT + '\nResponde estrictamente en formato JSON.',
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

  // 7. Formular commit propuesto
  const scopeStr = data.scope ? `(${data.scope.trim().toLowerCase()})` : '';
  const breakingIndicator = data.breakingChange ? '!' : '';
  let commitMessage = `${data.type.trim().toLowerCase()}${scopeStr}${breakingIndicator}: ${data.subject.trim()}`;
  
  if (data.body) {
    commitMessage += `\n\n${data.body.trim()}`;
  }
  if (data.breakingChange) {
    commitMessage += `\n\nBREAKING CHANGE: ${data.breakingChange.trim()}`;
  }

  // 8. Mostrar Resumen de Operaciones
  console.log(pc.cyan('\n────────────────────────────────────────────────────────────'));
  console.log(pc.bold(pc.magenta('RESUMEN DE OPERACIONES (GIT/GITHUB)')));
  console.log(pc.cyan('\nCambios en staging (git status):'));
  console.log(pc.white(stagedFiles.split('\n').map(l => '  ' + l).join('\n')));
  
  console.log(pc.cyan('\nCommit propuesto:'));
  console.log(pc.green(commitMessage.split('\n').map(l => '  ' + l).join('\n')));
  
  const dest = hasRemote ? `push a origin/${currentBranch}` : 'ninguno (local)';
  console.log(pc.cyan(`\nDestino: ${pc.yellow(dest)}`));
  console.log(pc.cyan('────────────────────────────────────────────────────────────\n'));

  // 9. Solicitar Aprobación
  let action = await askQuestion(pc.bold(pc.yellow('¿Ejecuto todo? (sí / no / o pega tu mensaje editado) > ')));
  const cleanAction = action.trim().toLowerCase();

  if (cleanAction === 'n' || cleanAction === 'no' || cleanAction === 'cancelar') {
    // Deshacer staging
    console.log(pc.gray('Deshaciendo staging de cambios...'));
    execSync('git restore --staged .');
    return { success: false, reason: 'Operación cancelada por el usuario. Los cambios siguen modificados localmente.' };
  }

  let finalMessage = commitMessage;
  if (cleanAction !== 's' && cleanAction !== 'sí' && cleanAction !== 'si' && cleanAction !== 'yes') {
    // El usuario ingresó un mensaje de commit personalizado
    finalMessage = action.trim();
    console.log(pc.green(`\n✔ Usando mensaje de commit personalizado.`));
  }

  // 10. Confirmar y subir a producción
  console.log(pc.gray('\nEjecutando git commit...'));
  
  // Usar escape de comillas para windows/linux de forma segura
  fsWriteTempCommit(finalMessage);
  
  try {
    execSync('git commit -F .efesto_commit_msg.tmp');
    cleanTempCommit();
  } catch (err) {
    cleanTempCommit();
    return { success: false, reason: `Error al hacer commit: ${err.message}` };
  }

  const report = formatTokenReport('PUBLICADOR', model, response.usage.inputTokens, response.usage.outputTokens);

  if (hasRemote) {
    console.log(pc.gray(`Ejecutando git push a origin/${currentBranch}...`));
    try {
      execSync(`git push origin ${currentBranch}`);
      console.log(pc.green(`✔ ¡Push exitoso a origin/${currentBranch}!`));
    } catch (pushErr) {
      console.log(pc.yellow(`El push directo falló. Reintentando con configuración de upstream (-u)...`));
      try {
        execSync(`git push -u origin ${currentBranch}`);
        console.log(pc.green(`✔ ¡Push exitoso con upstream!`));
      } catch (upstreamErr) {
        return {
          success: true,
          commitMessage: finalMessage,
          reason: `Commit creado con éxito localmente, pero el push falló: ${upstreamErr.message}`,
          report
        };
      }
    }
  } else {
    console.log(pc.yellow('Commit guardado localmente (push omitido por falta de origen remoto).'));
  }

  // Mostrar último commit
  const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf-8' }).trim();
  console.log(pc.green(`\n✔ Registro final: ${lastCommit}`));

  return {
    success: true,
    commitMessage: finalMessage,
    report
  };
}

// Helpers locales para escribir archivos de mensaje de commit
import fs from 'fs';
function fsWriteTempCommit(msg) {
  fs.writeFileSync('.efesto_commit_msg.tmp', msg, 'utf-8');
}
function cleanTempCommit() {
  if (fs.existsSync('.efesto_commit_msg.tmp')) {
    fs.unlinkSync('.efesto_commit_msg.tmp');
  }
}
