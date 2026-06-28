/**
 * @fileoverview Lógica de interfaz del Editor Markdown para Tauri V2.
 * Administra la interacción del usuario con la UI, actualiza el editor en tiempo real
 * y consume los comandos del backend Rust a través de la API IPC de Tauri V2.
 *
 * Toda la inicialización ocurre dentro de DOMContentLoaded para garantizar
 * que window.__TAURI__ esté disponible antes de usarlo.
 */

document.addEventListener("DOMContentLoaded", async () => {

  // ============================================================
  // API de Tauri V2 — acceso a través del global inyectado
  // ============================================================
  const invoke = window.__TAURI__.core.invoke;
  const { getCurrentWindow } = window.__TAURI__.window;
  const ventana = getCurrentWindow();

  const editor = document.querySelector("#editor");
  const preview = document.querySelector("#preview");
  const titulo = document.querySelector("#titulo");

  /* ==========================================================================
     Inicialización y Conversión de Markdown
     ========================================================================== */

  /**
   * Arranca la aplicación chequeando si tenías un archivo abierto en tu sesión anterior.
   * @async
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

  /**
   * Convierte el texto Markdown en HTML invocando el comando Rust y actualiza la vista previa.
   * @async
   * @param {string} text - Texto Markdown escrito por el usuario.
   */
  async function convertMarkdown(text) {
    preview.innerHTML = await invoke("parsear_markdown", { texto: text });
    agregarBotonesCopiar();
    hacerCheckboxesInteractivos();
  }

  /**
   * Compara el título para ver si tiene cambios pendientes (asterisco).
   * @returns {boolean}
   */
  function comprobarCambios() {
    return titulo.innerHTML.includes("*");
  }

  // Escucha los cambios de texto en tiempo real
  editor.addEventListener("keyup", async (e) => {
    if (!comprobarCambios()) titulo.innerHTML += "*";
    await convertMarkdown(e.target.value);
  });

  /* ==========================================================================
     Características Premium Interactivas
     ========================================================================== */

  /**
   * Inyecta un botón flotante de copiar en cada bloque de código del preview.
   */
  function agregarBotonesCopiar() {
    const bloquesPre = preview.querySelectorAll("pre");
    bloquesPre.forEach((pre) => {
      if (pre.querySelector(".code-copy-btn")) return;
      const codigoElemento = pre.querySelector("code");
      if (!codigoElemento) return;

      const boton = document.createElement("button");
      boton.className = "code-copy-btn";
      boton.setAttribute("title", "Copiar código");
      boton.innerHTML = '<i class="bi bi-copy"></i>';

      boton.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(codigoElemento.innerText);
          boton.innerHTML = '<i class="bi bi-check-lg"></i>';
          boton.classList.add("code-copy-btn--success");
          boton.setAttribute("title", "¡Copiado, che!");
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
   * Habilita interactividad en checklists del preview y sincroniza con el editor.
   */
  function hacerCheckboxesInteractivos() {
    const checkboxes = preview.querySelectorAll(".task-list-item-checkbox, input[type='checkbox']");
    checkboxes.forEach((checkbox, index) => {
      checkbox.removeAttribute("disabled");
      checkbox.setAttribute("data-index", index);
      if (checkbox.dataset.listenerRegistered) return;
      checkbox.dataset.listenerRegistered = "true";

      checkbox.addEventListener("change", async (e) => {
        const clickeadoIndex = parseInt(e.target.getAttribute("data-index"), 10);
        const estaMarcado = e.target.checked;
        const lineas = editor.value.split("\n");
        let coincidenciaActual = 0;

        for (let i = 0; i < lineas.length; i++) {
          const match = lineas[i].match(/^\s*([-*+])\s*\[([ xX])\](.*)$/);
          if (match) {
            if (coincidenciaActual === clickeadoIndex) {
              const marcadorNuevo = estaMarcado ? "x" : " ";
              const espaciosIniciales = lineas[i].substring(0, lineas[i].indexOf(match[1]));
              lineas[i] = `${espaciosIniciales}${match[1]} [${marcadorNuevo}]${match[3]}`;
              break;
            }
            coincidenciaActual++;
          }
        }

        const nuevoContenido = lineas.join("\n");
        if (nuevoContenido !== editor.value) {
          editor.value = nuevoContenido;
          if (!comprobarCambios()) titulo.innerHTML += "*";
          await convertMarkdown(nuevoContenido);
        }
      });
    });
  }

  /* ==========================================================================
     Acciones del Editor — Botones de la Barra de Herramientas
     ========================================================================== */

  document.querySelector("#new").addEventListener("click", () => ejecutarNuevoCompleto());

  document.querySelector("#close-file").addEventListener("click", async () => {
    if (comprobarCambios()) {
      const respuesta = await invoke("dialogo_sin_guardar");
      if (respuesta === 0) {
        await ejecutarGuardadoCompleto();
        if (!comprobarCambios()) ejecutarCierreCompleto();
      } else if (respuesta === 1) {
        ejecutarCierreCompleto();
      }
    } else {
      ejecutarCierreCompleto();
    }
  });

  document.querySelector("#open").addEventListener("click", async () => {
    await ejecutarAperturaCompleta();
  });

  document.querySelector("#save").addEventListener("click", async () => {
    await ejecutarGuardadoCompleto();
  });

  document.querySelector("#save-as").addEventListener("click", async () => {
    await guardarArchivoComo();
    if (comprobarCambios()) titulo.innerHTML = obtenerFileName();
  });

  document.querySelector("#export").addEventListener("click", async () => {
    if (estaDeshabilitadoEditor()) return;
    await invoke("exportar_html", { htmlContent: preview.innerHTML });
  });

  document.querySelector("#export-pdf").addEventListener("click", () => {
    if (estaDeshabilitadoEditor()) return;
    window.print();
  });

  document.querySelector("#toggle-view").addEventListener("click", () => {
    if (estaDeshabilitadoEditor()) return;
    const panelEditor = document.querySelector(".editor-workspace__panel--editor");
    panelEditor.classList.toggle("editor-workspace__panel--collapsed");
    const icono = document.querySelector("#toggle-view i");
    if (panelEditor.classList.contains("editor-workspace__panel--collapsed")) {
      icono.className = "bi bi-pencil";
      document.querySelector("#toggle-view").setAttribute("title", "Modo Edición (Mostrar editor)");
    } else {
      icono.className = "bi bi-eye";
      document.querySelector("#toggle-view").setAttribute("title", "Modo Visor (Colapsar editor)");
    }
  });

  /* ==========================================================================
     Estado del Editor
     ========================================================================== */

  function pantallaDeInicio() {
    editor.value = "";
    preview.innerHTML = "";
    titulo.innerHTML = "Archivo sin nombre";
  }

  function habilitarEditor() {
    editor.style.display = "block";
    document.querySelector(".editor-workspace__panel--editor").classList.remove("editor-workspace__panel--collapsed");
    const toggleBtn = document.querySelector("#toggle-view");
    toggleBtn.querySelector("i").className = "bi bi-eye";
    toggleBtn.setAttribute("title", "Modo Visor (Colapsar editor)");
    toggleBtn.removeAttribute("disabled");
  }

  function deshabilitarEditor() {
    editor.style.display = "none";
    document.querySelector(".editor-workspace__panel--editor").classList.add("editor-workspace__panel--collapsed");
    const toggleBtn = document.querySelector("#toggle-view");
    toggleBtn.querySelector("i").className = "bi bi-eye";
    toggleBtn.setAttribute("title", "Modo Visor (Colapsar editor)");
    toggleBtn.setAttribute("disabled", "true");
  }

  function estaDeshabilitadoEditor() {
    return editor.style.display === "none";
  }

  /* ==========================================================================
     Operaciones de Archivos (E/S via invoke Tauri)
     ========================================================================== */

  async function guardarArchivoComo() {
    const nuevoArchivo = await invoke("guardar_como", { contenido: editor.value });
    if (nuevoArchivo) {
      guardarRuta(nuevoArchivo.ruta, nuevoArchivo.nombre);
      titulo.innerHTML = nuevoArchivo.nombre;
    }
  }

  async function cargarArchivoAbierto(ruta) {
    if (!ruta) return;
    const contenido = await invoke("leer_archivo", { ruta });
    if (contenido !== null) {
      titulo.innerHTML = obtenerFileName();
      editor.value = contenido;
      await convertMarkdown(contenido);
    } else {
      resetRuta();
      pantallaDeInicio();
      deshabilitarEditor();
    }
  }

  async function guardarComo(ruta) {
    if (!ruta) return;
    const exito = await invoke("guardar_archivo", { ruta, contenido: editor.value });
    if (exito) titulo.innerHTML = obtenerFileName();
  }

  function guardarRuta(ruta, fileName) {
    if (!ruta) return;
    window.localStorage.setItem("ruta", ruta);
    window.localStorage.setItem("fileName", fileName);
  }

  function resetRuta() {
    window.localStorage.setItem("ruta", "");
    window.localStorage.setItem("fileName", "");
  }

  function obtenerRuta() {
    return window.localStorage.getItem("ruta") || "";
  }

  function obtenerFileName() {
    return window.localStorage.getItem("fileName") || "Archivo sin nombre";
  }

  /* ==========================================================================
     Control de la Ventana (Tauri V2 Window API)
     ========================================================================== */

  const closeBtn = document.querySelector("#close");
  const minBtn   = document.querySelector("#min");
  const maxBtn   = document.querySelector("#max");
  const unmaxBtn = document.querySelector("#unmax");

  /** Sincroniza la visibilidad de max/unmax según el estado actual de la ventana. */
  async function sincronizarBotonesMaximizar() {
    const esMaximizado = await ventana.isMaximized();
    actualizarBotonesMaximizar(esMaximizado);
  }

  function actualizarBotonesMaximizar(esMaximizado) {
    maxBtn.style.display   = esMaximizado ? "none"  : "block";
    unmaxBtn.style.display = esMaximizado ? "block" : "none";
  }

  /**
   * Lógica de cierre con validación de cambios sin guardar.
   * Usamos ventana.destroy() directamente para evitar el ciclo
   * close() → CloseRequested → preventDefault → loop.
   * @async
   */
  async function ejecutarCierreDeVentana() {
    if (comprobarCambios()) {
      const respuesta = await invoke("dialogo_sin_guardar");
      if (respuesta === 0) {
        // Guardar y luego cerrar
        await ejecutarGuardadoCompleto();
        if (!comprobarCambios()) await ventana.destroy();
      } else if (respuesta === 1) {
        // Descartar cambios y cerrar
        await ventana.destroy();
      }
      // respuesta === 2: cancelar → no hacer nada
    } else {
      await ventana.destroy();
    }
  }

  // Botón X de la barra de título personalizada
  closeBtn.addEventListener("click", () => ejecutarCierreDeVentana());

  // Minimizar
  minBtn.addEventListener("click", () => ventana.minimize());

  // Maximizar / Restaurar
  maxBtn.addEventListener("click", async () => {
    await ventana.maximize();
    await sincronizarBotonesMaximizar();
  });
  unmaxBtn.addEventListener("click", async () => {
    await ventana.unmaximize();
    await sincronizarBotonesMaximizar();
  });

  // Estado inicial del botón de maximizar
  sincronizarBotonesMaximizar();

  /* ==========================================================================
     Flujos de Negocio Reutilizables
     ========================================================================== */

  async function ejecutarGuardadoCompleto() {
    const ruta = obtenerRuta();
    if (!ruta) {
      await guardarArchivoComo();
    } else {
      await guardarComo(ruta);
    }
    if (comprobarCambios()) titulo.innerHTML = obtenerFileName();
    if (typeof window.incrementarGuardadosRating === "function") {
      window.incrementarGuardadosRating();
    }
  }

  async function ejecutarAperturaCompleta() {
    if (estaDeshabilitadoEditor()) habilitarEditor();
    const archivo = await invoke("abrir_archivo");
    if (archivo) {
      guardarRuta(archivo.ruta, archivo.nombre);
      titulo.innerHTML = archivo.nombre;
      editor.value = archivo.contenido;
      await convertMarkdown(archivo.contenido);
    }
  }

  function ejecutarNuevoCompleto() {
    pantallaDeInicio();
    habilitarEditor();
    resetRuta();
  }

  function ejecutarCierreCompleto() {
    pantallaDeInicio();
    deshabilitarEditor();
    resetRuta();
  }

  /* ==========================================================================
     Eventos Premium: Atajos de Teclado, Drag & Drop, Cierre de Ventana
     ========================================================================== */

  // 1. Atajos de teclado globales
  window.addEventListener("keydown", async (e) => {
    if (estaDeshabilitadoEditor()) return;
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      await ejecutarGuardadoCompleto();
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      await guardarArchivoComo();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      await ejecutarAperturaCompleta();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      ejecutarNuevoCompleto();
    }
  });

  // 2. Drag & Drop de archivos .md (Tauri V2 Nativo)
  window.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); });
  window.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); });

  ventana.onDragDropEvent(async (event) => {
    if (event.payload.type === 'drop') {
      const paths = event.payload.paths;
      if (paths && paths.length > 0) {
        const rutaFile = paths[0];
        if (rutaFile.split(".").pop().toLowerCase() === "md") {
          if (estaDeshabilitadoEditor()) habilitarEditor();
          await cargarArchivoAbierto(rutaFile);
        } else {
          await invoke("mostrar_error", {
            titulo: "Archivo no soportado",
            mensaje: "Por favor, arrastrá únicamente archivos con extensión .md, che."
          });
        }
      }
    }
  });

  // 3. Red de seguridad: si el SO intenta cerrar la ventana (Alt+F4, etc.)
  //    usamos el mismo flujo de validación de cambios.
  ventana.onCloseRequested(async (event) => {
    event.preventDefault();
    await ejecutarCierreDeVentana();
  });

  // 4. Sincronización del botón maximizar cuando el SO redimensiona la ventana
  ventana.onResized(async () => {
    await sincronizarBotonesMaximizar();
  });

  // ============================================================
  // Arranque de la aplicación
  // ============================================================
  await iniciarPrograma();

  // ============================================================
  // Lógica del Modal de Votación (Store)
  // ============================================================
  const storeModal = document.getElementById("store-rating-modal");
  const btnVote = document.getElementById("store-modal-vote");
  const btnCloseModal = document.getElementById("store-modal-close");
  let hasVoted = window.localStorage.getItem("hasVoted") === "true";
  let saveCount = parseInt(window.localStorage.getItem("saveCount") || "0", 10);
  let ratingTimeout;

  window.incrementarGuardadosRating = function() {
    if (hasVoted) return;
    saveCount++;
    window.localStorage.setItem("saveCount", saveCount.toString());
    if (saveCount % 3 === 0) {
      if (ratingTimeout) clearTimeout(ratingTimeout);
      mostrarModalRating();
    }
  };

  function mostrarModalRating() {
    if (hasVoted || !storeModal) return;
    storeModal.style.display = "flex";
    setTimeout(() => storeModal.classList.add("active"), 10);
  }

  function ocultarModalRating() {
    if (!storeModal) return;
    storeModal.classList.remove("active");
    setTimeout(() => { storeModal.style.display = "none"; }, 300);
  }

  if (!hasVoted) {
    // A los 5 minutos salta si no se llegó a los 3 guardados
    ratingTimeout = setTimeout(() => {
      mostrarModalRating();
    }, 5 * 60 * 1000);
  }

  if (btnVote) {
    btnVote.addEventListener("click", async () => {
      hasVoted = true;
      window.localStorage.setItem("hasVoted", "true");
      ocultarModalRating();
      try {
        await invoke("plugin:shell|open", { path: "ms-windows-store://review/?ProductId=9PC8MCBSJ2HJ" });
      } catch (err) {
        console.error("Error al abrir la store: ", err);
      }
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
      ocultarModalRating();
      // Reiniciamos el contador para que vuelva a salir a los 3 próximos guardados
      saveCount = 0;
      window.localStorage.setItem("saveCount", "0");
    });
  }

}); // fin DOMContentLoaded
