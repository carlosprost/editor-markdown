/// Módulo de exportación nativa a PDF utilizando el motor Microsoft Edge WebView2.
/// Genera documentos PDF vectoriales reales de cualquier longitud (1 a 100+ páginas),
/// con texto seleccionable, imágenes nítidas y soporte completo de @media print y @page.
#[cfg(target_os = "windows")]
use std::sync::mpsc;
#[cfg(target_os = "windows")]
use tauri::{AppHandle, Manager};
#[cfg(target_os = "windows")]
use tauri_plugin_dialog::DialogExt;
#[cfg(target_os = "windows")]
use webview2_com::Microsoft::Web::WebView2::Win32::*;
#[cfg(target_os = "windows")]
use webview2_com::PrintToPdfCompletedHandler;
#[cfg(target_os = "windows")]
use windows::core::{Interface, PCWSTR};

/// Exporta la vista actual a un archivo PDF vectorial nativo usando WebView2.
/// Despliega el diálogo de guardado de Windows y ejecuta PrintToPdf sin abrir impresoras.
///
/// # Parámetros
/// * `app` - Manejador de la aplicación Tauri.
/// * `nombre_sugerido` - Nombre sugerido opcional para el archivo PDF.
#[tauri::command]
pub async fn exportar_pdf_nativo(
    app: AppHandle,
    nombre_sugerido: Option<String>,
) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
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

        // Diálogo nativo de guardado
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

        let ruta_str = ruta_path.to_string();

        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "No se encontró la ventana principal".to_string())?;

        let (tx, rx) = mpsc::channel::<Result<bool, String>>();

        let ruta_str_clon = ruta_str.clone();

        window
            .with_webview(move |webview| {
                unsafe {
                    let controller = webview.controller();
                    let core_wv = match controller.CoreWebView2() {
                        Ok(cw) => cw,
                        Err(e) => {
                            let _ = tx.send(Err(format!("Error al obtener CoreWebView2: {:?}", e)));
                            return;
                        }
                    };

                    let wv7 = match core_wv.cast::<ICoreWebView2_7>() {
                        Ok(w) => w,
                        Err(e) => {
                            let _ = tx.send(Err(format!("ICoreWebView2_7 no soportado: {:?}", e)));
                            return;
                        }
                    };

                    // Convertimos la ruta UTF-8 a UTF-16 con terminador nulo para Windows PCWSTR
                    let mut wide_chars: Vec<u16> = ruta_str_clon.encode_utf16().collect();
                    wide_chars.push(0);
                    let pcwstr = PCWSTR::from_raw(wide_chars.as_ptr());

                    let tx_callback = tx.clone();
                    let handler = PrintToPdfCompletedHandler::create(Box::new(
                        move |res: windows::core::Result<()>, exito: bool| {
                            match res {
                                Ok(()) => {
                                    let _ = tx_callback.send(Ok(exito));
                                }
                                Err(e) => {
                                    let _ = tx_callback
                                        .send(Err(format!("Error en PrintToPdf: {:?}", e)));
                                }
                            }
                            Ok(())
                        },
                    ));

                    if let Err(e) = wv7.PrintToPdf(pcwstr, None, &handler) {
                        let _ = tx.send(Err(format!("Fallo al invocar PrintToPdf: {:?}", e)));
                    }
                }
            })
            .map_err(|e| format!("Fallo al acceder al webview: {:?}", e))?;

        // Esperamos el resultado del callback asíncrono
        let resultado = rx
            .recv()
            .map_err(|e| format!("Error esperando resultado de PDF: {:?}", e))??;

        Ok(resultado)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Exportación nativa WebView2 solo disponible en Windows".to_string())
    }
}
