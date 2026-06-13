/// Módulo de comandos de E/S de archivos.
/// Expone operaciones de lectura, escritura y exportación del sistema de archivos
/// al frontend a través de la API IPC de Tauri V2.
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

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

/// Genera la plantilla HTML5 completa con estilos embebidos del tema oscuro premium.
/// Equivalente al template literal de `file:export-html` en el Electron original.
///
/// # Parámetros
/// * `html_content` - Contenido HTML del cuerpo a incrustar.
fn generar_plantilla_html(html_content: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exportación de Markdown - Editor Premium</title>
  <style>
    :root {{
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --accent-color: #3b82f6;
      --border-color: #334155;
      --font-main: 'Inter', system-ui, -apple-system, sans-serif;
      --mono-font: 'Fira Code', 'Consolas', monospace;
    }}
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-main);
      line-height: 1.7;
      padding: 40px 24px;
      max-width: 900px;
      margin: 0 auto;
    }}
    h1, h2, h3, h4, h5, h6 {{
      color: var(--text-primary);
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.2;
    }}
    h1 {{ font-size: 2.3em; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }}
    h2 {{ font-size: 1.8em; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }}
    h3 {{ font-size: 1.40em; }}
    p {{ margin-bottom: 1em; color: var(--text-secondary); }}
    a {{ color: var(--accent-color); text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    code {{
      background-color: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--mono-font);
      font-size: 0.9em;
      color: #fbbf24;
    }}
    pre {{
      background-color: var(--bg-secondary);
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 1em;
      border: 1px solid var(--border-color);
      position: relative;
    }}
    pre code {{ background-color: transparent; color: var(--text-primary); padding: 0; }}
    blockquote {{
      border-left: 4px solid var(--accent-color);
      margin: 1em 0;
      padding: 10px 15px;
      color: var(--text-secondary);
      background-color: rgba(59, 130, 246, 0.1);
      border-radius: 0 4px 4px 0;
    }}
    img {{ max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }}
    table {{ width: 100%; border-collapse: collapse; margin: 1em 0; }}
    th, td {{ border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; }}
    th {{ background-color: var(--bg-secondary); font-weight: 600; }}
    hr {{ border: 0; height: 1px; background: var(--border-color); margin: 2em 0; }}
    mark {{
      background-color: rgba(245, 158, 11, 0.3);
      color: #fef08a;
      padding: 2px 4px;
      border-radius: 4px;
      font-weight: 500;
    }}
    details {{
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 1em;
      padding: 12px 16px;
    }}
    summary {{
      font-weight: 600;
      cursor: pointer;
      outline: none;
      user-select: none;
      color: var(--text-primary);
    }}
    .editor-alert {{
      margin: 1.5em 0;
      padding: 15px;
      border-left: 4px solid var(--accent-color);
      border-radius: 0 8px 8px 0;
      background-color: rgba(59, 130, 246, 0.05);
    }}
    .editor-alert__header {{
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 0.9rem;
    }}
    .editor-alert__title {{ text-transform: uppercase; letter-spacing: 0.05em; }}
    .editor-alert__content {{ font-size: 0.95rem; color: var(--text-secondary); }}
    .editor-alert__content p:last-child {{ margin-bottom: 0; }}
    .editor-alert--note {{ border-left-color: #3b82f6; background-color: rgba(59, 130, 246, 0.08); }}
    .editor-alert--note .editor-alert__header {{ color: #3b82f6; }}
    .editor-alert--warning {{ border-left-color: #fbbf24; background-color: rgba(251, 191, 36, 0.08); }}
    .editor-alert--warning .editor-alert__header {{ color: #fbbf24; }}
    .editor-alert--tip {{ border-left-color: #22c55e; background-color: rgba(34, 197, 94, 0.08); }}
    .editor-alert--tip .editor-alert__header {{ color: #22c55e; }}
    .editor-alert--important {{ border-left-color: #a855f7; background-color: rgba(168, 85, 247, 0.08); }}
    .editor-alert--important .editor-alert__header {{ color: #a855f7; }}
    .editor-alert--caution {{ border-left-color: #ef4444; background-color: rgba(239, 68, 68, 0.08); }}
    .editor-alert--caution .editor-alert__header {{ color: #ef4444; }}
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
</head>
<body>
  {}
</body>
</html>"#,
        html_content
    )
}
