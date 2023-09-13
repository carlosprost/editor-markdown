const { BrowserWindow } = require("electron");
const path = require("path");
let win = null;
function createWindow() {
  win = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: 800,
    height: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.join(__dirname, "src/view/index.html"));
}

function closeWindow() {
  win.close();
}

function minizarWindow() {
  win.minimize();
}

function maximizarWindow() {
  win.maximize();
}

function unmaximizarWindow() {
  win.unmaximize();
}

function isMaximized() {
  return win.isMaximized();
}

module.exports = {
  createWindow,
  closeWindow,
  minizarWindow,
  maximizarWindow,
  unmaximizarWindow,
  isMaximized,
};
