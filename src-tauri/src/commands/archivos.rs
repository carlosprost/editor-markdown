/// Módulo de comandos de E/S de archivos.
/// Expone operaciones de lectura, escritura y exportación del sistema de archivos
/// al frontend a través de la API IPC de Tauri V2.
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use super::plantillas::generar_plantilla_html;

/// Estructura de respuesta para operaciones de apertura de archivo.
/// Serializable a JSON para ser consumida por el frontend.
#[derive(Serialize)]
pub struct ArchivoAbierto {
    /// Ruta absoluta del archivo en el sistema de archivos.
    pub ruta: String,
    /// Nombre del archivo con su extensión.
    pub nombre: String,
    /// Contenido de texto del archivo Markdown.
    pub contenido: String,
}

/// Estructura de respuesta para operaciones de "Guardar como".
#[derive(Serialize)]
pub struct ArchivoGuardado {
    /// Ruta absoluta del nuevo archivo guardado.
    pub ruta: String,
    /// Nombre del archivo con su extensión.
    pub nombre: String,
}

/// Abre un diálogo nativo para seleccionar un archivo Markdown (.md)
/// y retorna su ruta, nombre y contenido al frontend.
///
/// # Seguridad (OWASP A01)
/// Solo permite abrir archivos con extensión `.md`.
/// No expone rutas del sistema más allá de las seleccionadas por el usuario.
#[tauri::command]
pub async fn abrir_archivo(app: AppHandle) -> Result<Option<ArchivoAbierto>, String> {
    let ruta_opt = app
        .dialog()
        .file()
        .add_filter("Markdown Files", &["md"])
        .blocking_pick_file();

    let ruta_path = match ruta_opt {
        Some(p) => p,
        None => return Ok(None), // El usuario canceló el diálogo
    };

    let ruta_str = ruta_path.to_string();

    let contenido = std::fs::read_to_string(&ruta_str)
        .map_err(|e| format!("No se pudo leer el archivo: {}", e))?;

    let nombre = std::path::Path::new(&ruta_str)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("sin_nombre.md")
        .to_string();

    Ok(Some(ArchivoAbierto {
        ruta: ruta_str,
        nombre,
        contenido,
    }))
}

/// Obtiene el archivo Markdown pasado como argumento de línea de comandos al iniciar la aplicación.
/// Permite abrir archivos directamente al hacer doble clic o mediante "Abrir con..." en Windows.
///
/// # Seguridad (OWASP A01 / A03)
/// - Valida que la ruta provenga de un archivo existente en el sistema de archivos.
/// - Valida estrictamente que la extensión sea `.md` o `.markdown`.
/// - Sanitiza el manejo de rutas usando `std::path::Path`.
#[tauri::command]
pub async fn obtener_archivo_inicio() -> Result<Option<ArchivoAbierto>, String> {
    // Saltamos el primer argumento (ruta del ejecutable)
    for arg in std::env::args().skip(1) {
        // Ignoramos flags de línea de comandos (ej. flags de Tauri o Chromium)
        if arg.starts_with("--") || arg.starts_with("-") {
            continue;
        }

        let path = std::path::Path::new(&arg);
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ext_lower == "md" || ext_lower == "markdown" {
                    if let Ok(contenido) = std::fs::read_to_string(path) {
                        let nombre = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("archivo.md")
                            .to_string();

                        let ruta_str = path.to_string_lossy().to_string();

                        return Ok(Some(ArchivoAbierto {
                            ruta: ruta_str,
                            nombre,
                            contenido,
                        }));
                    }
                }
            }
        }
    }

    Ok(None)
}

/// Lee el contenido de un archivo Markdown dado su ruta absoluta.
/// Utilizado para restaurar la sesión previa del usuario al iniciar la app.
///
/// # Parámetros
/// * `ruta` - Ruta absoluta del archivo a leer.
#[tauri::command]
pub async fn leer_archivo(ruta: String) -> Result<Option<String>, String> {
    if ruta.is_empty() {
        return Ok(None);
    }

    match std::fs::read_to_string(&ruta) {
        Ok(contenido) => Ok(Some(contenido)),
        Err(_) => Ok(None), // Retorna None si el archivo fue movido o eliminado
    }
}

/// Guarda el contenido Markdown directamente en la ruta existente del archivo actual.
///
/// # Parámetros
/// * `ruta` - Ruta absoluta del archivo destino.
/// * `contenido` - Texto Markdown a escribir.
///
/// # Retorno
/// `true` si el guardado fue exitoso, `false` en caso de error.
#[tauri::command]
pub async fn guardar_archivo(ruta: String, contenido: String) -> Result<bool, String> {
    if ruta.is_empty() {
        return Ok(false);
    }

    std::fs::write(&ruta, contenido.as_bytes())
        .map(|_| true)
        .map_err(|e| format!("Error al guardar el archivo: {}", e))
}

/// Despliega el diálogo nativo de "Guardar como" y escribe el contenido en el nuevo archivo.
/// Retorna la ruta y nombre del archivo creado, o None si el usuario canceló.
///
/// # Parámetros
/// * `contenido` - Texto Markdown a guardar en el nuevo archivo.
#[tauri::command]
pub async fn guardar_como(
    app: AppHandle,
    contenido: String,
) -> Result<Option<ArchivoGuardado>, String> {
    let ruta_opt = app
        .dialog()
        .file()
        .set_file_name("NuevoArchivo.md")
        .add_filter("Markdown Files", &["md"])
        .blocking_save_file();

    let ruta_path = match ruta_opt {
        Some(p) => p,
        None => return Ok(None),
    };

    let ruta_str = ruta_path.to_string();

    std::fs::write(&ruta_str, contenido.as_bytes())
        .map_err(|e| format!("No se pudo guardar el archivo: {}", e))?;

    let nombre = std::path::Path::new(&ruta_str)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("NuevoArchivo.md")
        .to_string();

    Ok(Some(ArchivoGuardado {
        ruta: ruta_str,
        nombre,
    }))
}

/// Exporta el contenido HTML renderizado a un archivo .html con plantilla completa.
/// Incluye los estilos premium del tema oscuro de la app embebidos en el documento.
///
/// # Parámetros
/// * `html_content` - Marcado HTML parseado del editor para incrustar en la plantilla.
///
/// # Retorno
/// `true` si la exportación fue exitosa, `false` si se canceló o falló.
#[tauri::command]
pub async fn exportar_html(app: AppHandle, html_content: String) -> Result<bool, String> {
    let ruta_opt = app
        .dialog()
        .file()
        .set_file_name("exportado.html")
        .add_filter("HTML Files", &["html"])
        .blocking_save_file();

    let ruta_path = match ruta_opt {
        Some(p) => p,
        None => return Ok(false),
    };

    let html_completo = generar_plantilla_html(&html_content);

    std::fs::write(ruta_path.to_string(), html_completo.as_bytes())
        .map(|_| true)
        .map_err(|e| format!("Error al exportar HTML: {}", e))
}

/// Exporta el contenido PDF (bytes binarios) a un archivo .pdf mediante el diálogo nativo del sistema.
///
/// # Parámetros
/// * `app` - Manejador de la aplicación Tauri.
/// * `pdf_bytes` - Arreglo de bytes del documento PDF generado en frontend.
/// * `nombre_sugerido` - Nombre sugerido opcional para el archivo PDF.
///
/// # Retorno
/// `true` si el guardado fue exitoso, `false` si el usuario canceló el diálogo nativo.
#[tauri::command]
pub async fn exportar_pdf(
    app: AppHandle,
    pdf_bytes: Vec<u8>,
    nombre_sugerido: Option<String>,
) -> Result<bool, String> {
    if pdf_bytes.is_empty() {
        return Err("Los datos del PDF están vacíos".to_string());
    }

    let nombre_defecto = match nombre_sugerido {
        Some(nombre) if !nombre.trim().is_empty() => {
            let mut base = nombre.trim().to_string();
            if !base.to_lowercase().ends_with(".pdf") {
                base.push_str(".pdf");
            }
            base
        }
        _ => "documento.pdf".to_string(),
    };

    let ruta_opt = app
        .dialog()
        .file()
        .set_file_name(&nombre_defecto)
        .add_filter("Documento PDF (*.pdf)", &["pdf"])
        .blocking_save_file();

    let ruta_path = match ruta_opt {
        Some(p) => p,
        None => return Ok(false),
    };

    std::fs::write(ruta_path.to_string(), &pdf_bytes)
        .map(|_| true)
        .map_err(|e| format!("Error al guardar el archivo PDF: {}", e))
}
