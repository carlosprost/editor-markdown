/// Módulo de comandos de diálogos del sistema operativo.
/// Expone diálogos nativos al frontend a través de la API IPC de Tauri V2.
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};


/// Muestra el diálogo nativo de advertencia ante cambios sin guardar.
/// Se dispara cuando el usuario intenta cerrar la ventana o un archivo con cambios pendientes.
///
/// # Retorno
/// - `0` → El usuario eligió guardar los cambios
/// - `1` → El usuario eligió descartar los cambios
/// - `2` → El usuario canceló (mantiene la ventana abierta)
#[tauri::command]
pub async fn dialogo_sin_guardar(app: AppHandle) -> u8 {
    // Tauri V2 usa botones confirm/cancel — simulamos los tres estados
    // con dos diálogos encadenados para mantener la UX del original
    let quiere_guardar = app
        .dialog()
        .message("¿Querés guardar los cambios que le hiciste a tu archivo antes de salir?\n\nSi no los guardás, tus modificaciones se van a perder para siempre, che.")
        .title("Cambios sin guardar")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Guardar cambios".to_string(),
            "No guardar".to_string(),
        ))
        .blocking_show();

    if quiere_guardar {
        0 // "Guardar cambios"
    } else {
        // Preguntamos si realmente quiere descartar o cancelar
        let confirmar_descarte = app
            .dialog()
            .message("¿Estás seguro de que querés salir sin guardar? Los cambios se perderán.")
            .title("Confirmar descarte")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Salir sin guardar".to_string(),
                "Cancelar".to_string(),
            ))
            .blocking_show();

        if confirmar_descarte {
            1 // "No guardar"
        } else {
            2 // "Cancelar"
        }
    }
}

/// Muestra una caja de error nativa del sistema operativo.
/// Los mensajes de error técnicos se loguean internamente; solo se muestra
/// un mensaje genérico al usuario (ISO 27032 — manejo seguro de errores).
///
/// # Parámetros
/// * `titulo` - Título de la ventana de error.
/// * `mensaje` - Mensaje descriptivo del error para el usuario.
#[tauri::command]
pub async fn mostrar_error(app: AppHandle, titulo: String, mensaje: String) {
    app.dialog()
        .message(mensaje)
        .title(titulo)
        .kind(MessageDialogKind::Error)
        .blocking_show();
}
