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
require("electron-reload")(__dirname, {
  electron: path.join(__dirname, "node_modules", ".bin", "electron"),
  hardResetMethod: "exit",
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
  app.quit();
});

ipcMain.on("open-file", (e) => {
  let ruta = dialog.showOpenDialogSync({
    defaultPath: path.join(__dirname, "assets/files/"),
  });
  console.log(ruta[0]);
  e.returnValue = ruta[0];
});

ipcMain.on("save-as-file", (e) => {
  let ruta = dialog.showSaveDialogSync({
    defaultPath: path.join(__dirname, "assets/files/"),
    filters: [
      {
        name: "Markdown Files",
        extensions: ["md"],
      },
    ],
  });
  console.log(ruta);
  e.returnValue = ruta;
});

ipcMain.on("save-file", (e, ruta) => {
  console.log(ruta);
  e.returnValue = ruta;
});

/* Control de ventana */

ipcMain.on("close-window", () => {
  closeWindow();
});

ipcMain.on("min-window", () => {
  minizarWindow();
});

ipcMain.on("max-window", () => {
  maximizarWindow();
});

ipcMain.on("unmax-window", () => {
  unmaximizarWindow();
});

ipcMain.on("is-max", (e) => {
  e.returnValue = isMaximized();
});
