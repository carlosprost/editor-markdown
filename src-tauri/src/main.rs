// Previene la apertura de una consola de Windows en modo release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Punto de entrada principal de la aplicación de escritorio.
/// Delega toda la inicialización a `lib.rs` para mantener el código modular.
fn main() {
    editor_markdown_lib::run();
}
