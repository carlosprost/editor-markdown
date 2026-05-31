const { app, ipcMain, dialog } = require("electron");
const {
  createWindow,
  closeWindow,
  minizarWindow,
  maximizarWindow,
  unmaximizarWindow,
  isMaximized,
} = require("./windows");
const path = require("path");
const fs = require("fs");
const marked = require("marked");

/**
 * @fileoverview Proceso principal (Main Process) de la aplicación Electron.
 * Gestiona el ciclo de vida de la aplicación, ventanas y las operaciones
 * seguras del sistema de archivos (fs) mediante IPC asíncrono.
 */

// Configuración de la recarga en caliente solo para desarrollo local (no empaquetado)
if (!app.isPackaged) {
  const electronPath = path.join(
    __dirname,
    "node_modules",
    ".bin",
    "electron" + (process.platform === "win32" ? ".cmd" : "")
  );
  require("electron-reload")(__dirname, {
    electron: electronPath,
    hardResetMethod: "exit",
  });
}

// Inicialización de la aplicación
app.whenReady().then(createWindow);

// Control del cierre de la aplicación según la plataforma
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
  app.quit();
});

/* ==========================================================================
   Gestión de Archivos (Operaciones Asíncronas y Seguras)
   ========================================================================== */

/**
 * Handler IPC para abrir archivos de manera segura.
 * Muestra el diálogo del sistema operativo y lee el archivo seleccionado.
 * @async
 */
ipcMain.handle("file:open", async () => {
  const resultado = await dialog.showOpenDialog({
    defaultPath: path.join(__dirname, "src/assets/files/"),
    properties: ["openFile"],
    filters: [
      {
        name: "Markdown Files",
        extensions: ["md"],
      },
    ],
  });

  if (resultado.canceled || resultado.filePaths.length === 0) {
    return null;
  }

  const rutaCompleta = resultado.filePaths[0];
  try {
    const contenido = fs.readFileSync(rutaCompleta, "utf-8");
    const nombreArchivo = path.basename(rutaCompleta);
    return {
      ruta: rutaCompleta,
      nombre: nombreArchivo,
      contenido: contenido,
    };
  } catch (error) {
    console.error("Error al leer el archivo:", error);
    dialog.showErrorBox(
      "Error al abrir archivo",
      "No se pudo cargar el archivo Markdown seleccionado. Comprobá que exista y tengas permisos para leerlo, che."
    );
    return null;
  }
});

/**
 * Handler IPC para leer de forma segura el contenido de un archivo Markdown existente dada su ruta.
 * @async
 * @param {Electron.IpcMainInvokeEvent} event - Evento del canal IPC.
 * @param {string} ruta - Ruta física completa del archivo.
 * @returns {Promise<string|null>} Contenido del archivo o null en caso de error.
 */
ipcMain.handle("file:read", async (event, ruta) => {
  if (!ruta) return null;
  try {
    return fs.readFileSync(ruta, "utf-8");
  } catch (error) {
    console.error("Error al leer el archivo en la ruta especificada:", error);
    dialog.showErrorBox(
      "Error al restaurar sesión",
      "No se pudo volver a cargar tu archivo de sesión. Puede ser que haya sido movido o eliminado, che."
    );
    return null;
  }
});

/**
 * Handler IPC para guardar de forma directa el contenido en un archivo existente.
 * @async
 * @param {Electron.IpcMainInvokeEvent} event - Evento del canal IPC.
 * @param {string} ruta - Ruta física completa del archivo a guardar.
 * @param {string} contenido - Texto Markdown a escribir.
 * @returns {Promise<boolean>} Retorna verdadero si se guardó con éxito.
 */
ipcMain.handle("file:save", async (event, ruta, contenido) => {
  if (!ruta) return false;
  try {
    fs.writeFileSync(ruta, contenido, "utf-8");
    return true;
  } catch (error) {
    console.error("Error al guardar el archivo:", error);
    dialog.showErrorBox(
      "Error al guardar archivo",
      "No se pudieron registrar las modificaciones. Verificá los permisos de escritura del directorio, che."
    );
    return false;
  }
});

/**
 * Handler IPC para la acción "Guardar como".
 * Despliega el diálogo nativo y escribe el contenido en el nuevo archivo.
 * @async
 * @param {Electron.IpcMainInvokeEvent} event - Evento del canal IPC.
 * @param {string} contenido - Texto Markdown a registrar.
 * @returns {Promise<{ruta: string, nombre: string} | null>} Retorna los datos del nuevo archivo o null si se cancela.
 */
ipcMain.handle("file:save-as", async (event, contenido) => {
  const resultado = await dialog.showSaveDialog({
    defaultPath: path.join(__dirname, "src/assets/files/NuevoArchivo.md"),
    filters: [
      {
        name: "Markdown Files",
        extensions: ["md"],
      },
    ],
  });

  if (resultado.canceled || !resultado.filePath) {
    return null;
  }

  const rutaCompleta = resultado.filePath;
  try {
    fs.writeFileSync(rutaCompleta, contenido, "utf-8");
    const nombreArchivo = path.basename(rutaCompleta);
    return {
      ruta: rutaCompleta,
      nombre: nombreArchivo,
    };
  } catch (error) {
    console.error("Error al ejecutar 'Guardar como':", error);
    dialog.showErrorBox(
      "Error de guardado",
      "No se pudo registrar el nuevo archivo Markdown. Comprobá los permisos en el explorador, che."
    );
    return null;
  }
});

/**
 * Sanitiza de forma estricta el HTML resultante del parser para prevenir
 * ataques de Cross-Site Scripting (XSS / OWASP A03).
 * Remueve etiquetas <script> y handlers de eventos inline como onload, onerror, etc.
 * @param {string} html - HTML generado por el parser.
 * @returns {string} HTML sanitizado y seguro para ser inyectado en el DOM.
 */
function sanitizarHTML(html) {
  if (!html) return "";
  return html
    // Elimina etiquetas <script> y su contenido
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Elimina atributos de eventos inline (ej. onclick, onerror, onload)
    .replace(/\son\w+\s*=\s*(['"])(.*?)\1/gi, "")
    // Elimina pseudoprotocolos javascript: en href o src
    .replace(/href\s*=\s*(['"])javascript:(.*?)\1/gi, 'href="#"')
    .replace(/src\s*=\s*(['"])javascript:(.*?)\1/gi, 'src=""');
}

/**
 * Diccionario de Emojis Shortcodes para Slack/GitHub Style en español.
 * Mapea los códigos más utilizados a sus respectivos emojis Unicode.
 * @constant {Object<string, string>}
 */
const MAPA_EMOJIS = {
  ":rocket:": "🚀",
  ":fire:": "🔥",
  ":heart:": "❤️",
  ":star:": "⭐",
  ":check:": "✅",
  ":warn:": "⚠️",
  ":smile:": "😊",
  ":bulb:": "💡",
  ":computer:": "💻",
  ":tada:": "🎉",
  ":ok_hand:": "👌",
  ":eyes:": "👀",
  ":thumbsup:": "👍",
  ":thumbsdown:": "👎",
  ":clap:": "👏",
  ":lock:": "🔒",
  ":key:": "🔑",
  ":memo:": "📝",
  ":books:": "📚",
  ":bug:": "🐛",
  ":hammer:": "🔨",
  ":wrench:": "🔧",
  ":gear:": "⚙️",
  ":construction:": "🚧",
  ":sparkles:": "✨"
};

/**
 * Procesa características de Markdown extendido (Texto Resaltado == Obsidian style y Emojis Shortcodes).
 * Segmenta el HTML para evitar reemplazar caracteres dentro de bloques de código (<pre>, <code>).
 * @param {string} html - HTML sanitizado.
 * @returns {string} HTML con texto resaltado y emojis interpretados.
 */
function procesarMarkdownExtendido(html) {
  if (!html) return "";

  // Segmentamos el HTML por etiquetas completas usando un grupo de captura
  const partes = html.split(/(<\/?[a-zA-Z0-9]+[^>]*>)/g);
  let dentroDeCodigo = 0;

  return partes.map(parte => {
    // Detectamos si entramos o salimos de un bloque de código
    if (parte.startsWith("<code") || parte.startsWith("<pre")) {
      dentroDeCodigo++;
      return parte;
    }
    if (parte.startsWith("</code") || parte.startsWith("</pre")) {
      dentroDeCodigo = Math.max(0, dentroDeCodigo - 1);
      return parte;
    }

    // Solo procesamos el texto que está fuera de etiquetas y fuera de bloques de código
    if (dentroDeCodigo === 0 && !parte.startsWith("<")) {
      // 1. Reemplazo de marcas de resaltado ==texto== -> <mark>texto</mark>
      let procesado = parte.replace(/==([^=]+)==/g, "<mark>$1</mark>");
      
      // 2. Reemplazo de Emojis Shortcodes :shortcode: -> emoji Unicode
      procesado = procesado.replace(/:[a-z0-9_+-]+:/gi, (match) => {
        return MAPA_EMOJIS[match.toLowerCase()] || match;
      });
      
      return procesado;
    }

    return parte;
  }).join("");
}

/**
 * Parsea y transforma blockquotes en alertas estilizadas premium de estilo GitHub
 * (Note, Warning, Tip, Important, Caution), siendo tolerante a fallos de tipado comunes.
 * @param {string} html - HTML generado por el parseador.
 * @returns {string} HTML procesado con cajas de alerta estructuradas.
 */
function procesarAlertasGitHub(html) {
  if (!html) return "";

  // Busca todos los elementos <blockquote> para identificar patrones de alerta
  return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (match, contenido) => {
    // Expresión regular que detecta tanto la sintaxis oficial [!NOTE] como la tolerante ![NOTE]
    const regexAlerta = /^\s*<p>\s*!?\s*\[\s*!?\s*(NOTE|WARNING|WARN|TIP|IMPORTANT|CAUTION)\s*\]\s*(?::|<br>)?\s*([\s\S]*?)<\/p>/i;
    const matchAlerta = contenido.match(regexAlerta);

    if (matchAlerta) {
      const tipo = matchAlerta[1].toUpperCase();
      const restoTexto = matchAlerta[2];

      let claseAlerta = "editor-alert--note";
      let tituloAlerta = "NOTA";
      let iconoAlerta = "bi-info-circle-fill";

      if (tipo === "WARNING" || tipo === "WARN") {
        claseAlerta = "editor-alert--warning";
        tituloAlerta = "ADVERTENCIA";
        iconoAlerta = "bi-exclamation-triangle-fill";
      } else if (tipo === "TIP") {
        claseAlerta = "editor-alert--tip";
        tituloAlerta = "CONSEJO";
        iconoAlerta = "bi-lightbulb-fill";
      } else if (tipo === "IMPORTANT") {
        claseAlerta = "editor-alert--important";
        tituloAlerta = "IMPORTANTE";
        iconoAlerta = "bi-exclamation-circle-fill";
      } else if (tipo === "CAUTION") {
        claseAlerta = "editor-alert--caution";
        tituloAlerta = "PRECAUCIÓN";
        iconoAlerta = "bi-shield-fill-x";
      }

      const parrafosRestantes = contenido.replace(regexAlerta, "");

      return `
<div class="editor-alert ${claseAlerta}">
  <div class="editor-alert__header">
    <i class="bi ${iconoAlerta} editor-alert__icon"></i>
    <span class="editor-alert__title">${tituloAlerta}</span>
  </div>
  <div class="editor-alert__content">
    <p>${restoTexto}</p>
    ${parrafosRestantes}
  </div>
</div>
      `.trim();
    }

    return match;
  });
}

/**
 * Handler IPC asíncrono para parsear de forma segura Markdown a HTML.
 * El parseo se realiza en el Main Process, delegando la carga de la librería,
 * aplicando sanitización estricta y procesando alertas dinámicas de estilo GitHub.
 */
ipcMain.handle("markdown:parse", async (event, texto) => {
  if (!texto) return "";
  try {
    const htmlSucio = marked.parse(texto);
    const htmlSanitizado = sanitizarHTML(htmlSucio);
    const htmlConAlertas = procesarAlertasGitHub(htmlSanitizado);
    return procesarMarkdownExtendido(htmlConAlertas);
  } catch (error) {
    console.error("Error al parsear Markdown en el Main Process:", error);
    return "";
  }
});

/* ==========================================================================
   Gestión de Diálogos y Exportaciones Comerciales
   ========================================================================== */

/**
 * Handler IPC para mostrar el diálogo nativo ante cambios sin guardar al intentar cerrar.
 * @async
 * @returns {Promise<number>} Índice del botón presionado: 0 (Guardar cambios), 1 (No guardar), 2 (Cancelar).
 */
ipcMain.handle("dialog:unsaved", async () => {
  const resultado = await dialog.showMessageBox({
    type: "warning",
    buttons: ["Guardar cambios", "No guardar", "Cancelar"],
    defaultId: 0,
    cancelId: 2,
    title: "Cambios sin guardar",
    message: "¿Querés guardar los cambios que le hiciste a tu archivo antes de salir?",
    detail: "Si no los guardás, tus modificaciones se van a perder para siempre, che.",
  });
  return resultado.response;
});

/**
 * Handler IPC para mostrar cajas de error nativas del sistema operativo en el Frontend.
 * @async
 * @param {Electron.IpcMainInvokeEvent} event - Evento del canal IPC.
 * @param {string} titulo - Título de la ventana de error.
 * @param {string} mensaje - Mensaje detallado del error.
 */
ipcMain.handle("dialog:error", async (event, titulo, mensaje) => {
  dialog.showErrorBox(titulo, mensaje);
});

/**
 * Handler IPC para exportar el HTML parseado a un archivo físico de forma segura.
 * @async
 * @param {Electron.IpcMainInvokeEvent} event - Evento del canal IPC.
 * @param {string} htmlContent - Contenido HTML a escribir.
 * @returns {Promise<boolean>} Retorna true si se exportó con éxito, false si se canceló o falló.
 */
ipcMain.handle("file:export-html", async (event, htmlContent) => {
  const resultado = await dialog.showSaveDialog({
    defaultPath: path.join(__dirname, "src/assets/files/exportado.html"),
    filters: [
      {
        name: "HTML Files",
        extensions: ["html"],
      },
    ],
  });

  if (resultado.canceled || !resultado.filePath) {
    return false;
  }

  // Envolvemos el marcado con una plantilla HTML5 completa que incluye las fuentes y el tema oscuro premium de la app
  const htmlCompleto = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exportación de Markdown - Editor Premium</title>
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --accent-color: #3b82f6;
      --border-color: #334155;
      --font-main: 'Inter', system-ui, -apple-system, sans-serif;
      --mono-font: 'Fira Code', 'Consolas', monospace;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-main);
      line-height: 1.7;
      padding: 40px 24px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 {
      color: var(--text-primary);
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.2;
    }
    h1 { font-size: 2.3em; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
    h2 { font-size: 1.8em; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
    h3 { font-size: 1.40em; }
    p {
      margin-bottom: 1em;
      color: var(--text-secondary);
    }
    a {
      color: var(--accent-color);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    code {
      background-color: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--mono-font);
      font-size: 0.9em;
      color: #fbbf24;
    }
    pre {
      background-color: var(--bg-secondary);
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 1em;
      border: 1px solid var(--border-color);
    }
    pre code {
      background-color: transparent;
      color: var(--text-primary);
      padding: 0;
    }
    blockquote {
      border-left: 4px solid var(--accent-color);
      margin: 1em 0;
      padding-left: 15px;
      color: var(--text-secondary);
      background-color: rgba(59, 130, 246, 0.1);
      padding: 10px 15px;
      border-radius: 0 4px 4px 0;
    }
    img {
      max-width: 100%;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: var(--bg-secondary);
      font-weight: 600;
    }
    hr {
      border: 0;
      height: 1px;
      background: var(--border-color);
      margin: 2em 0;
    }
    /* Estilos para Alertas Premium (GitHub Alerts) */
    .editor-alert {
      margin: 1.5em 0;
      padding: 15px;
      border-left: 4px solid var(--accent-color);
      border-radius: 0 8px 8px 0;
      background-color: rgba(59, 130, 246, 0.05);
    }
    .editor-alert__header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 0.9rem;
    }
    .editor-alert__icon {
      font-size: 1.1rem;
    }
    .editor-alert__title {
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .editor-alert__content {
      font-size: 0.95rem;
      color: var(--text-secondary);
    }
    .editor-alert__content p:last-child {
      margin-bottom: 0;
    }
    .editor-alert--note {
      border-left-color: #3b82f6;
      background-color: rgba(59, 130, 246, 0.08);
    }
    .editor-alert--note .editor-alert__header {
      color: #3b82f6;
    }
    .editor-alert--warning {
      border-left-color: #fbbf24;
      background-color: rgba(251, 191, 36, 0.08);
    }
    .editor-alert--warning .editor-alert__header {
      color: #fbbf24;
    }
    .editor-alert--tip {
      border-left-color: #22c55e;
      background-color: rgba(34, 197, 94, 0.08);
    }
    .editor-alert--tip .editor-alert__header {
      color: #22c55e;
    }
    .editor-alert--important {
      border-left-color: #a855f7;
      background-color: rgba(168, 85, 247, 0.08);
    }
    .editor-alert--important .editor-alert__header {
      color: #a855f7;
    }
    .editor-alert--caution {
      border-left-color: #ef4444;
      background-color: rgba(239, 68, 68, 0.08);
    }
    .editor-alert--caution .editor-alert__header {
      color: #ef4444;
    }
    
    /* Estilos Premium Extendidos (Resaltado, Acordeones y Copiar Código) */
    mark {
      background-color: rgba(245, 158, 11, 0.3); /* Ámbar fluorescente sutil */
      color: #fef08a; /* Amarillo clarito en modo oscuro */
      padding: 2px 4px;
      border-radius: 4px;
      font-weight: 500;
    }
    
    details {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 1em;
      padding: 12px 16px;
      transition: all 0.3s ease;
    }
    details[open] {
      background-color: rgba(30, 41, 59, 0.5);
    }
    summary {
      font-weight: 600;
      cursor: pointer;
      outline: none;
      user-select: none;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary::before {
      content: "\F285"; /* bi-chevron-right */
      font-family: "bootstrap-icons";
      font-size: 0.8rem;
      transition: transform 0.2s ease;
      display: inline-block;
      color: var(--accent-color);
    }
    details[open] summary::before {
      transform: rotate(90deg);
    }
    details > *:not(summary) {
      margin-top: 12px;
      color: var(--text-secondary);
    }
    
    pre {
      position: relative;
    }
    .code-copy-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      border-radius: 6px;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: all 0.2s ease;
      font-size: 0.9rem;
    }
    pre:hover .code-copy-btn {
      opacity: 1;
    }
    .code-copy-btn:hover {
      background-color: var(--border-color);
      color: var(--text-primary);
    }
    .code-copy-btn--success {
      color: var(--success) !important;
      border-color: var(--success) !important;
    }
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
</head>
<body>
  ${htmlContent}
</body>
</html>`;

  try {
    fs.writeFileSync(resultado.filePath, htmlCompleto, "utf-8");
    return true;
  } catch (error) {
    console.error("Error al exportar a HTML:", error);
    dialog.showErrorBox(
      "Error de Exportación",
      "No se pudo guardar el archivo HTML en la ruta seleccionada. Revisá los permisos de escritura, che."
    );
    return false;
  }
});

/* ==========================================================================
   Gestión de Ventana (IPC Unidireccional y Consultas)
   ========================================================================== */

// Listener para cerrar la ventana (pasa por la intercepción de windows.js)
ipcMain.on("window:close", () => {
  closeWindow();
});

// Listener para forzar el cierre efectivo (después de confirmación)
ipcMain.on("window:force-close", () => {
  const windowsModule = require("./windows");
  windowsModule.enableForceClose();
  windowsModule.closeWindow();
});

// Listener para minimizar la ventana
ipcMain.on("window:minimize", () => {
  minizarWindow();
});

// Listener para maximizar la ventana
ipcMain.on("window:maximize", () => {
  maximizarWindow();
});

// Listener para desmaximizar la ventana
ipcMain.on("window:unmaximize", () => {
  unmaximizarWindow();
});

// Handler para consultar si la ventana está maximizada
ipcMain.handle("window:is-maximized", () => {
  return isMaximized();
});

