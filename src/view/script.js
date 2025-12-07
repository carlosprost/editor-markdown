const marked = require("marked");
const { ipcRenderer } = require("electron");
const fs = require("fs");
const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
let titulo = document.querySelector("#titulo");
let pre_code = document.querySelectorAll("code");

iniciarPrograma();
function iniciarPrograma() {
  let ruta = obtenerRuta();

  if (ruta == null || ruta == "" || ruta == undefined) {
    pantallaDeInicio();
    deshabilitarEditor();
  } else {
    habilitarEditor();
    cargarArchivoAbierto(obtenerRuta());
  }
}

editor.addEventListener("keyup", (e) => {
  if (!comprobarCambios()) {
    titulo.innerHTML += "*";
  }
  convertMarkdown(e.target.value);
});

function comprobarCambios() {
  return titulo.innerHTML.includes("*");
}

function convertMarkdown(text) {
  // Run marked
  preview.innerHTML = marked.parse(text);
}

/* comandos */
const newFile = document.querySelector("#new");
const openFile = document.querySelector("#open");
const saveFile = document.querySelector("#save");
const saveAsFile = document.querySelector("#save-as");
const closeFile = document.querySelector("#close-file");

newFile.addEventListener("click", () => {
  pantallaDeInicio();
  habilitarEditor();
  resetRuta();
});

closeFile.addEventListener("click", () => {
  pantallaDeInicio();
  deshabilitarEditor();
  resetRuta();
});

openFile.addEventListener("click", () => {
  if (estaDeshabilitadoEditor()) habilitarEditor();
  let ruta = ipcRenderer.sendSync("open-file");
  rutaArchivo(ruta);
  cargarArchivoAbierto(obtenerRuta());
});

saveFile.addEventListener("click", () => {
  let ruta = obtenerRuta();
  if (ruta == null || ruta == "" || ruta == undefined) {
    guardarArchivoComo();
  } else {
    guardarComo(ruta);
  }

  if (comprobarCambios()) {
    titulo.innerHTML = obtenerFileName();
  }
});

saveAsFile.addEventListener("click", () => {
  guardarArchivoComo();

  if (comprobarCambios()) {
    titulo.innerHTML = obtenerFileName();
  }
});

function pantallaDeInicio() {
  editor.value = "";
  preview.innerHTML = "";
  titulo.innerHTML = "Archivo sin nombre";
}

function habilitarEditor() {
  editor.style.display = "block";
}

function deshabilitarEditor() {
  editor.style.display = "none";
}

function estaDeshabilitadoEditor() {
  return editor.style.display == "none";
}

function guardarArchivoComo() {
  let ruta = ipcRenderer.sendSync("save-as-file");
  rutaArchivo(ruta);
  guardarComo(ruta);
}

function cargarArchivoAbierto(ruta) {
  if (!ruta) return;
  let contenido = fs.readFileSync(ruta, "utf-8");

  titulo.innerHTML = obtenerFileName();
  editor.value = contenido;
  convertMarkdown(contenido);
}

function guardarComo(ruta) {
  if (!ruta) return;
  fs.writeFileSync(ruta, editor.value);
  cargarArchivoAbierto(ruta);
}

function rutaArchivo(ruta) {
  if (!ruta) return;
  window.localStorage.setItem("ruta", ruta);
  window.localStorage.setItem(
    "fileName",
    ruta.split("\\").pop().split("/").pop()
  );
}

function resetRuta() {
  window.localStorage.setItem("ruta", "");
  window.localStorage.setItem("fileName", "");
}

function obtenerRuta() {
  return window.localStorage.getItem("ruta");
}

function obtenerFileName() {
  return window.localStorage.getItem("fileName");
}



/* Función de la ventana */
const close = document.querySelector("#close");
const min = document.querySelector("#min");
const max = document.querySelector("#max");
const unmax = document.querySelector("#unmax");

btnMaxOUnmax();

close.addEventListener("click", () => {
  ipcRenderer.send("close-window");
});

min.addEventListener("click", () => {
  ipcRenderer.send("min-window");
});

max.addEventListener("click", () => {
  ipcRenderer.send("max-window");
  btnMaxOUnmax();
});

unmax.addEventListener("click", () => {
  ipcRenderer.send("unmax-window");
  btnMaxOUnmax();
});

function btnMaxOUnmax() {
  if (isMaximized()) {
    max.style.display = "none";
    unmax.style.display = "block";
  } else {
    max.style.display = "block";
    unmax.style.display = "none";
  }
}

function isMaximized() {
  return ipcRenderer.sendSync("is-max");
}
