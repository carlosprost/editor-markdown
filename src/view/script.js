/**
 * @fileoverview Lógica de interfaz del Editor Markdown (v2.3.0) para Tauri V2.
 * Administra la interacción del usuario con la UI, actualiza el editor en tiempo real,
 * calcula estadísticas en vivo, coordina el scroll sincronizado, búsqueda/reemplazo,
 * temas visuales (Free + PRO), plantillas, modo presentación, modo zen y la
 * verificación y restauración automática de licencias con la Microsoft Store.
 */

document.addEventListener("DOMContentLoaded", async () => {

  // ============================================================
  // API de Tauri V2 — Acceso a través del global inyectado
  // ============================================================
  const invoke = window.__TAURI__?.core?.invoke;
  const { getCurrentWindow } = window.__TAURI__?.window || {};
  const ventana = getCurrentWindow ? getCurrentWindow() : null;

  // Elementos principales del DOM
  const editor = document.querySelector("#editor");
  const preview = document.querySelector("#preview");
  const previewPanel = document.querySelector(".editor-workspace__panel--preview");
  const editorPanel = document.querySelector(".editor-workspace__panel--editor");
  const titulo = document.querySelector("#titulo");

  // Elementos de la barra de estado (Footer)
  const statWords = document.querySelector("#stat-words");
  const statChars = document.querySelector("#stat-chars");
  const statLines = document.querySelector("#stat-lines");
  const statReadingTime = document.querySelector("#stat-reading-time");
  const statSaveStatus = document.querySelector("#stat-save-status");
  const statThemeName = document.querySelector("#stat-theme-name");
  const statFontSize = document.querySelector("#stat-font-size");
  const statProBadge = document.querySelector("#stat-pro-badge");

  // Modales y Contenedores
  const toastContainer = document.querySelector("#toast-container");
  const templatesModal = document.querySelector("#templates-modal");
  const themeModal = document.querySelector("#theme-modal");
  const proModal = document.querySelector("#pro-modal");
  const secretDevModal = document.querySelector("#secret-dev-modal");
  const findReplacePanel = document.querySelector("#find-replace-panel");
  const replaceRow = document.querySelector("#replace-row");

  // Elementos Modo Presentación (Slideshow)
  const slideshowOverlay = document.querySelector("#slideshow-overlay");
  const slideshowContent = document.querySelector("#slideshow-content");
  const slideshowCounter = document.querySelector("#slideshow-counter");
  const slideshowPrev = document.querySelector("#slideshow-prev");
  const slideshowNext = document.querySelector("#slideshow-next");
  const slideshowExit = document.querySelector("#slideshow-exit");

  // Elementos Modo Zen
  const zenExitBtn = document.querySelector("#zen-exit-btn");

  // Variables de Estado
  let isModified = false;
  let syncScrollActive = true;
  let currentFontSize = parseInt(window.localStorage.getItem("editor_font_size") || "14", 10);
  let isScrollingEditor = false;
  let isScrollingPreview = false;
  let findMatches = [];
  let currentMatchIndex = -1;

  // Estado Slideshow
  let slideshowSlides = [];
  let currentSlideIndex = 0;
  let isSlideshowActive = false;

  // Estado PRO y Monetización
  let isPro = window.localStorage.getItem("editor_pro_license") === "active";
  let lastProModalShownTime = 0;
  let totalSaveActions = 0;

  /* ==========================================================================
     1. Sistema de Notificaciones Toast
     ========================================================================== */

  function showToast(mensaje, tipo = "info", duracionMs = 3000) {
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast toast--${tipo}`;

    let icono = "bi-info-circle-fill";
    if (tipo === "success") icono = "bi-check-circle-fill";
    if (tipo === "warning") icono = "bi-exclamation-triangle-fill";
    if (tipo === "error") icono = "bi-x-circle-fill";

    toast.innerHTML = `
      <i class="bi ${icono} toast__icon"></i>
      <span class="toast__message">${mensaje}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("toast--exit");
      setTimeout(() => toast.remove(), 250);
    }, duracionMs);
  }

  /* ==========================================================================
     2. Módulo de Licencia y Restauración Automática con Microsoft Store
     ========================================================================== */

  const btnPro = document.querySelector("#btn-pro");
  const proBtnText = document.querySelector("#pro-btn-text");
  const btnBuyStore = document.querySelector("#btn-buy-store");
  const btnCloseProModal = document.querySelector("#pro-modal-close");
  const btnLaterPro = document.querySelector("#btn-later-pro");

  // Elementos de Acceso Master Developer Secreto
  const devMasterKeyInput = document.querySelector("#dev-master-key-input");
  const btnSubmitDevKey = document.querySelector("#btn-submit-dev-key");
  const secretDevModalClose = document.querySelector("#secret-dev-modal-close");
  const devKeyFeedback = document.querySelector("#dev-key-feedback");

  function actualizarEstadoProUI() {
    if (isPro) {
      if (btnPro) {
        btnPro.classList.add("editor-header__pro-btn--active");
        if (proBtnText) proBtnText.innerText = "👑 PRO Activo";
        btnPro.setAttribute("title", "¡Tenés la versión PRO de por vida!");
      }
      if (statProBadge) {
        statProBadge.innerHTML = '<span class="badge-pro">👑 PRO</span>';
      }
      document.querySelectorAll(".theme-lock-icon").forEach(el => el.style.display = "none");
    } else {
      if (btnPro) {
        btnPro.classList.remove("editor-header__pro-btn--active");
        if (proBtnText) proBtnText.innerText = "👑 Pasar a PRO";
        btnPro.setAttribute("title", "Desbloquear Editor Markdown PRO");
      }
      if (statProBadge) {
        statProBadge.innerHTML = '<span class="badge-free">FREE</span>';
      }
      document.querySelectorAll(".theme-lock-icon").forEach(el => el.style.display = "inline");
    }
  }

  actualizarEstadoProUI();

  /**
   * Consulta automáticamente a Windows y Microsoft Store si el usuario posee la licencia.
   */
  async function verificarLicenciaAutomatica() {
    if (!invoke) return;
    try {
      const estado = await invoke("verificar_licencia_store");
      if (estado && estado.es_pro) {
        if (!isPro) {
          isPro = true;
          window.localStorage.setItem("editor_pro_license", "active");
          actualizarEstadoProUI();
          showToast("👑 Licencia PRO restaurada automáticamente", "success", 4000);
        }
      }
    } catch (err) {
      console.warn("No se pudo verificar la licencia Store automáticamente:", err);
    }
  }

  function abrirModalPro() {
    if (proModal) {
      proModal.style.display = "flex";
      lastProModalShownTime = Date.now();
    }
  }

  function cerrarModalPro() {
    if (proModal) proModal.style.display = "none";
  }

  function abrirModalDev() {
    if (secretDevModal) {
      secretDevModal.style.display = "flex";
      if (devKeyFeedback) devKeyFeedback.innerText = "";
      if (devMasterKeyInput) {
        devMasterKeyInput.value = "";
        devMasterKeyInput.focus();
      }
    }
  }

  function cerrarModalDev() {
    if (secretDevModal) secretDevModal.style.display = "none";
  }

  /**
   * Envía la Master Key al algoritmo fragmentado de Rust en el backend.
   * Si es correcta, activa PRO y abre Tauri DevTools en producción.
   */
  async function ejecutarActivacionMasterDev() {
    const key = devMasterKeyInput?.value || "";
    if (!key.trim()) {
      if (devKeyFeedback) {
        devKeyFeedback.style.color = "var(--danger)";
        devKeyFeedback.innerText = "Ingresá una clave válida.";
      }
      return;
    }

    if (!invoke) {
      if (devKeyFeedback) {
        devKeyFeedback.style.color = "var(--danger)";
        devKeyFeedback.innerText = "Error: IPC de Tauri no disponible.";
      }
      return;
    }

    try {
      const res = await invoke("activar_master_developer", { masterKey: key.trim() });
      if (res && res.es_pro) {
        isPro = true;
        window.localStorage.setItem("editor_pro_license", "active");
        actualizarEstadoProUI();
        cerrarModalDev();
        showToast("👑 ¡Modo Desarrollador y DevTools activados en Producción!", "success", 5000);
      }
    } catch (err) {
      if (devKeyFeedback) {
        devKeyFeedback.style.color = "var(--danger)";
        devKeyFeedback.innerText = typeof err === "string" ? `Error: ${err}` : "Firma matemática no válida.";
      }
    }
  }

  // Eventos Modal PRO
  btnPro?.addEventListener("click", abrirModalPro);
  btnCloseProModal?.addEventListener("click", cerrarModalPro);
  btnLaterPro?.addEventListener("click", cerrarModalPro);

  // Eventos Modal Master Dev
  btnSubmitDevKey?.addEventListener("click", ejecutarActivacionMasterDev);
  secretDevModalClose?.addEventListener("click", cerrarModalDev);
  devMasterKeyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") ejecutarActivacionMasterDev();
    else if (e.key === "Escape") cerrarModalDev();
  });

  btnBuyStore?.addEventListener("click", async () => {
    try {
      if (invoke) {
        await invoke("plugin:shell|open", { path: "ms-windows-store://pdp/?productid=9PC8MCBSJ2HJ" });
      }
      showToast("Abriendo Microsoft Store...", "info");
    } catch (err) {
      console.error("Error al abrir Store:", err);
    }
  });

  /* Pop-up periódico de venta PRO */
  function verificarUpsellPro() {
    if (isPro) return;
    const ahora = Date.now();
    const SEIS_MINUTOS = 6 * 60 * 1000;
    
    if (ahora - lastProModalShownTime > SEIS_MINUTOS) {
      abrirModalPro();
    }
  }

  setTimeout(() => { verificarUpsellPro(); }, 7 * 60 * 1000);
  setInterval(() => { verificarUpsellPro(); }, 10 * 60 * 1000);

  /* ==========================================================================
     3. Sistema de Temas Visuales (Free + PRO)
     ========================================================================== */

  const TEMAS_MAP = {
    slate: "Slate Dark",
    obsidian: "Obsidian Pitch Black",
    nordic: "Nordic Frost",
    light: "Clean Paper (Claro)",
    cyberpunk: "Cyberpunk Neon (PRO)",
    dracula: "Dracula Vampire (PRO)",
    solarized: "Solarized Dark (PRO)",
    amber: "Amber Retro (PRO)"
  };

  const TEMAS_PRO_LIST = ["cyberpunk", "dracula", "solarized", "amber"];

  function aplicarTema(tema) {
    const temaValido = TEMAS_MAP[tema] ? tema : "slate";
    
    if (TEMAS_PRO_LIST.includes(temaValido) && !isPro) {
      abrirModalPro();
      showToast("Este tema es exclusivo de la versión PRO", "warning");
      return;
    }

    document.documentElement.setAttribute("data-theme", temaValido);
    window.localStorage.setItem("editor_theme", temaValido);
    if (statThemeName) {
      statThemeName.innerHTML = `<i class="bi bi-palette2"></i> ${TEMAS_MAP[temaValido]}`;
    }
  }

  const temaGuardado = window.localStorage.getItem("editor_theme") || "slate";
  aplicarTema(temaGuardado);

  /* ==========================================================================
     4. Modo Presentación Diapositivas (PRO Feature)
     ========================================================================== */

  const btnSlideshow = document.querySelector("#btn-slideshow");

  async function iniciarSlideshow() {
    if (!isPro) {
      abrirModalPro();
      showToast("El Modo Presentación es una función PRO", "warning");
      return;
    }

    const rawText = editor.value.trim();
    if (!rawText) {
      showToast("Escribí algo en el editor antes de presentar", "warning");
      return;
    }

    slideshowSlides = rawText.split(/\n\s*(?:---+|\*\*\*+|___+)\s*\n/);
    if (slideshowSlides.length === 0) slideshowSlides = [rawText];

    currentSlideIndex = 0;
    isSlideshowActive = true;
    if (slideshowOverlay) slideshowOverlay.style.display = "flex";
    await renderizarSlideActual();
  }

  async function renderizarSlideActual() {
    if (!isSlideshowActive || !slideshowContent) return;
    const slideText = slideshowSlides[currentSlideIndex] || "";
    
    let html = "";
    if (invoke) {
      html = await invoke("parsear_markdown", { texto: slideText });
    } else {
      html = slideText;
    }

    slideshowContent.innerHTML = html;
    if (slideshowCounter) {
      slideshowCounter.innerText = `Slide ${currentSlideIndex + 1} / ${slideshowSlides.length}`;
    }
  }

  function slideSiguiente() {
    if (currentSlideIndex < slideshowSlides.length - 1) {
      currentSlideIndex++;
      renderizarSlideActual();
    }
  }

  function slideAnterior() {
    if (currentSlideIndex > 0) {
      currentSlideIndex--;
      renderizarSlideActual();
    }
  }

  function salirSlideshow() {
    isSlideshowActive = false;
    if (slideshowOverlay) slideshowOverlay.style.display = "none";
  }

  btnSlideshow?.addEventListener("click", iniciarSlideshow);
  slideshowNext?.addEventListener("click", slideSiguiente);
  slideshowPrev?.addEventListener("click", slideAnterior);
  slideshowExit?.addEventListener("click", salirSlideshow);

  /* ==========================================================================
     5. Modo Enfoque Zen (PRO Feature)
     ========================================================================== */

  const btnZen = document.querySelector("#btn-zen");

  function toggleModoZen() {
    if (!isPro) {
      abrirModalPro();
      showToast("El Modo Enfoque Zen es una función PRO", "warning");
      return;
    }

    const isZen = document.body.classList.toggle("editor-app--zen");
    if (zenExitBtn) zenExitBtn.style.display = isZen ? "flex" : "none";
    if (isZen) {
      editor.focus();
      showToast("Modo Zen activado (Presioná Esc para salir)", "info", 2500);
    }
  }

  function salirModoZen() {
    document.body.classList.remove("editor-app--zen");
    if (zenExitBtn) zenExitBtn.style.display = "none";
  }

  btnZen?.addEventListener("click", toggleModoZen);
  zenExitBtn?.addEventListener("click", salirModoZen);

  /* ==========================================================================
     6. Estadísticas en Vivo del Documento
     ========================================================================== */

  function actualizarEstadisticas(texto) {
    const textoLimpio = texto.trim();
    const palabras = textoLimpio === "" ? 0 : textoLimpio.split(/\s+/).length;
    const caracteres = texto.length;
    const lineas = texto === "" ? 0 : texto.split("\n").length;
    const minutosLectura = Math.ceil(palabras / 200);
    const tiempoTexto = palabras === 0 ? "0 min de lectura" : (minutosLectura <= 1 ? "1 min de lectura" : `${minutosLectura} min de lectura`);

    if (statWords) statWords.innerHTML = `<i class="bi bi-fonts"></i> ${palabras.toLocaleString()} ${palabras === 1 ? 'palabra' : 'palabras'}`;
    if (statChars) statChars.innerText = `${caracteres.toLocaleString()} caracteres`;
    if (statLines) statLines.innerText = `${lineas.toLocaleString()} ${lineas === 1 ? 'línea' : 'líneas'}`;
    if (statReadingTime) statReadingTime.innerHTML = `<i class="bi bi-book"></i> ${tiempoTexto}`;
  }

  function setEstadoModificado(modificado) {
    isModified = modificado;
    const baseTitle = obtenerFileName();
    
    if (modificado) {
      if (!titulo.innerHTML.includes("*")) titulo.innerHTML = `${baseTitle}*`;
      if (statSaveStatus) {
        statSaveStatus.innerHTML = `
          <span class="editor-statusbar__dot editor-statusbar__dot--modified"></span>
          <span>Modificado</span>
        `;
      }
    } else {
      titulo.innerHTML = baseTitle;
      if (statSaveStatus) {
        statSaveStatus.innerHTML = `
          <span class="editor-statusbar__dot editor-statusbar__dot--saved"></span>
          <span>Guardado</span>
        `;
      }
    }
  }

  function comprobarCambios() {
    return isModified || titulo.innerHTML.includes("*");
  }

  /* ==========================================================================
     7. Ajuste Dinámico de Tamaño de Letra
     ========================================================================== */

  function setFontSize(nuevoSize) {
    currentFontSize = Math.max(11, Math.min(26, nuevoSize));
    editor.style.fontSize = `${currentFontSize}px`;
    window.localStorage.setItem("editor_font_size", currentFontSize.toString());
    if (statFontSize) statFontSize.innerText = `${currentFontSize}px`;
  }

  setFontSize(currentFontSize);

  document.querySelector("#tool-font-decrease")?.addEventListener("click", () => setFontSize(currentFontSize - 1));
  document.querySelector("#tool-font-increase")?.addEventListener("click", () => setFontSize(currentFontSize + 1));

  /* ==========================================================================
     8. Scroll Sincronizado Inteligente
     ========================================================================== */

  const syncScrollBtn = document.querySelector("#tool-sync-scroll");

  function toggleSyncScroll() {
    syncScrollActive = !syncScrollActive;
    if (syncScrollBtn) {
      if (syncScrollActive) {
        syncScrollBtn.classList.add("editor-toolbar__btn--active");
        syncScrollBtn.setAttribute("title", "Sincronización de scroll activa");
        showToast("Scroll sincronizado activado", "info", 2000);
      } else {
        syncScrollBtn.classList.remove("editor-toolbar__btn--active");
        syncScrollBtn.setAttribute("title", "Sincronización de scroll desactivada");
        showToast("Scroll sincronizado desactivado", "info", 2000);
      }
    }
  }

  syncScrollBtn?.addEventListener("click", toggleSyncScroll);

  editor.addEventListener("scroll", () => {
    if (!syncScrollActive || isScrollingPreview || estaDeshabilitadoEditor()) return;
    isScrollingEditor = true;

    const editorScrollMax = editor.scrollHeight - editor.clientHeight;
    if (editorScrollMax > 0 && previewPanel) {
      const porcentaje = editor.scrollTop / editorScrollMax;
      const previewScrollMax = previewPanel.scrollHeight - previewPanel.clientHeight;
      previewPanel.scrollTop = porcentaje * previewScrollMax;
    }

    setTimeout(() => { isScrollingEditor = false; }, 50);
  });

  previewPanel?.addEventListener("scroll", () => {
    if (!syncScrollActive || isScrollingEditor || estaDeshabilitadoEditor()) return;
    isScrollingPreview = true;

    const previewScrollMax = previewPanel.scrollHeight - previewPanel.clientHeight;
    if (previewScrollMax > 0 && editor) {
      const porcentaje = previewPanel.scrollTop / previewScrollMax;
      const editorScrollMax = editor.scrollHeight - editor.clientHeight;
      editor.scrollTop = porcentaje * editorScrollMax;
    }

    setTimeout(() => { isScrollingPreview = false; }, 50);
  });

  /* ==========================================================================
     9. Inicialización y Parseo de Markdown
     ========================================================================== */

  async function iniciarPrograma() {
    // 1. Verificar licencia automáticamente con Microsoft Store y SO
    await verificarLicenciaAutomatica();

    // 2. Comprobar si se pasó un archivo por parámetro CLI (Doble clic / Abrir con...)
    try {
      if (invoke) {
        const archivoInicial = await invoke("obtener_archivo_inicio");
        if (archivoInicial) {
          habilitarEditor();
          guardarRuta(archivoInicial.ruta, archivoInicial.nombre);
          titulo.innerHTML = archivoInicial.nombre;
          editor.value = archivoInicial.contenido;
          setEstadoModificado(false);
          await convertMarkdown(archivoInicial.contenido);
          showToast(`Archivo abierto: ${archivoInicial.nombre}`, "info");
          return;
        }
      }
    } catch (err) {
      console.warn("No se pudo obtener el archivo inicial:", err);
    }

    // 3. Restaurar última sesión o borrador
    const ruta = obtenerRuta();
    if (!ruta) {
      const borrador = window.localStorage.getItem("editor_draft");
      if (borrador && borrador.trim().length > 0) {
        habilitarEditor();
        editor.value = borrador;
        setEstadoModificado(true);
        await convertMarkdown(borrador);
        showToast("Borrador previo recuperado automáticamente", "info");
      } else {
        pantallaDeInicio();
        deshabilitarEditor();
      }
    } else {
      habilitarEditor();
      await cargarArchivoAbierto(ruta);
    }
  }

  async function convertMarkdown(text) {
    if (invoke) {
      preview.innerHTML = await invoke("parsear_markdown", { texto: text });
    } else {
      preview.innerText = text;
    }
    actualizarEstadisticas(text);
    agregarBotonesCopiar();
    hacerCheckboxesInteractivos();
    window.localStorage.setItem("editor_draft", text);
  }

  editor.addEventListener("input", async (e) => {
    setEstadoModificado(true);
    await convertMarkdown(e.target.value);
  });

  /* ==========================================================================
     10. Herramientas Interactivas (Copiar y Checklists)
     ========================================================================== */

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
          boton.setAttribute("title", "¡Copiado!");
          showToast("Código copiado al portapapeles", "success", 2000);
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
          setEstadoModificado(true);
          await convertMarkdown(nuevoContenido);
        }
      });
    });
  }

  /* ==========================================================================
     11. Barra de Formato Rápido Markdown
     ========================================================================== */

  function wrapSelection(prefix, suffix, defaultText = "texto") {
    if (estaDeshabilitadoEditor()) return;
    editor.focus();

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.substring(start, end);
    const content = selected.length > 0 ? selected : defaultText;

    const replacement = `${prefix}${content}${suffix}`;
    editor.setRangeText(replacement, start, end, "select");
    
    if (selected.length === 0) {
      editor.setSelectionRange(start + prefix.length, start + prefix.length + defaultText.length);
    }

    setEstadoModificado(true);
    convertMarkdown(editor.value);
  }

  function insertLinePrefix(prefix) {
    if (estaDeshabilitadoEditor()) return;
    editor.focus();

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;

    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const actualEnd = lineEnd === -1 ? value.length : lineEnd;

    const selectedLines = value.substring(lineStart, actualEnd).split("\n");
    const transformedLines = selectedLines.map(line => `${prefix}${line}`);
    const replacement = transformedLines.join("\n");

    editor.setSelectionRange(lineStart, actualEnd);
    editor.setRangeText(replacement, lineStart, actualEnd, "select");

    setEstadoModificado(true);
    convertMarkdown(editor.value);
  }

  function insertTable() {
    const tableTemplate = `\n| Columna 1 | Columna 2 | Columna 3 |\n| :--- | :---: | ---: |\n| Fila 1, Dato 1 | Fila 1, Dato 2 | Fila 1, Dato 3 |\n| Fila 2, Dato 1 | Fila 2, Dato 2 | Fila 2, Dato 3 |\n\n`;
    wrapSelection("", tableTemplate, "");
    showToast("Tabla Markdown insertada", "success");
  }

  document.querySelector("#tool-bold")?.addEventListener("click", () => wrapSelection("**", "**", "texto en negrita"));
  document.querySelector("#tool-italic")?.addEventListener("click", () => wrapSelection("*", "*", "texto en cursiva"));
  document.querySelector("#tool-strikethrough")?.addEventListener("click", () => wrapSelection("~~", "~~", "texto tachado"));
  document.querySelector("#tool-highlight")?.addEventListener("click", () => wrapSelection("==", "==", "texto resaltado"));
  
  document.querySelector("#tool-h1")?.addEventListener("click", () => insertLinePrefix("# "));
  document.querySelector("#tool-h2")?.addEventListener("click", () => insertLinePrefix("## "));
  document.querySelector("#tool-h3")?.addEventListener("click", () => insertLinePrefix("### "));

  document.querySelector("#tool-quote")?.addEventListener("click", () => insertLinePrefix("> "));
  document.querySelector("#tool-code")?.addEventListener("click", () => wrapSelection("`", "`", "código"));
  document.querySelector("#tool-code-block")?.addEventListener("click", () => wrapSelection("\n```javascript\n", "\n```\n", "// Escribí tu código acá"));

  document.querySelector("#tool-ul")?.addEventListener("click", () => insertLinePrefix("- "));
  document.querySelector("#tool-ol")?.addEventListener("click", () => insertLinePrefix("1. "));
  document.querySelector("#tool-task")?.addEventListener("click", () => insertLinePrefix("- [ ] "));

  document.querySelector("#tool-link")?.addEventListener("click", () => wrapSelection("[", "](https://ejemplo.com)", "enlace"));
  document.querySelector("#tool-table")?.addEventListener("click", insertTable);
  document.querySelector("#tool-hr")?.addEventListener("click", () => wrapSelection("\n---\n\n", "", ""));

  document.querySelector("#tool-alert-note")?.addEventListener("click", () => wrapSelection("\n> [!NOTE]\n> ", "\n\n", "Escribí tu nota informativa acá..."));
  document.querySelector("#tool-alert-tip")?.addEventListener("click", () => wrapSelection("\n> [!TIP]\n> ", "\n\n", "Escribí un consejo útil acá..."));
  document.querySelector("#tool-alert-warn")?.addEventListener("click", () => wrapSelection("\n> [!WARNING]\n> ", "\n\n", "Escribí tu advertencia acá..."));

  /* ==========================================================================
     12. Sistema de Búsqueda y Reemplazo
     ========================================================================== */

  const findInput = document.querySelector("#find-input");
  const replaceInput = document.querySelector("#replace-input");
  const findCount = document.querySelector("#find-count");
  const btnFindReplace = document.querySelector("#btn-find-replace");
  const btnToggleReplaceMode = document.querySelector("#toggle-replace-mode");
  const btnFindClose = document.querySelector("#find-close");
  const btnFindPrev = document.querySelector("#find-prev");
  const btnFindNext = document.querySelector("#find-next");
  const btnReplaceOne = document.querySelector("#replace-one");
  const btnReplaceAll = document.querySelector("#replace-all");

  function abrirBuscador(modoReemplazo = false) {
    if (!findReplacePanel) return;
    findReplacePanel.style.display = "flex";
    if (replaceRow) {
      replaceRow.style.display = modoReemplazo ? "flex" : "none";
    }
    findInput?.focus();
    findInput?.select();
    ejecutarBusqueda();
  }

  function cerrarBuscador() {
    if (!findReplacePanel) return;
    findReplacePanel.style.display = "none";
    findMatches = [];
    currentMatchIndex = -1;
    editor.focus();
  }

  function ejecutarBusqueda() {
    const query = findInput?.value || "";
    findMatches = [];
    currentMatchIndex = -1;

    if (!query) {
      if (findCount) findCount.innerText = "0 / 0";
      return;
    }

    const text = editor.value;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let match;

    while ((match = regex.exec(text)) !== null) {
      findMatches.push({ start: match.index, end: match.index + match[0].length });
    }

    if (findMatches.length > 0) {
      currentMatchIndex = 0;
      seleccionarCoincidencia(currentMatchIndex);
    }

    actualizarContadorBusqueda();
  }

  function seleccionarCoincidencia(index) {
    if (index < 0 || index >= findMatches.length) return;
    const m = findMatches[index];
    editor.focus();
    editor.setSelectionRange(m.start, m.end);
    actualizarContadorBusqueda();
  }

  function actualizarContadorBusqueda() {
    if (!findCount) return;
    if (findMatches.length === 0) {
      findCount.innerText = "0 / 0";
    } else {
      findCount.innerText = `${currentMatchIndex + 1} / ${findMatches.length}`;
    }
  }

  function siguienteCoincidencia() {
    if (findMatches.length === 0) return;
    currentMatchIndex = (currentMatchIndex + 1) % findMatches.length;
    seleccionarCoincidencia(currentMatchIndex);
  }

  function anteriorCoincidencia() {
    if (findMatches.length === 0) return;
    currentMatchIndex = (currentMatchIndex - 1 + findMatches.length) % findMatches.length;
    seleccionarCoincidencia(currentMatchIndex);
  }

  function reemplazarActual() {
    if (findMatches.length === 0 || currentMatchIndex === -1) return;
    const replaceValue = replaceInput?.value || "";
    const m = findMatches[currentMatchIndex];

    editor.setRangeText(replaceValue, m.start, m.end, "select");
    setEstadoModificado(true);
    convertMarkdown(editor.value);
    ejecutarBusqueda();
  }

  function reemplazarTodos() {
    const query = findInput?.value || "";
    if (!query || findMatches.length === 0) return;
    const replaceValue = replaceInput?.value || "";
    
    const count = findMatches.length;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    editor.value = editor.value.replace(regex, replaceValue);

    setEstadoModificado(true);
    convertMarkdown(editor.value);
    ejecutarBusqueda();
    showToast(`Se reemplazaron ${count} coincidencias`, "success");
  }

  btnFindReplace?.addEventListener("click", () => {
    if (findReplacePanel.style.display === "none") abrirBuscador(false);
    else cerrarBuscador();
  });

  btnToggleReplaceMode?.addEventListener("click", () => {
    if (replaceRow) {
      const isHidden = replaceRow.style.display === "none";
      replaceRow.style.display = isHidden ? "flex" : "none";
      if (isHidden) replaceInput?.focus();
    }
  });

  btnFindClose?.addEventListener("click", cerrarBuscador);
  btnFindNext?.addEventListener("click", siguienteCoincidencia);
  btnFindPrev?.addEventListener("click", anteriorCoincidencia);
  btnReplaceOne?.addEventListener("click", reemplazarActual);
  btnReplaceAll?.addEventListener("click", reemplazarTodos);

  findInput?.addEventListener("input", ejecutarBusqueda);
  findInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (e.shiftKey) anteriorCoincidencia();
      else siguienteCoincidencia();
    } else if (e.key === "Escape") {
      cerrarBuscador();
    }
  });

  replaceInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") reemplazarActual();
    else if (e.key === "Escape") cerrarBuscador();
  });

  /* ==========================================================================
     13. Modales de Plantillas y Temas
     ========================================================================== */

  const btnTemplates = document.querySelector("#btn-templates");
  const btnTemplatesClose = document.querySelector("#templates-modal-close");

  btnTemplates?.addEventListener("click", () => {
    if (templatesModal) templatesModal.style.display = "flex";
  });

  btnTemplatesClose?.addEventListener("click", () => {
    if (templatesModal) templatesModal.style.display = "none";
  });

  const btnTheme = document.querySelector("#btn-theme");
  const btnThemeClose = document.querySelector("#theme-modal-close");

  btnTheme?.addEventListener("click", () => {
    if (themeModal) themeModal.style.display = "flex";
  });

  btnThemeClose?.addEventListener("click", () => {
    if (themeModal) themeModal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === templatesModal) templatesModal.style.display = "none";
    if (e.target === themeModal) themeModal.style.display = "none";
    if (e.target === proModal) proModal.style.display = "none";
    if (e.target === secretDevModal) secretDevModal.style.display = "none";
  });

  document.querySelectorAll(".theme-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      const selected = opt.getAttribute("data-set-theme");
      const requiresPro = opt.getAttribute("data-is-pro") === "true";
      
      if (requiresPro && !isPro) {
        if (themeModal) themeModal.style.display = "none";
        abrirModalPro();
        showToast("Este tema es exclusivo de la versión PRO", "warning");
        return;
      }

      if (selected) {
        aplicarTema(selected);
        if (themeModal) themeModal.style.display = "none";
        showToast(`Tema cambiado a ${TEMAS_MAP[selected]}`, "success");
      }
    });
  });

  /* ==========================================================================
     14. Biblioteca de Plantillas
     ========================================================================== */

  const PLANTILLAS = {
    readme: `# 🚀 Nombre del Proyecto\n\nBreve descripción de qué hace tu proyecto.\n\n## ✨ Características Principales\n\n- ⚡ **Rápido y Liviano**\n- 🔒 **Seguro** (OWASP / ISO)\n- 🎨 **Diseño Moderno**\n\n## 🛠️ Instalación\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## 📄 Licencia\nMIT\n`,
    meeting: `# 📝 Minuta de Reunión\n\n**Fecha:** ${new Date().toLocaleDateString("es-AR")}\n**Participantes:** Equipo Técnico\n\n---\n\n## 🎯 Orden del Día\n1. Estado de la versión PRO.\n2. Roadmap de lanzamiento.\n\n## 📌 Acuerdos\n- [x] Implementar verificación automática de licencias\n- [ ] Publicar build en la Store\n`,
    api: `# 🔌 Documentación de API REST\n\n\`GET /api/v1/recurso\`\n\n### Respuesta Exitosa (\`200 OK\`)\n\`\`\`json\n{\n  "status": "success",\n  "data": []\n}\n\`\`\`\n`,
    sprint: `# 📋 Sprint Tracker\n\n## 🔴 Alta Prioridad\n- [x] Modo Presentación\n- [x] Modo Enfoque Zen\n- [x] 4 Temas PRO\n\n## 🟡 Media Prioridad\n- [ ] Campaña promocional\n`,
    changelog: `# 📜 Notas de la Versión\n\n## [v2.3.0] - ${new Date().toLocaleDateString("es-AR")}\n\n- 👑 **Editor Markdown PRO:** Presentación, Modo Zen, 4 temas PRO y restauración automática de licencias.\n`
  };

  document.querySelectorAll(".template-card").forEach((card) => {
    card.addEventListener("click", async () => {
      const templateKey = card.getAttribute("data-template");
      if (templateKey && PLANTILLAS[templateKey]) {
        habilitarEditor();
        editor.value = PLANTILLAS[templateKey];
        setEstadoModificado(true);
        await convertMarkdown(editor.value);
        if (templatesModal) templatesModal.style.display = "none";
        showToast("Plantilla insertada", "success");
      }
    });
  });

  /* ==========================================================================
     15. Operaciones de Archivo
     ========================================================================== */

  document.querySelector("#new").addEventListener("click", () => ejecutarNuevoCompleto());

  document.querySelector("#close-file").addEventListener("click", async () => {
    if (comprobarCambios()) {
      const respuesta = invoke ? await invoke("dialogo_sin_guardar") : 1;
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
  });

  document.querySelector("#export").addEventListener("click", async () => {
    if (estaDeshabilitadoEditor() || !invoke) return;
    try {
      await invoke("exportar_html", { htmlContent: preview.innerHTML });
      showToast("Documento exportado como HTML", "success");
    } catch (err) {
      showToast("Error al exportar HTML", "error");
    }
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
      showToast("Modo Visor activado", "info", 1500);
    } else {
      icono.className = "bi bi-eye";
      document.querySelector("#toggle-view").setAttribute("title", "Modo Visor (Colapsar editor)");
    }
  });

  /* ==========================================================================
     16. Estado del Editor y Helpers
     ========================================================================== */

  function pantallaDeInicio() {
    editor.value = "";
    preview.innerHTML = "";
    titulo.innerHTML = "Archivo sin nombre";
    setEstadoModificado(false);
    actualizarEstadisticas("");
    window.localStorage.removeItem("editor_draft");
  }

  function habilitarEditor() {
    editor.style.display = "block";
    editorPanel?.classList.remove("editor-workspace__panel--collapsed");
    const toggleBtn = document.querySelector("#toggle-view");
    if (toggleBtn) {
      toggleBtn.querySelector("i").className = "bi bi-eye";
      toggleBtn.setAttribute("title", "Modo Visor (Colapsar editor)");
      toggleBtn.removeAttribute("disabled");
    }
  }

  function deshabilitarEditor() {
    editor.style.display = "none";
    editorPanel?.classList.add("editor-workspace__panel--collapsed");
    const toggleBtn = document.querySelector("#toggle-view");
    if (toggleBtn) {
      toggleBtn.querySelector("i").className = "bi bi-eye";
      toggleBtn.setAttribute("title", "Modo Visor (Colapsar editor)");
      toggleBtn.setAttribute("disabled", "true");
    }
  }

  function estaDeshabilitadoEditor() {
    return editor.style.display === "none";
  }

  async function guardarArchivoComo() {
    if (!invoke) return;
    const nuevoArchivo = await invoke("guardar_como", { contenido: editor.value });
    if (nuevoArchivo) {
      guardarRuta(nuevoArchivo.ruta, nuevoArchivo.nombre);
      setEstadoModificado(false);
      showToast(`Archivo guardado: ${nuevoArchivo.nombre}`, "success");
      onGuardadoExitoso();
    }
  }

  async function cargarArchivoAbierto(ruta) {
    if (!ruta || !invoke) return;
    const contenido = await invoke("leer_archivo", { ruta });
    if (contenido !== null) {
      setEstadoModificado(false);
      editor.value = contenido;
      await convertMarkdown(contenido);
    } else {
      resetRuta();
      pantallaDeInicio();
      deshabilitarEditor();
    }
  }

  async function guardarComo(ruta) {
    if (!ruta || !invoke) return;
    const exito = await invoke("guardar_archivo", { ruta, contenido: editor.value });
    if (exito) {
      setEstadoModificado(false);
      showToast("Cambios guardados con éxito", "success");
      onGuardadoExitoso();
    }
  }

  function onGuardadoExitoso() {
    totalSaveActions++;
    if (typeof window.incrementarGuardadosRating === "function") {
      window.incrementarGuardadosRating();
    }
    if (!isPro && totalSaveActions % 4 === 0) {
      setTimeout(() => { verificarUpsellPro(); }, 800);
    }
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
     17. Control de Ventana (Tauri V2)
     ========================================================================== */

  const closeBtn = document.querySelector("#close");
  const minBtn   = document.querySelector("#min");
  const maxBtn   = document.querySelector("#max");
  const unmaxBtn = document.querySelector("#unmax");

  async function sincronizarBotonesMaximizar() {
    if (!ventana) return;
    const esMaximizado = await ventana.isMaximized();
    actualizarBotonesMaximizar(esMaximizado);
  }

  function actualizarBotonesMaximizar(esMaximizado) {
    if (maxBtn) maxBtn.style.display   = esMaximizado ? "none"  : "block";
    if (unmaxBtn) unmaxBtn.style.display = esMaximizado ? "block" : "none";
  }

  async function ejecutarCierreDeVentana() {
    if (comprobarCambios()) {
      const respuesta = invoke ? await invoke("dialogo_sin_guardar") : 1;
      if (respuesta === 0) {
        await ejecutarGuardadoCompleto();
        if (!comprobarCambios() && ventana) await ventana.destroy();
      } else if (respuesta === 1) {
        if (ventana) await ventana.destroy();
      }
    } else {
      if (ventana) await ventana.destroy();
    }
  }

  closeBtn?.addEventListener("click", () => ejecutarCierreDeVentana());
  minBtn?.addEventListener("click", () => ventana?.minimize());
  maxBtn?.addEventListener("click", async () => {
    await ventana?.maximize();
    await sincronizarBotonesMaximizar();
  });
  unmaxBtn?.addEventListener("click", async () => {
    await ventana?.unmaximize();
    await sincronizarBotonesMaximizar();
  });

  sincronizarBotonesMaximizar();

  /* ==========================================================================
     18. Flujos de Negocio Reutilizables
     ========================================================================== */

  async function ejecutarGuardadoCompleto() {
    const ruta = obtenerRuta();
    if (!ruta) await guardarArchivoComo();
    else await guardarComo(ruta);
  }

  async function ejecutarAperturaCompleta() {
    if (estaDeshabilitadoEditor()) habilitarEditor();
    if (!invoke) return;
    const archivo = await invoke("abrir_archivo");
    if (archivo) {
      guardarRuta(archivo.ruta, archivo.nombre);
      setEstadoModificado(false);
      editor.value = archivo.contenido;
      await convertMarkdown(archivo.contenido);
      showToast(`Archivo abierto: ${archivo.nombre}`, "info");
    }
  }

  function ejecutarNuevoCompleto() {
    pantallaDeInicio();
    habilitarEditor();
    resetRuta();
    showToast("Nuevo documento creado", "info");
  }

  function ejecutarCierreCompleto() {
    pantallaDeInicio();
    deshabilitarEditor();
    resetRuta();
  }

  /* ==========================================================================
     19. Atajos de Teclado Globales
     ========================================================================== */

  window.addEventListener("keydown", async (e) => {
    if (isSlideshowActive) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        slideSiguiente();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        slideAnterior();
      } else if (e.key === "Escape") {
        e.preventDefault();
        salirSlideshow();
      }
      return;
    }

    if (document.body.classList.contains("editor-app--zen") && e.key === "Escape") {
      salirModoZen();
      return;
    }

    // Atajo Secreto Master Developer: Ctrl + Shift + Alt + D (o K)
    if (e.ctrlKey && e.shiftKey && e.altKey && (e.key.toLowerCase() === "d" || e.key.toLowerCase() === "k")) {
      e.preventDefault();
      abrirModalDev();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();

      if (!e.shiftKey && key === "s") {
        e.preventDefault();
        if (!estaDeshabilitadoEditor()) await ejecutarGuardadoCompleto();
      } else if (e.shiftKey && key === "s") {
        e.preventDefault();
        if (!estaDeshabilitadoEditor()) await guardarArchivoComo();
      } else if (key === "o") {
        e.preventDefault();
        await ejecutarAperturaCompleta();
      } else if (key === "n") {
        e.preventDefault();
        ejecutarNuevoCompleto();
      } else if (key === "f") {
        e.preventDefault();
        abrirBuscador(false);
      } else if (key === "h") {
        e.preventDefault();
        abrirBuscador(true);
      } else if (key === "b") {
        e.preventDefault();
        wrapSelection("**", "**", "texto en negrita");
      } else if (key === "i") {
        e.preventDefault();
        wrapSelection("*", "*", "texto en cursiva");
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setFontSize(currentFontSize + 1);
      } else if (e.key === "-") {
        e.preventDefault();
        setFontSize(currentFontSize - 1);
      } else if (e.key === "0") {
        e.preventDefault();
        setFontSize(14);
      }
    }

    if (e.key === "Escape") {
      if (findReplacePanel && findReplacePanel.style.display !== "none") cerrarBuscador();
      if (templatesModal && templatesModal.style.display !== "none") templatesModal.style.display = "none";
      if (themeModal && themeModal.style.display !== "none") themeModal.style.display = "none";
      if (proModal && proModal.style.display !== "none") cerrarModalPro();
      if (secretDevModal && secretDevModal.style.display !== "none") cerrarModalDev();
    }
  });

  // Drag & Drop
  window.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); });
  window.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); });

  if (ventana?.onDragDropEvent) {
    ventana.onDragDropEvent(async (event) => {
      if (event.payload.type === 'drop') {
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          const rutaFile = paths[0];
          if (rutaFile.split(".").pop().toLowerCase() === "md") {
            if (estaDeshabilitadoEditor()) habilitarEditor();
            await cargarArchivoAbierto(rutaFile);
            showToast(`Archivo cargado: ${rutaFile.split(/[\\/]/).pop()}`, "info");
          } else {
            if (invoke) {
              await invoke("mostrar_error", {
                titulo: "Archivo no soportado",
                mensaje: "Por favor, arrastrá únicamente archivos con extensión .md, che."
              });
            }
          }
        }
      }
    });
  }

  if (ventana?.onCloseRequested) {
    ventana.onCloseRequested(async (event) => {
      event.preventDefault();
      await ejecutarCierreDeVentana();
    });
  }

  if (ventana?.onResized) {
    ventana.onResized(async () => {
      await sincronizarBotonesMaximizar();
    });
  }

  // ============================================================
  // Modal de Votación (Store)
  // ============================================================
  const storeModal = document.getElementById("store-rating-modal");
  const btnVote = document.getElementById("store-modal-vote");
  const btnCloseModal = document.getElementById("store-modal-close");
  let hasVoted = window.localStorage.getItem("hasVoted") === "true";
  let saveCount = parseInt(window.localStorage.getItem("saveCount") || "0", 10);

  window.incrementarGuardadosRating = function() {
    if (hasVoted) return;
    saveCount++;
    window.localStorage.setItem("saveCount", saveCount.toString());
    if (saveCount % 3 === 0) {
      if (!proModal || proModal.style.display === "none") {
        storeModal.style.display = "flex";
      }
    }
  };

  if (btnVote) {
    btnVote.addEventListener("click", async () => {
      hasVoted = true;
      window.localStorage.setItem("hasVoted", "true");
      storeModal.style.display = "none";
      try {
        if (invoke) {
          await invoke("plugin:shell|open", { path: "ms-windows-store://review/?ProductId=9PC8MCBSJ2HJ" });
        }
      } catch (err) {
        console.error("Error al abrir la store: ", err);
      }
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
      storeModal.style.display = "none";
      saveCount = 0;
      window.localStorage.setItem("saveCount", "0");
    });
  }

  // ============================================================
  // Arranque Inicial
  // ============================================================
  await iniciarPrograma();

}); // Fin DOMContentLoaded
