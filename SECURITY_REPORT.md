# Reporte de Seguridad del Editor Markdown (SECURITY_REPORT.md)

Este documento detalla la auditoría de seguridad y las medidas implementadas en el proyecto para mitigar vulnerabilidades y cumplir con los estándares de ciberseguridad (OWASP Top 10, ISO 27001 e ISO 27002) para la versión **v2.3.0 (Versión Comercial + PRO)**.

---

## 1. Auditoría de Stack y Dependencias

| Dependencia / Tecnología | Función en el Proyecto | Contribución a la Seguridad |
| :--- | :--- | :--- |
| **Tauri V2 (Rust)** | Framework central para la ejecución de la aplicación de escritorio. | Aisla la UI web del sistema operativo. Su modelo de seguridad prohíbe el acceso directo al filesystem; todo requiere configuración explícita en `capabilities`. |
| **pulldown-cmark (Rust)** | Motor de parsing y renderizado Markdown a HTML. | Seguro y compilado en Rust con protección contra desbordamientos de memoria (Buffer Overflows). |
| **regex (Rust)** | Expresiones regulares en tiempo lineal `O(n)`. | Sanitización anti-XSS sin soporte de backtracking exponencial (anti-ReDoS). |
| **Bootstrap Icons (Local)** | Íconos vectoriales locales. | Cero llamadas a CDNs externas; protección de privacidad y telemetría de usuario. |
| **Módulo PRO & Licenciamiento (Local)** | Validación de licencias y pasarela Store. | Las compras se delegan a la infraestructura oficial de Microsoft Store (`ms-windows-store://`); la app no solicita, no procesa ni almacena números de tarjeta ni datos de pago en local. |

---

## 2. Mapa de APIs y Seguridad (IPC Tauri)

| Comando (`invoke`) | Nivel de Seguridad | Descripción y Mecanismo de Control |
| :--- | :--- | :--- |
| `abrir_archivo` | Privado / Local | Abre un diálogo nativo restringido a `.md` sin input directo de rutas arbitrarias. |
| `guardar_archivo` | Privado / Local | Guarda contenido en la ruta pre-validada (`Ctrl+S`). |
| `guardar_como` | Privado / Local | Diálogo nativo de guardado restringido a `.md`. |
| `exportar_html` | Privado / Local | Diálogo nativo de guardado restringido a `.html`. |
| `obtener_archivo_inicio` | Privado / Local | Captura argumentos de Windows filtrando flags (`--`) y validando extensiones `.md`. |
| `dialogo_sin_guardar` | Privado / Local | Diálogo de confirmación nativo del SO. |
| `parsear_markdown` | Privado / Local | Envía texto a Rust, procesa con GFM y sanitiza etiquetas `<script>`, `javascript:` y handlers inline. |
| `verificar_licencia_store` | Privado / Local | Verifica de forma pasiva la licencia en AppData y entorno MSIX/Store de Windows sin consultar claves en texto plano. |
| `activar_master_developer` | Privado / Local | Valida la Master Key mediante cálculo algebraico no lineal y fragmentos dispersos (`Sharded Checksum`). Habilita Tauri DevTools y PRO. |

---

## 3. Matriz de Prevención de Vulnerabilidades (OWASP Top 10)

| Vulnerabilidad Mitigada | Tipo de Ataque Bloqueado | Mecanismo de Seguridad Aplicado |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Manipulación no autorizada del sistema. | **Aislamiento por IPC:** El frontend web no tiene privilegios de SO. |
| **A02: Cryptographic Failures** | Fuga de datos de pago o tarjetas. | **Delegación a Microsoft Store:** La app no toca datos financieros; todo se tramita por la pasarela de Windows. |
| **A03: Injection (XSS)** | Inyección de JavaScript vía documentos `.md`. | **Sanitización Rust:** Limpieza de scripts y handlers antes de renderizar. |
| **A06: Outdated Components** | Librerías externas vulnerables. | **Cero dependencias npm de runtime:** Frontend 100% Vanilla sin dependencias web externas. |
| **A04: Insecure Design** | Filtrado de rutas del sistema y stack traces. | **Rust Error Handling:** Mensajes de error controlados sin filtrar rutas internas. |
