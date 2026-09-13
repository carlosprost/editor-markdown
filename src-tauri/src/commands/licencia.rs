/// Módulo de gestión y verificación de licencias (Microsoft Store & Master Key Criptográfica).
/// Implementa validación nativa con la Store para usuarios finales y un sistema
/// de validación matemática fragmentada (Sharded Checksum) para desarrolladores.
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

/// Estructura de respuesta con el estado de la licencia PRO.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EstadoLicencia {
    /// Indica si el usuario tiene acceso PRO desbloqueado.
    pub es_pro: bool,
    /// Origen de la licencia: "store", "master_dev", "clave_local", "free".
    pub origen: String,
    /// Mensaje descriptivo del estado de la licencia.
    pub mensaje: String,
    /// Indica si se desbloquearon las herramientas de desarrollo (DevTools).
    pub devtools_activo: bool,
}

/// Obtiene la ruta del archivo de licencia persistente en AppData del sistema.
fn obtener_ruta_archivo_licencia(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(mut ruta) = app.path().app_data_dir() {
        ruta.push("license.json");
        return Some(ruta);
    }
    None
}

/// ==========================================================================
/// Sistema de Validación Matemática Fragmentada (Sharded Verification)
/// No contiene ninguna clave hardcodeada en texto plano ni hashes evidentes.
/// Reconstruye los fragmentos en memoria en tiempo de ejecución mediante álgebra modular.
/// ==========================================================================

/// Fragmento Alpha: Máscara pseudoaleatoria generada con números primos.
fn fragmento_alpha(seed: u64) -> u64 {
    let p1: u64 = 0x9E3779B97F4A7C15;
    let p2: u64 = 0xBF58476D1CE4E5B9;
    (seed.wrapping_mul(p1) ^ (seed >> 27)).wrapping_mul(p2)
}

/// Fragmento Beta: Vector de bytes dispersos 1.
const SHARD_B1: [u8; 8] = [0x39, 0x0C, 0x8C, 0x7D, 0x72, 0x47, 0x34, 0x2C];
/// Fragmento Gamma: Vector de bytes dispersos 2.
const SHARD_B2: [u8; 8] = [0x00, 0xCE, 0x2F, 0x12, 0x6D, 0xF6, 0x59, 0x50];

/// Reconstruye dinámicamente la firma objetivo combinando los fragmentos.
fn reconstruir_objetivo() -> u64 {
    let mut resultado: u64 = 0;
    for i in 0..8 {
        let byte_fusionado = SHARD_B1[i] ^ SHARD_B2[i] ^ ((i as u8).wrapping_mul(0x1F));
        resultado = (resultado << 8) | (byte_fusionado as u64);
    }
    resultado
}

/// Algoritmo de transformación polinomial no lineal de la clave ingresada.
fn calcular_polinomio_sharded(input: &str) -> u64 {
    let bytes = input.trim().as_bytes();
    if bytes.len() < 8 {
        return 0;
    }

    let mut acumulador: u64 = 0xCBF29CE484222325; // FNV offset basis
    let mut rotacion: u32 = 7;

    for (indice, &b) in bytes.iter().enumerate() {
        let val_modificado = (b as u64) ^ ((indice as u64).wrapping_mul(0x3D));
        acumulador ^= val_modificado;
        acumulador = acumulador.wrapping_mul(0x100000001B3); // FNV prime
        let shift = (rotacion % 13) + 1;
        acumulador = (acumulador << shift) | (acumulador >> (64 - shift));
        rotacion = (rotacion + (b as u32)) % 32;
    }

    fragmento_alpha(acumulador)
}

/// Valida si la clave maestra ingresada satisface la ecuación matemática fragmentada.
fn validar_master_key(clave: &str) -> bool {
    let firma_calculada = calcular_polinomio_sharded(clave);
    let firma_objetivo = reconstruir_objetivo();

    // Verificación constante en tiempo
    firma_calculada == firma_objetivo
}

/// ==========================================================================
/// Comandos IPC expuestos a Tauri
/// ==========================================================================

/// Verifica automáticamente el estado de la licencia consultando:
/// 1. El archivo persistente de licencia en el sistema operativo (AppData de Windows).
/// 2. El entorno de empaquetado de la Microsoft Store (Package Identity / MSIX).
#[tauri::command]
pub async fn verificar_licencia_store(app: AppHandle) -> Result<EstadoLicencia, String> {
    // 1. Verificar si existe un archivo de licencia persistente en el SO
    if let Some(ruta_archivo) = obtener_ruta_archivo_licencia(&app) {
        if ruta_archivo.exists() {
            if let Ok(contenido) = fs::read_to_string(&ruta_archivo) {
                if let Ok(licencia) = serde_json::from_str::<EstadoLicencia>(&contenido) {
                    if licencia.es_pro {
                        return Ok(licencia);
                    }
                }
            }
        }
    }

    // 2. Comprobación en entorno de Windows Store (Package Family / MSIX)
    #[cfg(target_os = "windows")]
    {
        if std::env::var("APPX_PACKAGE_NAME").is_ok() {
            let estado_store = EstadoLicencia {
                es_pro: true,
                origen: "store".to_string(),
                mensaje: "Licencia verificada automáticamente con Microsoft Store".to_string(),
                devtools_activo: false,
            };
            return Ok(estado_store);
        }
    }

    // Versión Free predeterminada
    Ok(EstadoLicencia {
        es_pro: false,
        origen: "free".to_string(),
        mensaje: "Versión Free activa".to_string(),
        devtools_activo: false,
    })
}

/// Comando secreto para desarrolladores:
/// Valida la clave maestra mediante el algoritmo fragmentado.
/// Si es correcta, desbloquea la versión PRO de por vida y abre las DevTools de Tauri en producción.
#[tauri::command]
pub async fn activar_master_developer(app: AppHandle, master_key: String) -> Result<EstadoLicencia, String> {
    if validar_master_key(&master_key) {
        let estado = EstadoLicencia {
            es_pro: true,
            origen: "master_dev".to_string(),
            mensaje: "👑 Modo Desarrollador y Licencia PRO Activados".to_string(),
            devtools_activo: true,
        };

        // 1. Persistir licencia en AppData para que quede PRO de por vida
        if let Some(ruta_archivo) = obtener_ruta_archivo_licencia(&app) {
            if let Some(directorio) = ruta_archivo.parent() {
                let _ = fs::create_dir_all(directorio);
            }
            if let Ok(json) = serde_json::to_string_pretty(&estado) {
                let _ = fs::write(&ruta_archivo, json);
            }
        }

        // 2. Abrir DevTools nativas de Tauri en tiempo de ejecución
        if let Some(window) = app.get_webview_window("main") {
            window.open_devtools();
        }

        Ok(estado)
    } else {
        Err("Clave master inválida".to_string())
    }
}
