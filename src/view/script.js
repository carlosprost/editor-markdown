const marked = require("marked");
const { ipcRenderer } = require("electron");
const fs = require("fs");
const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
let titulo = document.querySelector("#titulo");

editor.addEventListener("keyup", (e) => {
  convertMarkdown(e.target.value);
});

function convertMarkdown(text) {
  preview.innerHTML = marked.parse(text, {
    sanitize: true,
  });
}

/* comandos */
const newFile = document.querySelector("#new");
const openFile = document.querySelector("#open");
const saveFile = document.querySelector("#save");
const saveAsFile = document.querySelector("#save-as");

newFile.addEventListener("click", () => {
  editor.value = "";
  preview.innerHTML = "";
  titulo.innerHTML = "Archivo sin nombre";
});

openFile.addEventListener("click", () => {
  let ruta = ipcRenderer.sendSync("open-file");
  rutaArchivo(ruta);
  cargarArchivoAbierto(obtenerRuta());
});

saveFile.addEventListener("click", (e) => {
  e.preventDefault();
  guardarComo(obtenerRuta());
});

saveAsFile.addEventListener("click", () => {
  let ruta = ipcRenderer.sendSync("save-as-file");
  rutaArchivo(ruta);
  guardarComo(obtenerRuta());
});

function cargarArchivoAbierto(ruta) {
  let contenido = fs.readFileSync(ruta, "utf-8");

  titulo.innerHTML = obtenerFileName();
  editor.value = contenido;
  convertMarkdown(contenido);
}

function guardarComo(ruta) {
  fs.writeFileSync(ruta, editor.value);
  cargarArchivoAbierto(ruta);
}

function rutaArchivo(ruta) {
  window.localStorage.setItem("ruta", ruta);
  window.localStorage.setItem(
    "fileName",
    ruta.split("\\").pop().split("/").pop()
  );
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
