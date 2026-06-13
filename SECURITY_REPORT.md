# Reporte de Seguridad del Editor Markdown (SECURITY_REPORT.md)

Este documento detalla la auditoría de seguridad y las medidas implementadas en el proyecto para mitigar vulnerabilidades y cumplir con los estándares de ciberseguridad (OWASP Top 10, ISO 27001 e ISO 27002).

---

## 1. Auditoría de Stack y Dependencias

A continuación se detallan las tecnologías y dependencias principales utilizadas en el proyecto (ahora basado en Rust/Tauri V2) y su aporte específico a la seguridad de la aplicación:

| Dependencia / Tecnología | Función en el Proyecto | Contribución a la Seguridad |
| :--- | :--- | :--- |
| **Tauri V2 (Rust)** | Framework central para la ejecución de la aplicación de escritorio. | Aisla la UI web (HTML/JS) del sistema operativo. Su modelo de seguridad prohíbe el acceso directo al filesystem desde el frontend; todo requiere configuración explícita en `capabilities`. |
| **pulldown-cmark (Rust)** | Motor de parsing y renderizado de contenido Markdown a HTML. | Altamente seguro y escrito en Rust, mitigando vulnerabilidades de desbordamiento de memoria (Buffer Overflows) típicas de parsers en C. Genera HTML crudo que luego se sanitiza. |
| **regex (Rust)** | Librería de expresiones regulares. | Se usa en Rust para la limpieza y formateo. Diseñada en tiempo lineal `O(n)` sin soporte para lookaround (lookahead/lookbehind), lo que bloquea ataques ReDoS (Denegación de Servicio por Regex). |
| **Bootstrap Icons** | Librería de íconos vectoriales para la UI. | Íconos SVG empaquetados localmente; previenen solicitudes a servidores externos (CDNs), bloqueando posibles ataques de inyección y rastreo (Privacy protection). |

---

## 2. Mapa de APIs y Seguridad (IPC Tauri)

El frontend en JavaScript interactúa con el sistema operativo invocando comandos (`commands`) escritos en Rust mediante `invoke()`. El modelo es seguro por defecto: ningún comando está expuesto a menos que se defina en `main.rs`.

### Comandos de Rust Expuestos (Endpoints Backend):

| Comando (`invoke`) | Nivel de Seguridad | Descripción y Mecanismo de Control |
| :--- | :--- | :--- |
| `abrir_archivo` | Privado / Local | Abre un diálogo nativo de Windows (vía `rfd`). Lee el archivo seleccionado y lo devuelve al frontend. Sin input de rutas desde el frontend, previene **Path Traversal**. |
| `guardar_archivo` | Privado / Local | Recibe una ruta validada previamente y el contenido a guardar. Se usa para operaciones directas (`Ctrl+S`). |
| `guardar_como` | Privado / Local | Abre un diálogo nativo de guardado restringido a `.md`. Evita la inyección de nombres de archivos ejecutables (`.exe`, `.bat`). |
| `exportar_html` | Privado / Local | Igual que `guardar_como` pero restringido a archivos `.html`. |
| `dialogo_sin_guardar` | Privado / Local | Abre un `MessageDialog` nativo (Yes/No/Cancel) desde el backend para confirmaciones críticas sin bloquear el hilo de la UI web. |
| `mostrar_error` | Privado / Local | Dispara mensajes de error genéricos controlados, evitando filtrar Stack Traces al usuario final. |
| `parsear_markdown` | Privado / Local | Envía el texto crudo a Rust, lo procesa con `pulldown-cmark`, lo sanitiza de XSS y lo devuelve. Toda la carga criptográfica y validación recae en el backend seguro de Rust. |

---

## 3. Capacidades del Frontend (`capabilities/default.json`)

Tauri restringe lo que el frontend puede hacer incluso usando los plugins oficiales. En `default.json` solo se habilitan explícitamente:
- **`core:window:allow-*`**: Manipulación básica de la ventana frameless (minimizar, maximizar, destroy).
- **`dialog:allow-*`**: Acceso al plugin de diálogos nativos.
- **`fs:allow-*`**: Permisos explícitos de lectura/escritura de texto, limitados por la lógica de negocio.

---

## 4. Estrategia de Sanitización y Validación

### Prevención de Inyecciones (OWASP A03)
*   **Path Traversal & Inyecciones FS:** El frontend rara vez manipula rutas directamente; el 90% de las operaciones de FS (File System) se dirigen mediante el diálogo nativo instanciado en Rust. Las operaciones son a nivel local, sin uso de sentencias SQL, erradicando inyecciones de BD.

### Prevención de XSS (Cross-Site Scripting)
*   El renderizado Markdown -> HTML es el mayor vector de ataque potencial.
*   **Pipeline de Sanitización en Rust:** Antes de enviar el HTML procesado al frontend, la función `sanitizar_html` en Rust elimina proactivamente:
    1. Las etiquetas `<script>...</script>`.
    2. Atributos inline maliciosos (e.g. `onload=`, `onerror=`).
    3. Pseudo-protocolos `javascript:` en links (`href`) o imágenes (`src`).
*   Esto garantiza el cumplimiento estricto de **OWASP A03 (Injection)**.

---

## 5. Matriz de Prevención de Vulnerabilidades

| Vulnerabilidad Mitigada (OWASP) | Tipo de Ataque Bloqueado | Mecanismo de Seguridad Aplicado |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Manipulación no autorizada del sistema. | **Aislamiento por IPC:** El frontend web no tiene privilegios de SO. Todo se canaliza por `invoke` de Tauri. |
| **A03: Injection (XSS)** | Inyección de JavaScript vía documentos `.md`. | **Sanitización Rust:** Limpieza agresiva de scripts y handlers antes de renderizar el DOM del webview. |
| **A06: Vulnerable and Outdated Components** | Uso de librerías JS antiguas vulnerables. | **Migración a Tauri V2:** Reemplazo de Electron y Node.js local por binarios nativos de Rust altamente auditados. |
| **A04: Insecure Design** | Filtrado de rutas del sistema y stack traces. | **Rust Result/Error Handling:** Los errores (`Result::Err`) se mapean en strings genéricas en el `mostrar_error` sin fugar rutas internas al JS. |
