# EFESTO CLI (Ecosistema de Forjado y Ejecución de Soluciones Técnicas Organizadas)

EFESTO es un CLI de agentes autónomos y stateless para el desarrollo local de software. Utiliza la carpeta `/docs` en la raíz de tu proyecto como memoria compartida (patrón Blackboard), eliminando la necesidad de persistir estados o historiales de conversación complejos en bases de datos.

---

## Arquitectura de Agentes (Stateless)

El sistema se compone de 8 agentes especializados que se comunican e interactúan de forma asíncrona a través de archivos Markdown en `/docs`:

1. **Orquestador (`orquestador.js`):** Decide qué agente ejecutar a continuación analizando `/docs` y tu petición actual.
2. **Inicializador (`inicializador.js`):** Asistente interactivo que genera los 5 archivos base en `/docs` (`PRD.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CURRENT.md`, `GLOBAL.md`).
3. **Lector (`lector.js`):** Carga el contexto técnico de hasta 5 archivos críticos del código fuente para minimizar el uso de tokens.
4. **Planificador (`planificador.js`):** Diseña una estrategia técnica atómica en `./docs/ACTIVE_TASK.md` utilizando checkboxes de markdown.
5. **Implementador (`implementador.js`):** Modifica directamente los archivos físicos del código de tu proyecto local aplicando las soluciones del plan.
6. **Tester (`tester.js`):** Audita la seguridad del código, previene la fuga de credenciales y ejecuta comandos reales de testing en tu terminal.
7. **Completador (`completador.js`):** Registra el historial de tareas resueltas y actualiza el roadmap. Si detecta la compleción de todos los hitos de una fase, automatiza la transición a la siguiente fase del roadmap.
8. **Publicador (`publicador.js`):** Extrae el diff del staging, genera mensajes bajo Conventional Commits 1.0.0 y sube los cambios (`git commit` y `git push`) previo visto bueno interactivo.

---

## Instalación e Integración Global

Puedes instalar y usar EFESTO de forma global en cualquier terminal y carpeta de tu sistema operativo:

### 1. Enlace Global
Ejecuta en la raíz de este directorio:
```bash
npm install
npm link
```
Esto habilitará el comando global **`efesto`** en tu consola de comandos.

### 2. Configuración de API Keys
En el primer inicio, el CLI creará automáticamente la carpeta `~/.efesto` en tu directorio de usuario. Abre el archivo `.env` generado e introduce tus claves:
```env
# Configuración global de API Keys
GEMINI_API_KEY=tu_api_key_de_gemini
ANTHROPIC_API_KEY=tu_api_key_de_claude
```
*Nota: Si ya contabas con credenciales configuradas en la carpeta `~/.sama/.env`, EFESTO las detectará y cargará de forma automática.*

---

## Guía de Comandos del CLI

Escribe `efesto` en la terminal de cualquier proyecto local para acceder al panel interactivo (`efesto > `):

* **`/start`** o **`/init`**: Inicia el asistente interactivo para estructurar y crear la carpeta `/docs`.
* **`/task [descripción]`**: Inicia el ciclo autónomo (Lector -> Planner -> Implementer -> Tester -> Completador -> Publicador). Incluye una parada de seguridad donde puedes editar y aprobar el plan en `./docs/ACTIVE_TASK.md` antes de modificar el código.
* **`/hotfix [descripción]`**: Mecanismo de interrupción prioritaria. Resguarda tu avance actual (`ACTIVE_TASK_PAUSED.md`), inicia un ciclo limpio de resolución y te permite reanudar tu feature original tras subir la corrección.
* **`/status`**: Muestra la disponibilidad de los archivos base de documentación.
* **`/exit`**: Cierra el CLI.
