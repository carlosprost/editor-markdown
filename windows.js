const { BrowserWindow } = require("electron");
const path = require("path");

/**
 * Referencia a la ventana principal de la aplicación.
 * @type {BrowserWindow|null}
 */
let win = null;

/**
 * Flag de control para forzar el cierre efectivo de la ventana.
 * @type {boolean}
 */
let forceClose = false;

/**
 * Inicializa y crea la ventana principal de Electron con configuraciones de seguridad estrictas.
 * Habilita el aislamiento de contexto y deshabilita la integración directa de Node.js en el frontend.
 * @returns {void}
 */
function createWindow() {
  win = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: 800,
    height: 600,
    frame: false,
    icon: path.join(__dirname, "src/assets/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "src/preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "src/view/index.html"));
  // win.webContents.openDevTools(); // Descomentá esta línea si necesitás abrir las DevTools automáticamente al iniciar

  // Notifica al frontend cuando cambia el estado de maximizado de forma nativa por el sistema (ej. doble clic en header)
  win.on("maximize", () => {
    win.webContents.send("window:maximized-state", true);
  });

  win.on("unmaximize", () => {
    win.webContents.send("window:maximized-state", false);
  });

  // Intercepta el intento de cierre para validar cambios pendientes asíncronamente en el Frontend
  win.on("close", (e) => {
    if (!forceClose) {
      e.preventDefault();
      win.webContents.send("window:attempt-close");
    }
  });
}

/**
 * Cierra la ventana principal de la aplicación de forma segura.
 * @returns {void}
 */
function closeWindow() {
  if (win) win.close();
}

/**
 * Minimiza la ventana principal de la aplicación.
 * @returns {void}
 */
function minizarWindow() {
  if (win) win.minimize();
}

/**
 * Maximiza la ventana principal de la aplicación.
 * @returns {void}
 */
function maximizarWindow() {
  if (win) win.maximize();
}

/**
 * Restaura la ventana principal a su tamaño original si estaba maximizada.
 * @returns {void}
 */
function unmaximizarWindow() {
  if (win) win.unmaximize();
}

/**
 * Chequea si la ventana principal se encuentra maximizada actualmente.
 * @returns {boolean} Verdadero si está maximizada, falso de lo contrario.
 */
function isMaximized() {
  return win ? win.isMaximized() : false;
}

/**
 * Habilita el flag forceClose para permitir el cierre efectivo de la ventana.
 * @returns {void}
 */
function enableForceClose() {
  forceClose = true;
}

module.exports = {
  createWindow,
  closeWindow,
  minizarWindow,
  maximizarWindow,
  unmaximizarWindow,
  isMaximized,
  enableForceClose,
};

