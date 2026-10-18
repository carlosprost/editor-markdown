/// Módulo de gestión y resolución de imágenes locales para Markdown.
/// Resuelve rutas relativas y absolutas incrustándolas como Data URLs en Base64
/// para visualización en WebView2 sin violar el CSP y garantizando exportación fiel a PDF y HTML.
use base64::prelude::*;
use regex::Regex;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Expresión regular estática compilada una sola vez para capturar la etiqueta <img> y su atributo src.
static RE_IMG: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?is)(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'][^>]*?>)"#).unwrap()
});

/// Información de una imagen seleccionada mediante el diálogo nativo.
#[derive(Serialize)]
pub struct ImagenSeleccionada {
    /// Ruta absoluta del archivo en el sistema de archivos.
    pub ruta_absoluta: String,
    /// Ruta relativa formateada con respecto al documento actual (ej: `./img/foto.png`).
    pub ruta_relativa: String,
    /// Nombre del archivo con extensión.
    pub nombre: String,
}

/// Abre el diálogo nativo del sistema para seleccionar una imagen.
/// Calcula la ruta relativa si se proporciona la ruta del documento actual.
///
/// # Parámetros
/// * `app` - Manejador de Tauri.
/// * `ruta_documento` - Ruta absoluta del archivo Markdown abierto actualmente.
#[tauri::command]
pub async fn seleccionar_imagen(
    app: AppHandle,
    ruta_documento: Option<String>,
) -> Result<Option<ImagenSeleccionada>, String> {
    let archivo_opt = app
        .dialog()
        .file()
        .add_filter(
            "Imágenes (*.png, *.jpg, *.jpeg, *.webp, *.gif, *.svg, *.bmp)",
            &["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"],
        )
        .blocking_pick_file();

    let archivo_path = match archivo_opt {
        Some(p) => p,
        None => return Ok(None),
    };

    let path_buf = match archivo_path.into_path() {
        Ok(p) => p,
        Err(fp) => PathBuf::from(fp.to_string()),
    };

    let ruta_abs_str = path_buf.to_string_lossy().to_string();

    let nombre = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("imagen.png")
        .to_string();

    let ruta_relativa = if let Some(ref doc_str) = ruta_documento {
        calcular_ruta_relativa(doc_str, &ruta_abs_str)
    } else {
        ruta_abs_str.replace('\\', "/")
    };

    Ok(Some(ImagenSeleccionada {
        ruta_absoluta: ruta_abs_str,
        ruta_relativa,
        nombre,
    }))
}

/// Calcula la ruta relativa de una imagen respecto a la carpeta del documento Markdown.
fn calcular_ruta_relativa(doc_path: &str, img_path: &str) -> String {
    let doc = Path::new(doc_path);
    let base_dir = if doc.is_dir() {
        doc
    } else {
        doc.parent().unwrap_or(doc)
    };

    let img = Path::new(img_path);

    if let Ok(rel) = img.strip_prefix(base_dir) {
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        format!("./{}", rel_str)
    } else {
        img_path.replace('\\', "/")
    }
}

/// Determina el tipo MIME de una imagen según su extensión de archivo.
fn obtener_tipo_mime(extension: &str) -> Option<&'static str> {
    match extension.to_lowercase().as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        "svg" => Some("image/svg+xml"),
        "bmp" => Some("image/bmp"),
        "ico" => Some("image/x-icon"),
        _ => None,
    }
}

/// Resuelve una ruta de imagen (relativa o absoluta) a una ruta existente en disco.
fn resolver_ruta_disco(src: &str, ruta_base: Option<&str>) -> Option<PathBuf> {
    // Si es data: o http(s):// no es un archivo local en disco
    if src.starts_with("data:") || src.starts_with("http://") || src.starts_with("https://") {
        return None;
    }

    // Normalizar si viene con file:///
    let limpio = src.strip_prefix("file:///").unwrap_or(src);
    let limpio = limpio.strip_prefix("file://").unwrap_or(limpio);
    let path_directo = Path::new(limpio);

    // 1. Si es ruta absoluta y existe
    if path_directo.is_absolute() && path_directo.is_file() {
        return Some(path_directo.to_path_buf());
    }

    // 2. Si hay ruta base del documento, buscar relativa a su carpeta
    if let Some(base_str) = ruta_base {
        if !base_str.is_empty() {
            let doc_path = Path::new(base_str);
            let dir = if doc_path.is_dir() {
                doc_path
            } else {
                doc_path.parent().unwrap_or(doc_path)
            };

            let combinada = dir.join(limpio);
            if combinada.is_file() {
                return Some(combinada);
            }
        }
    }

    // 3. Intento directo como relativa al directorio actual de ejecución
    if path_directo.is_file() {
        return Some(path_directo.to_path_buf());
    }

    None
}

/// Procesa el HTML renderizado sustituyendo las rutas de imágenes locales existentes
/// por Data URLs Base64 (`data:image/...;base64,...`).
///
/// # Parámetros
/// * `html` - Código HTML parseado del documento.
/// * `ruta_base` - Ruta absoluta del archivo Markdown actual para resolver rutas relativas.
pub fn incrustar_imagenes_locales(html: &str, ruta_base: Option<&str>) -> String {
    RE_IMG
        .replace_all(html, |caps: &regex::Captures| {
            let pre = &caps[1];
            let src = &caps[2];
            let post = &caps[3];

            if let Some(path_disco) = resolver_ruta_disco(src, ruta_base) {
                let extension = path_disco
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .unwrap_or("");

                if let Some(mime) = obtener_tipo_mime(extension) {
                    // Límite de seguridad: 30 MB por imagen para evitar consumo desmedido de RAM
                    if let Ok(metadata) = std::fs::metadata(&path_disco) {
                        if metadata.len() <= 30 * 1024 * 1024 {
                            if let Ok(bytes) = std::fs::read(&path_disco) {
                                let b64 = BASE64_STANDARD.encode(&bytes);
                                let data_url = format!("data:{};base64,{}", mime, b64);
                                return format!("{}{}{}", pre, data_url, post);
                            }
                        }
                    }
                }
            }

            // Si no se pudo resolver o es remota, mantener la original
            format!("{}{}{}", pre, src, post)
        })
        .to_string()
}
