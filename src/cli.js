#!/usr/bin/env node
import readline from 'readline';
import pc from 'picocolors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Importar agentes e utilidades
import { runOrchestrator } from './agents/orquestador.js';
import { runInitializer, isDocsInitialized } from './agents/inicializador.js';
import { runReader } from './agents/lector.js';
import { runPlanner } from './agents/planificador.js';
import { runImplementer } from './agents/implementador.js';
import { runTester } from './agents/tester.js';
import { runCompleter } from './agents/completador.js';
import { runPublisher } from './agents/publicador.js';
import { readDoc, writeDoc, ensureDocsDir } from './utils/files.js';

// 1. Cargar .env de la carpeta de trabajo actual (local)
dotenv.config();

// 2. Cargar .env de la carpeta global de usuario (~/.efesto/.env o ~/.sama/.env)
let globalConfigDir = path.join(os.homedir(), '.efesto');
let globalEnvPath = path.join(globalConfigDir, '.env');

if (!fs.existsSync(globalEnvPath)) {
  const fallbackDir = path.join(os.homedir(), '.sama');
  const fallbackEnv = path.join(fallbackDir, '.env');
  if (fs.existsSync(fallbackEnv)) {
    globalConfigDir = fallbackDir;
    globalEnvPath = fallbackEnv;
  } else {
    try {
      fs.mkdirSync(globalConfigDir, { recursive: true });
      // Crear una plantilla inicial global
      fs.writeFileSync(globalEnvPath, `# Configuración global de EFESTO\nGEMINI_API_KEY=\nANTHROPIC_API_KEY=\n`, 'utf-8');
    } catch (e) {
      // Ignorar errores silenciosamente si no hay permisos de escritura en home
    }
  }
}

if (fs.existsSync(globalEnvPath)) {
  dotenv.config({ path: globalEnvPath });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Historial para el inicializador interactivo
let initializerHistory = [];
let accumulatedReports = [];

async function printHeader() {
  console.clear();
  console.log(pc.cyan('========================================================================'));
  console.log(pc.bold(pc.magenta('    EFESTO CLI - Ecosistema de Forjado y Ejecución de Soluciones Técnicas')));
  console.log(pc.italic(pc.gray('   Desarrollo autónomo optimizado, sin SDKs y de alta eficiencia')));
  console.log(pc.cyan('========================================================================\n'));
  
  // Validar credenciales
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  console.log(`${pc.bold('Estado de APIs:')}`);
  console.log(`- Google Gemini API: ${hasGemini ? pc.green('CONECTADO') : pc.red('NO DETECTADO (.env)')}`);
  console.log(`- Anthropic Claude API: ${hasAnthropic ? pc.green('CONECTADO (Recomendado para Implementador)') : pc.yellow('SIN KEY (Se usará Gemini Pro de fallback)')}`);
  console.log(`- Documentación en /docs: ${isDocsInitialized() ? pc.green('INICIALIZADA') : pc.yellow('PENDIENTE DE INICIALIZAR (/start)')}`);
  console.log(pc.cyan('\n------------------------------------------------------------------------'));
  console.log(`${pc.bold('Comandos disponibles:')}`);
  console.log(`  ${pc.cyan('/start')}          - Inicializar interactivamente los documentos en /docs`);
  console.log(`  ${pc.cyan('/task [texto]')}   - Iniciar el ciclo autónomo para una nueva Feature o Bug`);
  console.log(`  ${pc.cyan('/hotfix [texto]')} - Pausar tarea activa y resolver un bug crítico prioritario`);
  console.log(`  ${pc.cyan('/status')}         - Ver el estado de los archivos de documentación`);
  console.log(`  ${pc.cyan('/exit')}           - Salir de la aplicación`);
  console.log(pc.cyan('========================================================================\n'));
}

async function handleInitializer() {
  console.log(pc.yellow('\n[Agente Inicializador] Activado.'));
  console.log(pc.gray('Este agente creará PRD.md, ARCHITECTURE.md, ROADMAP.md, CURRENT.md y GLOBAL.md.'));
  console.log(pc.gray('Describe tu aplicación (idea general, stack, objetivos) para comenzar:\n'));

  initializerHistory = [];
  
  let userSpec = await askQuestion(pc.cyan('Tú > '));
  initializerHistory.push({ role: 'user', content: userSpec });

  let working = true;
  while (working) {
    console.log(pc.gray('\n[Inicializador pensando e inspeccionando...]'));
    const result = await runInitializer({ conversationHistory: initializerHistory });
    
    if (result.report) accumulatedReports.push(result.report);

    if (result.finished) {
      console.log(pc.green(`\n[OK] Documentación inicial creada con éxito en /docs.`));
      console.log(pc.gray(`Archivos generados: ${result.filesCreated.join(', ')}`));
      working = false;
    } else {
      console.log(pc.magenta('\n[Inicializador] solicita aclaraciones:'));
      for (const question of result.questions) {
        console.log(pc.yellow(`- ${question}`));
      }
      console.log();
      
      let answer = await askQuestion(pc.cyan('Tú (responde a las preguntas) > '));
      initializerHistory.push({ role: 'model', content: JSON.stringify({ finished: false, questions: result.questions }) });
      initializerHistory.push({ role: 'user', content: answer });
    }
  }
}

async function handleTask(userRequest, isHotfix = false) {
  if (!isDocsInitialized()) {
    console.log(pc.red('\n[Error] Debes inicializar el proyecto primero con /start antes de ejecutar tareas.'));
    return;
  }

  accumulatedReports = [];
  console.log(pc.cyan(`\nIniciando ciclo para la tarea: "${userRequest}"`));

  // 1. Orquestación Inicial -> Decidir qué hacer
  console.log(pc.gray('\n[Orquestador analizando la petición...]'));
  const state = await runOrchestrator({ userRequest });
  if (state.report) accumulatedReports.push(state.report);
  console.log(pc.gray(`Orquestador decidió: ${state.nextAgent} | Razón: ${state.reason}`));

  // 2. Ejecutar Lector
  console.log(pc.yellow('\n[1/4] Activando Agente LECTOR...'));
  console.log(pc.gray('Escaneando el código fuente y seleccionando archivos relevantes...'));
  const readerResult = await runReader({ userRequest });
  if (readerResult.report) accumulatedReports.push(readerResult.report);
  console.log(pc.green(`[OK] Lector completado. Archivos seleccionados para contexto: `));
  for (const file of readerResult.selectedFiles) {
    console.log(pc.gray(`  - ${file}`));
  }

  // 3. Ejecutar Planificador
  console.log(pc.yellow('\n[2/4] Activando Agente PLANIFICADOR...'));
  console.log(pc.gray('Diseñando la estrategia de implementación en base a GLOBAL.md y PRD.md...'));
  const plannerResult = await runPlanner();
  if (plannerResult.report) accumulatedReports.push(plannerResult.report);
  console.log(pc.green('[OK] Planificador completado. Plan guardado en /docs/ACTIVE_TASK.md'));
  
  // Mostrar el plan al usuario
  console.log(pc.cyan('\n------------------- PLAN DE ACCIÓN PROPUESTO -------------------'));
  const activeTaskContent = readDoc('ACTIVE_TASK.md');
  const planSection = activeTaskContent.split('### 2. Plan de Acción Detallado')[1] || 'No se pudo leer el plan.';
  console.log(pc.white(planSection.trim()));
  console.log(pc.cyan('----------------------------------------------------------------\n'));

  // PARADA TÁCTICA: Solicitar aprobación al usuario
  let approved = false;
  while (!approved) {
    const input = await askQuestion(pc.bold(pc.yellow('¿Apruebas este plan de implementación? (s/n/editar) > ')));
    const cleanInput = input.trim().toLowerCase();
    
    if (cleanInput === 's' || cleanInput === 'y' || cleanInput === 'si') {
      approved = true;
    } else if (cleanInput === 'n' || cleanInput === 'no') {
      console.log(pc.red('Tarea cancelada por el usuario.'));
      return;
    } else {
      console.log(pc.gray('\nSi deseas ajustar el plan, puedes editar directamente el archivo "./docs/ACTIVE_TASK.md" en tu editor y luego presionar "s" aquí para continuar.'));
    }
  }

  // 4. Ejecutar Implementador
  console.log(pc.yellow('\n[3/4] Activando Agente IMPLEMENTADOR...'));
  console.log(pc.gray('Aplicando modificaciones de código de forma stateless...'));
  const implementResult = await runImplementer();
  if (implementResult.report) accumulatedReports.push(implementResult.report);
  console.log(pc.green('[OK] Implementador completado.'));
  console.log(pc.gray(`Archivos modificados físicamente en disco:`));
  for (const file of implementResult.filesUpdated) {
    console.log(pc.green(`  [MODIFICADO] ${file}`));
  }
  console.log(pc.italic(pc.gray(`Resumen: ${implementResult.summary}`)));

  // 5. Ejecutar Tester
  console.log(pc.yellow('\n[4/4] Activando Agente TESTER...'));
  console.log(pc.gray('Iniciando auditoría estática y validaciones de seguridad...'));
  
  // Preguntar si quiere correr un comando de pruebas real en su terminal
  const testCmd = await askQuestion(pc.cyan('¿Qué comando deseas ejecutar para verificar el código? (Opcional, ej: "npm run test" o presiona Enter para omitir) > '));
  
  const testResult = await runTester({ testCommand: testCmd.trim() });
  if (testResult.report) accumulatedReports.push(testResult.report);

  console.log(pc.cyan('\n--------------------- REPORTE DE PRUEBAS ---------------------'));
  console.log(pc.white(testResult.reportMarkdown.trim()));
  console.log(pc.cyan('--------------------------------------------------------------\n'));

  // Evaluar resultado del test
  if (testResult.passed) {
    console.log(pc.bold(pc.green('[EXITO] La tarea ha pasado todas las validaciones del Tester sin errores.')));
    
    // 6. Activar Completador para actualizar ROADMAP.md y CURRENT.md
    console.log(pc.yellow('\n[Completador] Activando Agente COMPLETADOR...'));
    console.log(pc.gray('Actualizando ROADMAP.md y CURRENT.md...'));
    const completerResult = await runCompleter();
    if (completerResult.report) accumulatedReports.push(completerResult.report);
    
    console.log(pc.green('\n[OK] Completador finalizado exitosamente.'));
    console.log(pc.cyan('--------------------- RESUMEN DE CAMBIOS ---------------------'));
    console.log(pc.white(completerResult.summary));
    console.log(pc.cyan('--------------------------------------------------------------\n'));

    // 7. Activar Publicador para Conventional Commit + Push
    console.log(pc.yellow('[Publicador] Activando Agente PUBLICADOR (Git/GitHub)...'));
    const publisherResult = await runPublisher({ askQuestion });
    if (publisherResult.report) accumulatedReports.push(publisherResult.report);

    if (publisherResult.success) {
      console.log(pc.bold(pc.green('[EXITO] Flujo de publicación completado con éxito.')));
    } else {
      console.log(pc.bold(pc.yellow(`[Aviso] Publicación no completada: ${publisherResult.reason}`)));
    }
    
    // Limpieza: renombrar ACTIVE_TASK.md a una carpeta de logs o archivarla
    try {
      ensureDocsDir();
      fs.renameSync('./docs/ACTIVE_TASK.md', `./docs/FINISHED_TASK_${Date.now()}.md`);
      console.log(pc.gray('ACTIVE_TASK.md ha sido archivado exitosamente.'));
    } catch (e) {
      // Ignorar errores menores de archivado
    }

    // 8. Flujo Hotfix: Reanudar tarea pausada
    if (isHotfix && fs.existsSync('./docs/ACTIVE_TASK_PAUSED.md')) {
      console.log(pc.bold(pc.yellow('\n[Aviso] Se detectó una tarea pausada previa (ACTIVE_TASK_PAUSED.md).')));
      const resume = await askQuestion(pc.cyan('¿Deseas reanudar la tarea pausada ahora? (s/n) > '));
      if (resume.trim().toLowerCase() === 's') {
        fs.renameSync('./docs/ACTIVE_TASK_PAUSED.md', './docs/ACTIVE_TASK.md');
        console.log(pc.green('[OK] Tarea pausada reanudada. ACTIVE_TASK.md restaurado.'));
      }
    }
  } else {
    console.log(pc.bold(pc.red('[Fallo] PRUEBAS FALLIDAS. El Tester detectó los siguientes errores:')));
    for (const err of testResult.errors) {
      console.log(pc.red(`  - ${err}`));
    }
    console.log(pc.yellow('\nEl ciclo de vida del agente se reactivará para corregir el plan y el código.'));
    
    const reIterate = await askQuestion(pc.cyan('¿Deseas iniciar la re-planificación automática para corregir los fallos? (s/n) > '));
    if (reIterate.trim().toLowerCase() === 's') {
      await handleRePlanning(userRequest);
    }
  }

  // Imprimir reporte de costos al final
  printCostReport();
}

async function handleRePlanning(userRequest) {
  console.log(pc.yellow('\n[Re-planificación] Reactivando PLANIFICADOR para corrección de errores...'));
  const plannerResult = await runPlanner();
  if (plannerResult.report) accumulatedReports.push(plannerResult.report);
  console.log(pc.green('[OK] Planificador completado. Plan de corrección guardado en ACTIVE_TASK.md.'));
  
  // Continuar el bucle de implementación
  console.log(pc.yellow('\n[Implementación] Reactivando Agente IMPLEMENTADOR para aplicar correcciones...'));
  const implementResult = await runImplementer();
  if (implementResult.report) accumulatedReports.push(implementResult.report);
  console.log(pc.green('[OK] Correcciones aplicadas en disco.'));

  console.log(pc.yellow('\n[Pruebas] Reactivando Agente TESTER para re-evaluar...'));
  const testResult = await runTester();
  if (testResult.report) accumulatedReports.push(testResult.report);

  if (testResult.passed) {
    console.log(pc.bold(pc.green('[EXITO] Las correcciones solucionaron los fallos. Tarea completada.')));
  } else {
    console.log(pc.red('[Fallo] Los fallos persisten. Te sugerimos revisar ./docs/ACTIVE_TASK.md para resolver manualmente la iteración.'));
  }
}

function printCostReport() {
  console.log(pc.cyan('\n===================== REPORTE DE CONSUMO Y TOKENS ====================='));
  for (const report of accumulatedReports) {
    console.log(pc.gray(report));
  }
  console.log(pc.cyan('========================================================================\n'));
}

async function handleStatus() {
  console.log(pc.bold('\nStatus de Documentación en /docs:'));
  const files = ['PRD.md', 'ARCHITECTURE.md', 'ROADMAP.md', 'CURRENT.md', 'GLOBAL.md', 'ACTIVE_TASK.md'];
  for (const file of files) {
    const exists = fs.existsSync(path.join('./docs', file));
    console.log(`- ${file}: ${exists ? pc.green('EXISTE') : pc.red('NO EXISTE')}`);
  }
  console.log();
}

async function mainLoop() {
  await printHeader();
  
  let running = true;
  while (running) {
    const input = await askQuestion(pc.magenta('efesto > '));
    const parts = input.trim().split(' ');
    const command = parts[0];
    const args = parts.slice(1).join(' ');

    switch (command) {
      case '/start':
      case '/init':
        await handleInitializer();
        break;
      case '/task':
        if (!args) {
          console.log(pc.red('Uso correcto: /task [Descripción de la Feature o Bug]'));
        } else {
          await handleTask(args);
        }
        break;
      case '/hotfix':
        if (!args) {
          console.log(pc.red('Uso correcto: /hotfix [Descripción del bug crítico]'));
        } else {
          if (fs.existsSync('./docs/ACTIVE_TASK.md')) {
            console.log(pc.yellow('\n[HOTFIX] Pausando tarea actual activa (Guardada en ACTIVE_TASK_PAUSED.md)...'));
            fs.renameSync('./docs/ACTIVE_TASK.md', './docs/ACTIVE_TASK_PAUSED.md');
          }
          await handleTask(`[HOTFIX] ${args}`, true);
        }
        break;
      case '/status':
        await handleStatus();
        break;
      case '/exit':
        console.log(pc.cyan('\n¡Gracias por usar EFESTO CLI! Hasta pronto.'));
        running = false;
        rl.close();
        break;
      default:
        if (command) {
          console.log(pc.red(`Comando no reconocido: "${command}". Escribe /start, /task, /hotfix, /status o /exit.`));
        }
        break;
    }
  }
}

// Ejecutar
mainLoop().catch(err => {
  console.error(pc.red(`\nError fatal en ejecución: ${err.stack}`));
  rl.close();
});
