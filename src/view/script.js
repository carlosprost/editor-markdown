/**
 * @fileoverview Lógica de interfaz (Renderer Process) del Editor Markdown.
 * Administra la interacción del usuario con la UI, actualiza el editor en tiempo real
 * y consume la API segura de Electron (window.electronAPI) de forma 100% asíncrona.
 */

const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const titulo = document.querySelector("#titulo");

// Inicializamos la aplicación y registramos los eventos premium de UX
iniciarPrograma();
registrarEventosPremium();


/**
 * Arranca la aplicación chequeando si tenías un archivo abierto en tu sesión anterior.
 * Si encontrás uno, lo carga asíncronamente; si no, te muestra la pantalla de inicio limpia.
 * @async
 * @returns {Promise<void>}
 */
async function iniciarPrograma() {
  const ruta = obtenerRuta();

  if (!ruta) {
    pantallaDeInicio();
    deshabilitarEditor();
  } else {
    habilitarEditor();
    await cargarArchivoAbierto(ruta);
  }
}

// Escucha los cambios de texto en el editor en tiempo real
editor.addEventListener("keyup", async (e) => {
  if (!comprobarCambios()) {
    titulo.innerHTML += "*";
  }
  await convertMarkdown(e.target.value);
});

/**
 * Compara el título actual para ver si tiene cambios pendientes sin guardar (indicados con un asterisco).
 * @returns {boolean} Verdadero si tenés cambios sin guardar.
 */
function comprobarCambios() {
  return titulo.innerHTML.includes("*");
}

/**
 * Convierte el texto Markdown en HTML sanitizado usando el preload seguro y actualiza la vista previa de forma asíncrona.
 * Tras actualizar la vista previa, instrumenta las características premium interactivas del frontend.
 * @async
 * @param {string} text - Texto Markdown escrito por el usuario.
 * @returns {Promise<void>}
 */
async function convertMarkdown(text) {
  preview.innerHTML = await window.electronAPI.parseMarkdown(text);
  
  // Instrumentación de características interactivas premium
  agregarBotonesCopiar();
  hacerCheckboxesInteractivos();
}

/**
 * Busca todos los bloques <pre> de código y les inyecta un botón flotante interactivo de copiar.
 * Registra de forma asíncrona la acción de copiado al portapapeles con feedback de éxito premium.
 * @returns {void}
 */
function agregarBotonesCopiar() {
  const bloquesPre = preview.querySelectorAll("pre");
  bloquesPre.forEach((pre) => {
    // Si ya tiene el botón de copiar inyectado, no duplicamos
    if (pre.querySelector(".code-copy-btn")) return;

    // Buscamos el bloque code interno para extraer el texto exacto
    const codigoElemento = pre.querySelector("code");
    if (!codigoElemento) return;

    // Crear el botón de copia flotante Notion/GitHub Style
    const boton = document.createElement("button");
    boton.className = "code-copy-btn";
    boton.setAttribute("title", "Copiar código");
    boton.innerHTML = '<i class="bi bi-copy"></i>';

    // Registramos la acción de copiado al portapapeles de forma segura
    boton.addEventListener("click", async (e) => {
      e.stopPropagation();
      const textoACopiar = codigoElemento.innerText;
      try {
        await navigator.clipboard.writeText(textoACopiar);
        
        // Feedback visual exitoso
        boton.innerHTML = '<i class="bi bi-check-lg"></i>';
        boton.classList.add("code-copy-btn--success");
        boton.setAttribute("title", "¡Copiado, che!");
        
        // Restauramos el icono original a los 2 segundos
        setTimeout(() => {
          boton.innerHTML = '<i class="bi bi-copy"></i>';
          boton.classList.remove("code-copy-btn--success");
          boton.setAttribute("title", "Copiar código");
        }, 2000);
      } catch (err) {
        console.error("Error al copiar al portapapeles:", err);
      }
    });

    pre.appendChild(boton);
  });
}

/**
 * Habilita e instrumenta interactividad bidireccional en checklists (listas de tareas) en tiempo real.
 * Mapea los checkboxes del preview al editor físico y sincroniza su estado de forma reactiva en el markdown crudo.
 * @returns {void}
 */
function hacerCheckboxesInteractivos() {
  const checkboxes = preview.querySelectorAll(".task-list-item-checkbox, input[type='checkbox']");
  
  checkboxes.forEach((checkbox, index) => {
    // Habilitamos la interactividad interactiva en la vista previa
    checkbox.removeAttribute("disabled");
    checkbox.setAttribute("data-index", index);
    
    // Evitamos registrar múltiples listeners sobre el mismo elemento del DOM
    if (checkbox.dataset.listenerRegistered) return;
    checkbox.dataset.listenerRegistered = "true";
    
    checkbox.addEventListener("change", async (e) => {
      const clickeadoIndex = parseInt(e.target.getAttribute("data-index"), 10);
      const estaMarcado = e.target.checked;
      
      const textoEditor = editor.value;
      let coincidenciaActual = 0;
      
      // Dividimos el contenido del editor línea por línea para ubicar la coincidencia exacta
      const lineas = textoEditor.split("\n");
      
      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];
        // Regex tolerante que busca ítem de checklist en markdown: - [ ] o - [x]
        const match = linea.match(/^\s*([-*+])\s*\[([ xX])\](.*)$/);
        
        if (match) {
          if (coincidenciaActual === clickeadoIndex) {
            // Reconstruimos la línea con el nuevo estado del checkbox
            const marcadorNuevo = estaMarcado ? "x" : " ";
            const signoLista = match[1];
            const restoLinea = match[3];
            const espaciosIniciales = linea.substring(0, linea.indexOf(signoLista));
            
            lineas[i] = `${espaciosIniciales}${signoLista} [${marcadorNuevo}]${restoLinea}`;
            coincidenciaActual++;
            break; // Salimos al encontrar y modificar la coincidencia exacta
          }
          coincidenciaActual++;
        }
      }
      
      // Volvemos a unir el texto si se realizaron cambios y actualizamos el editor
      const nuevoContenido = lineas.join("\n");
      if (nuevoContenido !== editor.value) {
        editor.value = nuevoContenido;
        
        // Marcamos cambios sin guardar en el título de la ventana
        if (!comprobarCambios()) {
          titulo.innerHTML += "*";
        }
        
        // Regeneramos el markdown (gatillando re-instrumentación de los elementos)
        await convertMarkdown(nuevoContenido);
      }
    });
  });
}

/* ==========================================================================
   Comandos del Menú de Archivos (E/S Asíncrona)
   ========================================================================== */

const newFile = document.querySelector("#new");
const openFile = document.querySelector("#open");
const saveFile = document.querySelector("#save");
const saveAsFile = document.querySelector("#save-as");
const closeFile = document.querySelector("#close-file");
const exportHTMLBtn = document.querySelector("#export");
const toggleViewBtn = document.querySelector("#toggle-view");

// Evento: Crear nuevo archivo
newFile.addEventListener("click", () => {
  ejecutarNuevoCompleto();
});

// Evento: Cerrar el archivo actual (con confirmación de cambios)
closeFile.addEventListener("click", async () => {
  if (comprobarCambios()) {
    const respuesta = await window.electronAPI.showUnsavedDialog();
    if (respuesta === 0) { // Guardar
      await ejecutarGuardadoCompleto();
      if (!comprobarCambios()) {
        ejecutarCierreCompleto();
      }
    } else if (respuesta === 1) { // No guardar
      ejecutarCierreCompleto();
    }
    // Si es 2 (Cancelar), se queda igual
  } else {
    ejecutarCierreCompleto();
  }
});

// Evento: Abrir un archivo existente
openFile.addEventListener("click", async () => {
  await ejecutarAperturaCompleta();
});

// Evento: Guardar el archivo actual
saveFile.addEventListener("click", async () => {
  await ejecutarGuardadoCompleto();
});

// Evento: Guardar archivo como...
saveAsFile.addEventListener("click", async () => {
  await guardarArchivoComo();

  if (comprobarCambios()) {
    titulo.innerHTML = obtenerFileName();
  }
});

// Evento: Exportar contenido formateado a HTML
exportHTMLBtn.addEventListener("click", async () => {
  if (estaDeshabilitadoEditor()) return;
  const contenidoHTML = preview.innerHTML;
  await window.electronAPI.exportAsHTML(contenidoHTML);
});

// Evento: Alternar Modo Visor (Colapsar/Mostrar editor)
toggleViewBtn.addEventListener("click", () => {
  if (estaDeshabilitadoEditor()) return;
  
  const panelEditor = document.querySelector(".editor-workspace__panel--editor");
  panelEditor.classList.toggle("editor-workspace__panel--collapsed");
  
  const icono = toggleViewBtn.querySelector("i");
  if (panelEditor.classList.contains("editor-workspace__panel--collapsed")) {
    icono.className = "bi bi-pencil"; // Icono de edición
    toggleViewBtn.setAttribute("title", "Modo Edición (Mostrar editor)");
  } else {
    icono.className = "bi bi-eye"; // Icono de vista
    toggleViewBtn.setAttribute("title", "Modo Visor (Colapsar editor)");
  }
});

/**
 * Limpia el área de texto y el preview, dejando el editor en su estado por defecto.
 * @returns {void}
 */
function pantallaDeInicio() {
  editor.value = "";
  preview.innerHTML = "";
  titulo.innerHTML = "Archivo sin nombre";
}

/**
 * Muestra el área de entrada del editor de texto y expande el panel correspondiente.
 * @returns {void}
 */
function habilitarEditor() {
  editor.style.display = "block";
  const panelEditor = document.querySelector(".editor-workspace__panel--editor");
  panelEditor.classList.remove("editor-workspace__panel--collapsed");
  
  const icono = toggleViewBtn.querySelector("i");
  icono.className = "bi bi-eye";
  toggleViewBtn.setAttribute("title", "Modo Visor (Colapsar editor)");
  toggleViewBtn.removeAttribute("disabled");
}

/**
 * Oculta el área de entrada del editor de texto y colapsa el panel.
 * @returns {void}
 */
function deshabilitarEditor() {
  editor.style.display = "none";
  const panelEditor = document.querySelector(".editor-workspace__panel--editor");
  panelEditor.classList.add("editor-workspace__panel--collapsed");
  
  const icono = toggleViewBtn.querySelector("i");
  icono.className = "bi bi-eye";
  toggleViewBtn.setAttribute("title", "Modo Visor (Colapsar editor)");
  toggleViewBtn.setAttribute("disabled", "true");
}

/**
 * Chequea si el editor de texto se encuentra oculto.
 * @returns {boolean} Verdadero si está oculto.
 */
function estaDeshabilitadoEditor() {
  return editor.style.display === "none";
}

/**
 * Despliega el diálogo nativo "Guardar como" y registra el archivo de manera asíncrona.
 * @async
 * @returns {Promise<void>}
 */
async function guardarArchivoComo() {
  const nuevoArchivo = await window.electronAPI.saveAsFile(editor.value);
  if (nuevoArchivo) {
    rutaArchivo(nuevoArchivo.ruta, nuevoArchivo.nombre);
    titulo.innerHTML = nuevoArchivo.nombre;
  }
}

/**
 * Carga el contenido de un archivo desde una ruta física de manera asíncrona y segura.
 * @async
 * @param {string} ruta - Ruta absoluta del archivo Markdown.
 * @returns {Promise<void>}
 */
async function cargarArchivoAbierto(ruta) {
  if (!ruta) return;
  const contenido = await window.electronAPI.readFile(ruta);

  if (contenido !== null) {
    titulo.innerHTML = obtenerFileName();
    editor.value = contenido;
    await convertMarkdown(contenido);
  } else {
    // Si no se pudo leer el archivo (por ejemplo, porque fue eliminado), reseteamos
    resetRuta();
    pantallaDeInicio();
    deshabilitarEditor();
  }
}

/**
 * Escribe el contenido editado de forma directa en el archivo actual.
 * @async
 * @param {string} ruta - Ruta absoluta del archivo actual.
 * @returns {Promise<void>}
 */
async function guardarComo(ruta) {
  if (!ruta) return;
  const exito = await window.electronAPI.saveFile(ruta, editor.value);
  if (exito) {
    titulo.innerHTML = obtenerFileName();
  }
}

/**
 * Almacena en la sesión del navegador la ruta y el nombre del archivo actual.
 * @param {string} ruta - Ruta física completa.
 * @param {string} fileName - Nombre del archivo con su extensión.
 * @returns {void}
 */
function rutaArchivo(ruta, fileName) {
  if (!ruta) return;
  window.localStorage.setItem("ruta", ruta);
  window.localStorage.setItem("fileName", fileName);
}

/**
 * Resetea y limpia las variables de la sesión del navegador para el archivo actual.
 * @returns {void}
 */
function resetRuta() {
  window.localStorage.setItem("ruta", "");
  window.localStorage.setItem("fileName", "");
}

/**
 * Recupera la ruta absoluta del archivo guardada en la sesión del navegador.
 * @returns {string|null} Ruta absoluta del archivo o null si no existe.
 */
function obtenerRuta() {
  return window.localStorage.getItem("ruta");
}

/**
 * Recupera el nombre del archivo de la sesión actual.
 * @returns {string} Nombre del archivo actual o "Archivo sin nombre" por defecto.
 */
function obtenerFileName() {
  return window.localStorage.getItem("fileName") || "Archivo sin nombre";
}

/* ==========================================================================
   Funciones y Control de la Ventana
   ========================================================================== */

const closeBtn = document.querySelector("#close");
const minBtn = document.querySelector("#min");
const maxBtn = document.querySelector("#max");
const unmaxBtn = document.querySelector("#unmax");

// Inicializamos el estado del botón de maximizado de forma asíncrona
btnMaxOUnmax();

// Evento: Cerrar la ventana principal
closeBtn.addEventListener("click", () => {
  window.electronAPI.closeWindow();
});

// Evento: Minimizar la ventana
minBtn.addEventListener("click", () => {
  window.electronAPI.minimizeWindow();
});

// Evento: Maximizar la ventana
maxBtn.addEventListener("click", async () => {
  window.electronAPI.maximizeWindow();
  // Agregamos un leve delay para esperar a que cambie el estado físico de la ventana
  setTimeout(async () => {
    await btnMaxOUnmax();
  }, 100);
});

// Evento: Desmaximizar (restaurar) la ventana
unmaxBtn.addEventListener("click", async () => {
  window.electronAPI.unmaximizeWindow();
  setTimeout(async () => {
    await btnMaxOUnmax();
  }, 100);
});

/**
 * Actualiza la visibilidad de los botones de maximizar/restaurar en la top-bar
 * según el estado real de la ventana de Electron de forma asíncrona.
 * @async
 * @returns {Promise<void>}
 */
async function btnMaxOUnmax() {
  const maximizado = await isMaximized();
  actualizarBotonesMaximizar(maximizado);
}

/**
 * Actualiza la visibilidad de los botones de maximizar/restaurar en el header de forma síncrona y reactiva.
 * @param {boolean} esMaximizado - Verdadero si la ventana está maximizada actualmente.
 * @returns {void}
 */
function actualizarBotonesMaximizar(esMaximizado) {
  if (esMaximizado) {
    maxBtn.style.display = "none";
    unmaxBtn.style.display = "block";
  } else {
    maxBtn.style.display = "block";
    unmaxBtn.style.display = "none";
  }
}

/**
 * Consulta de forma asíncrona al Main Process si la ventana se encuentra maximizada.
 * @async
 * @returns {Promise<boolean>} Verdadero si la ventana está maximizada.
 */
async function isMaximized() {
  return await window.electronAPI.isMaximized();
}

/* ==========================================================================
   Modularización de Eventos y Shortcuts (UX Premium)
   ========================================================================== */

/**
 * Ejecuta el guardado completo del archivo, decidiendo si guarda de forma directa
 * o despliega el diálogo "Guardar como" si no hay una ruta física previa.
 * @async
 * @returns {Promise<void>}
 */
async function ejecutarGuardadoCompleto() {
  const ruta = obtenerRuta();
  if (!ruta) {
    await guardarArchivoComo();
  } else {
    await guardarComo(ruta);
  }

  if (comprobarCambios()) {
    titulo.innerHTML = obtenerFileName();
  }
}

/**
 * Ejecuta la apertura asíncrona de un archivo, habilitando el editor si estaba oculto.
 * @async
 * @returns {Promise<void>}
 */
async function ejecutarAperturaCompleta() {
  if (estaDeshabilitadoEditor()) {
    habilitarEditor();
  }
  
  const archivo = await window.electronAPI.openFile();
  if (archivo) {
    rutaArchivo(archivo.ruta, archivo.nombre);
    titulo.innerHTML = archivo.nombre;
    editor.value = archivo.contenido;
    await convertMarkdown(archivo.contenido);
  }
}

/**
 * Crea un nuevo archivo limpio en la interfaz de usuario.
 * @returns {void}
 */
function ejecutarNuevoCompleto() {
  pantallaDeInicio();
  habilitarEditor();
  resetRuta();
}

/**
 * Limpia y cierra la vista de edición actual.
 * @returns {void}
 */
function ejecutarCierreCompleto() {
  pantallaDeInicio();
  deshabilitarEditor();
  resetRuta();
}

/**
 * Registra eventos comerciales premium: atajos de teclado globales,
 * soporte interactivo para arrastrar y soltar (Drag & Drop) e intercepción asíncrona
 * de cierre de ventana para prevenir pérdida de datos.
 * @returns {void}
 */
function registrarEventosPremium() {
  // 1. Atajos de Teclado Globales
  window.addEventListener("keydown", async (e) => {
    // Solo permitir atajos si el editor está habilitado y visible
    if (estaDeshabilitadoEditor()) return;

    // Ctrl + S (Guardar directo)
    if (e.ctrlKey && e.key.toLowerCase() === "s" && !e.shiftKey) {
      e.preventDefault();
      await ejecutarGuardadoCompleto();
    }
    // Ctrl + Shift + S (Guardar como)
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      await guardarArchivoComo();
    }
    // Ctrl + O (Abrir archivo)
    if (e.ctrlKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      await ejecutarAperturaCompleta();
    }
    // Ctrl + N (Nuevo archivo)
    if (e.ctrlKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      ejecutarNuevoCompleto();
    }
  });

  // 2. Soporte interactivo para Arrastrar y Soltar (Drag & Drop)
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext === "md") {
        if (estaDeshabilitadoEditor()) {
          habilitarEditor();
        }
        await cargarArchivoAbierto(file.path);
      } else {
        await window.electronAPI.showErrorBox(
          "Archivo no soportado",
          "Por favor, arrastrá únicamente archivos con extensión .md, che."
        );
      }
    }
  });

  // 3. Intercepción Inteligente de Cierre de Ventana (Electron Bridge)
  window.electronAPI.onAttemptClose(async () => {
    if (comprobarCambios()) {
      const respuesta = await window.electronAPI.showUnsavedDialog();
      if (respuesta === 0) { // Guardar cambios
        await ejecutarGuardadoCompleto();
        // Si se guardó de forma efectiva (es decir, el título ya no tiene el asterisco de cambios)
        if (!comprobarCambios()) {
          window.electronAPI.forceCloseWindow();
        }
      } else if (respuesta === 1) { // No guardar
        window.electronAPI.forceCloseWindow();
      }
      // Si la respuesta es 2 (Cancelar), simplemente no hace nada y mantiene la ventana abierta
    } else {
      window.electronAPI.forceCloseWindow();
    }
  });

  // 4. Escucha de Cambios Reactivos de Maximización Nativos del Sistema (Doble clic en header o atajos de Windows)
  window.electronAPI.onMaximizedChange((event, esMaximizado) => {
    actualizarBotonesMaximizar(esMaximizado);
  });
}

