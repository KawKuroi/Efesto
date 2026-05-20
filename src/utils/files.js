import fs from 'fs';
import path from 'path';

const DOCS_DIR = './docs';

/**
 * Asegura que la carpeta /docs exista.
 */
export function ensureDocsDir() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

/**
 * Verifica si un archivo de documentación existe en /docs.
 * @param {string} filename Nombre del archivo (ej. PRD.md)
 * @returns {boolean}
 */
export function docExists(filename) {
  return fs.existsSync(path.join(DOCS_DIR, filename));
}

/**
 * Lee un archivo de documentación en /docs.
 * @param {string} filename Nombre del archivo
 * @returns {string} Contenido
 */
export function readDoc(filename) {
  const filePath = path.join(DOCS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Escribe o actualiza un archivo de documentación en /docs.
 * @param {string} filename Nombre del archivo
 * @param {string} content Contenido
 */
export function writeDoc(filename, content) {
  ensureDocsDir();
  fs.writeFileSync(path.join(DOCS_DIR, filename), content, 'utf-8');
}

/**
 * Lee un archivo del código fuente del proyecto.
 * @param {string} relativePath Ruta relativa del archivo respecto a la raíz
 * @returns {string} Contenido
 */
export function readProjectFile(relativePath) {
  if (!fs.existsSync(relativePath)) {
    return '';
  }
  return fs.readFileSync(relativePath, 'utf-8');
}

/**
 * Escribe un archivo del código fuente del proyecto (crea directorios si no existen).
 * @param {string} relativePath Ruta relativa del archivo respecto a la raíz
 * @param {string} content Contenido
 */
export function writeProjectFile(relativePath, content) {
  const dir = path.dirname(relativePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(relativePath, content, 'utf-8');
}

/**
 * Escanea la estructura de archivos del proyecto recursivamente para proveer el árbol.
 * @param {string} dir Directorio a escanear
 * @param {Array<string>} [ignoreList] Directorios a ignorar
 * @returns {Array<string>} Listado de rutas relativas de archivos
 */
export function getDirectoryFiles(dir = '.', ignoreList = ['node_modules', '.git', '.gemini', 'docs', 'dist', '.next', 'package-lock.json']) {
  const filesList = [];
  
  function recurse(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const relativePath = path.relative('.', fullPath);
      
      // Validar exclusiones
      if (ignoreList.some(ignore => relativePath === ignore || item === ignore || relativePath.startsWith(ignore + path.sep))) {
        continue;
      }
      
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        recurse(fullPath);
      } else {
        filesList.push(relativePath.replace(/\\/g, '/'));
      }
    }
  }
  
  recurse(dir);
  return filesList;
}
