/// Biblioteca de la aplicación.
/// Expone el punto de entrada `run()` para ser llamado desde `main.rs`.
/// Permite que Tauri compile el backend como librería reutilizable.
mod commands;

use commands::archivos::{abrir_archivo, exportar_html, guardar_archivo, guardar_como, leer_archivo};
use commands::dialogos::{dialogo_sin_guardar, mostrar_error};
use commands::markdown::parsear_markdown;

/// Punto de entrada de la librería de la app.
/// Registra todos los plugins y comandos disponibles en la interfaz IPC de Tauri V2.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugins oficiales de Tauri V2
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        // Registro de todos los comandos del backend (equivalente a los ipcMain.handle de Electron)
        .invoke_handler(tauri::generate_handler![
            // Comandos de archivos
            abrir_archivo,
            leer_archivo,
            guardar_archivo,
            guardar_como,
            exportar_html,
            // Comandos de Markdown
            parsear_markdown,
            // Comandos de diálogos
            dialogo_sin_guardar,
            mostrar_error,
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar la aplicación Editor Markdown");
}
