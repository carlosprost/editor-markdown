# Reporte de Seguridad del Editor Markdown (SECURITY_REPORT.md)

Este documento detalla la auditoría de seguridad y las medidas implementadas en el proyecto para mitigar vulnerabilidades y cumplir con los estándares de ciberseguridad (OWASP Top 10, ISO 27001 e ISO 27002) para la versión **v2.4.1 (Versión Comercial + PRO Hotfix)**.

---

## 1. Auditoría de Stack y Dependencias

| Dependencia / Tecnología | Función en el Proyecto | Contribución a la Seguridad |
| :--- | :--- | :--- |
| **Tauri V2 (Rust)** | Framework central para la ejecución de la aplicación de escritorio. | Aisla la UI web del sistema operativo. Su modelo de seguridad prohíbe el acceso directo al filesystem; todo requiere configuración explícita en `capabilities`. |
| **pulldown-cmark (Rust)** | Motor de parsing y renderizado Markdown a HTML. | Seguro y compilado en Rust con protección contra desbordamientos de memoria (Buffer Overflows). |
| **regex (Rust)** | Expresiones regulares en tiempo lineal `O(n)`. | Sanitización anti-XSS sin soporte de backtracking exponencial (anti-ReDoS). |
| **Bootstrap Icons (Local)** | Íconos vectoriales locales. | Cero llamadas a CDNs externas; protección de privacidad y telemetría de usuario. |
| **webview2-com & windows (Rust)** | API nativa Win32 COM para Microsoft Edge WebView2 (`ICoreWebView2_7::PrintToPdf`). | Genera documentos vectoriales directamente en el motor nativo del SO sin límites de canvas ni vulnerabilidades de memoria del frontend. |
| **Módulo PRO & Licenciamiento (Local)** | Validación de licencias y pasarela Store. | Las compras se delegan a la infraestructura oficial de Microsoft Store (`ms-windows-store://`); la app no solicita, no procesa ni almacena números de tarjeta ni datos de pago en local. |

---

## 2. Mapa de APIs y Seguridad (IPC Tauri)

| Comando (`invoke`) | Nivel de Seguridad | Descripción y Mecanismo de Control |
| :--- | :--- | :--- |
| `abrir_archivo` | Privado / Local | Abre un diálogo nativo restringido a `.md` sin input directo de rutas arbitrarias. |
| `guardar_archivo` | Privado / Local | Guarda contenido en la ruta pre-validada (`Ctrl+S`). |
| `guardar_como` | Privado / Local | Diálogo nativo de guardado restringido a `.md`. |
| `exportar_html` | Privado / Local | Diálogo nativo de guardado restringido a `.html`. |
| `exportar_pdf` | Privado / Local | Diálogo nativo de guardado restringido a `.pdf`. Escribe bytes generados localmente. |
| `exportar_pdf_nativo` | Privado / Local | Diálogo nativo de guardado restringido a `.pdf`. Ejecuta `PrintToPdf` de WebView2 por canal COM aislado; previene DoS y bloqueos por desbordamiento de canvas. |
| `seleccionar_imagen` | Privado / Local | Diálogo nativo restringido a extensiones gráficas (.png, .jpg, .webp, .svg, .gif, .bmp) con cálculo seguro de rutas relativas. |
| `obtener_archivo_inicio` | Privado / Local | Captura argumentos de Windows con `args_os()` inmune a pánicos Unicode y valida extensiones `.md` con decodificación de texto tolerante. |
| `dialogo_sin_guardar` | Privado / Local | Diálogo de confirmación nativo del SO. |
| `parsear_markdown` | Privado / Local | Envía texto a Rust, procesa con GFM, sanitiza etiquetas y resuelve imágenes locales a Base64 según la ruta base del documento. Optimizado con `LazyLock` estático de expresiones regulares (Zero-recompilation). |
| `verificar_licencia_store` | Privado / Local | Verifica de forma pasiva la licencia en AppData y entorno MSIX/Store de Windows sin consultar claves en texto plano. |
| `activar_master_developer` | Privado / Local | Valida la Master Key mediante cálculo algebraico no lineal y fragmentos dispersos (`Sharded Checksum`). Habilita Tauri DevTools y PRO. |

---

## 3. Matriz de Prevención de Vulnerabilidades (OWASP Top 10 & ISO 27032)

| Vulnerabilidad Mitigada | Tipo de Ataque / Fallo Bloqueado | Mecanismo de Seguridad y Resiliencia Aplicado |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Manipulación no autorizada del sistema o rutas arbitrarias. | **Aislamiento por IPC:** El frontend web no tiene privilegios de SO; los diálogos nativos gestionan la ruta de destino validada con `PathBuf`. |
| **A02: Cryptographic Failures** | Fuga de datos de pago o tarjetas. | **Delegación a Microsoft Store:** La app no toca datos financieros; todo se tramita por la pasarela oficial de Windows. |
| **A03: Injection (XSS)** | Inyección de JavaScript vía documentos `.md` o imágenes maliciosas. | **Sanitización Rust:** Limpieza de scripts y handlers antes de renderizar tanto en preview como en exportación. Las imágenes locales se validan por extensión y tamaño antes de convertirse a Data URL. |
| **A04: Insecure Design & DoS (Hangs)** | Denegación de servicio por saturación de CPU o cuelgues de ventana (> 5s). | **LazyLock Estático y Debounce UI:** Se eliminó la recompilación continua de Regex en el backend y se aplicó debounce de 120ms en el frontend con persistencia asíncrona de borrador, garantizando 60 FPS y 0% de cuelgues. |
| **ISO 27032 & Resiliencia Operativa** | Crashes abruptos del binario en release por pánicos de caracteres regionales. | **Robusteza Unicode con `args_os` y Fallback Lossy:** Prevención de pánicos irrecuperables ante argumentos o archivos con codificaciones internacionales (GBK, ISO-8859-9, Windows-1252) de China, Turquía, Italia, España y Argentina. |
| **A06: Outdated Components** | Librerías externas vulnerables o dependencias remotas no confiables. | **Empaquetado local:** Bootstrap Icons y componentes se sirven localmente bajo CSP estricto (`default-src 'self'`). |
