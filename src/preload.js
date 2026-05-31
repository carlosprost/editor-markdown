const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Parsea texto Markdown de forma asíncrona enviándolo al Main Process y retorna HTML sanitizado y seguro.
   * @async
   * @param {string} texto - Texto plano en formato Markdown.
   * @returns {Promise<string>} HTML parseado y seguro para renderizar.
   */
  parseMarkdown: (texto) => ipcRenderer.invoke("markdown:parse", texto),

  /**
   * Invoca de forma asíncrona la apertura de un archivo Markdown a través del diálogo del sistema.
   * @async
   * @returns {Promise<{ruta: string, nombre: string, contenido: string} | null>} Objeto con ruta, nombre y contenido del archivo, o null si se cancela.
   */
  openFile: () => ipcRenderer.invoke("file:open"),

  /**
   * Lee el contenido de un archivo Markdown de forma asíncrona dada su ruta.
   * @async
   * @param {string} ruta - Ruta física completa del archivo.
   * @returns {Promise<string|null>} Contenido del archivo o null en caso de error.
   */
  readFile: (ruta) => ipcRenderer.invoke("file:read", ruta),


  /**
   * Guarda de forma asíncrona el contenido markdown en la ruta especificada.
   * @async
   * @param {string} ruta - Ruta física del archivo en el filesystem.
   * @param {string} contenido - Contenido de texto en markdown a guardar.
   * @returns {Promise<boolean>} Devuelve true si la escritura fue exitosa, de lo contrario false.
   */
  saveFile: (ruta, contenido) => ipcRenderer.invoke("file:save", ruta, contenido),

  /**
   * Invoca el diálogo nativo "Guardar como" para registrar un nuevo archivo Markdown con su contenido.
   * @async
   * @param {string} contenido - Texto markdown que se guardará en el nuevo archivo.
   * @returns {Promise<{ruta: string, nombre: string} | null>} Objeto con la nueva ruta y nombre, o null si se cancela.
   */
  saveAsFile: (contenido) => ipcRenderer.invoke("file:save-as", contenido),

  /**
   * Invoca el diálogo nativo para avisar sobre cambios pendientes sin guardar.
   * @async
   * @returns {Promise<number>} Código de botón: 0 (Guardar cambios), 1 (No guardar), 2 (Cancelar).
   */
  showUnsavedDialog: () => ipcRenderer.invoke("dialog:unsaved"),

  /**
   * Muestra una caja de error nativa del sistema operativo.
   * @async
   * @param {string} titulo - Título de la ventana de error.
   * @param {string} mensaje - Mensaje explicativo del error.
   * @returns {Promise<void>}
   */
  showErrorBox: (titulo, mensaje) => ipcRenderer.invoke("dialog:error", titulo, mensaje),

  /**
   * Exporta de forma asíncrona el HTML parseado a un archivo.
   * @async
   * @param {string} htmlContent - Marcado HTML parseado y estilizado.
   * @returns {Promise<boolean>} Retorna true si fue exitoso, false si fue cancelado o falló.
   */
  exportAsHTML: (htmlContent) => ipcRenderer.invoke("file:export-html", htmlContent),

  /**
   * Solicita al proceso principal cerrar la ventana de la aplicación de forma forzada e inmediata.
   * @returns {void}
   */
  forceCloseWindow: () => ipcRenderer.send("window:force-close"),

  /**
   * Registra un callback que se disparará cuando el proceso principal intente cerrar la ventana.
   * Permite al frontend validar los cambios sin guardar de forma reactiva.
   * @param {Function} callback - Función callback asíncrona a ejecutar ante intento de cierre.
   * @returns {void}
   */
  onAttemptClose: (callback) => ipcRenderer.on("window:attempt-close", callback),

  /**
   * Solicita al proceso principal cerrar la ventana de la aplicación de forma estándar.
   * @returns {void}
   */
  closeWindow: () => ipcRenderer.send("window:close"),

  /**
   * Solicita al proceso principal minimizar la ventana de la aplicación.
   * @returns {void}
   */
  minimizeWindow: () => ipcRenderer.send("window:minimize"),

  /**
   * Solicita al proceso principal maximizar la ventana de la aplicación.
   * @returns {void}
   */
  maximizeWindow: () => ipcRenderer.send("window:maximize"),

  /**
   * Solicita al proceso principal restaurar (desmaximizar) la ventana.
   * @returns {void}
   */
  unmaximizeWindow: () => ipcRenderer.send("window:unmaximize"),

  /**
   * Consulta al proceso principal si la ventana se encuentra maximizada actualmente.
   * @async
   * @returns {Promise<boolean>} Promesa con valor booleano indicando el estado de maximización.
   */
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),

  /**
   * Registra un callback que se disparará cuando el estado de maximizado de la ventana cambie de forma nativa por el sistema.
   * Permite al frontend actualizar la visibilidad de los botones de maximizar/restaurar de forma reactiva en tiempo real.
   * @param {Function} callback - Función callback a ejecutar.
   * @returns {void}
   */
  onMaximizedChange: (callback) => ipcRenderer.on("window:maximized-state", callback)
});

