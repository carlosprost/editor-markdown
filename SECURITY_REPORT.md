# Reporte de Seguridad del Editor Markdown (SECURITY_REPORT.md)

Este documento detalla la auditoría de seguridad y las medidas implementadas en el proyecto para mitigar vulnerabilidades y cumplir con los estándares de ciberseguridad (OWASP Top 10, ISO 27001 e ISO 27002).

---

## 1. Auditoría de Stack y Dependencias

A continuación se detallan las tecnologías y dependencias principales utilizadas en el proyecto y su aporte específico a la seguridad de la aplicación:

| Dependencia / Tecnología | Versión | Función en el Proyecto | Contribución a la Seguridad |
| :--- | :--- | :--- | :--- |
| **Electron** | `^29.1.0` | Framework central para la ejecución de la aplicación de escritorio. | Permite aislar el proceso de renderizado (Frontend) del proceso principal (Backend) mediante `contextIsolation` y deshabilitar `nodeIntegration`. |
| **Marked** | `^12.0.1` | Motor de parsing y renderizado de contenido Markdown a HTML. | Configurado en modo seguro (escapando y sanitizando scripts HTML embebidos) para prevenir inyecciones de código. |
| **Electron-Reload** | `^2.0.0-alpha.1` | Utilidad de desarrollo para la recarga automática. | Uso exclusivo en el entorno de desarrollo local. No se incluye en el empaquetado final de producción para evitar la exposición de código fuente en caliente. |
| **Bootstrap Icons** | `^1.11.3` | Librería de íconos vectoriales para la interfaz de usuario. | Al ser íconos SVG/font locales estáticos, previenen solicitudes de recursos de red externos no autenticados, evitando ataques de inyección de contenido a través de CDNs de terceros. |
| **Electron-Builder** | `^24.13.3` | Utilidad de empaquetado y compilación nativa en entornos locales y de CI/CD. | Genera instaladores NSIS y binarios portables Windows con estructura de archivos cerrada, previniendo manipulaciones del código de ejecución por terceros. |

---

## 2. Mapa de APIs y Seguridad (IPC Bridge)

En lugar de exponer el backend de Node.js de forma directa al frontend, se implementa un **IPC Bridge** seguro a través de `src/preload.js`. Esta capa actúa como un firewall de permisos limitados utilizando `contextBridge`.

### Comandos y Canales Expuestos en `window.electronAPI`:

| Canal / Método Expuesto | Tipo de Evento | Nivel de Seguridad | Descripción y Mecanismo de Control |
| :--- | :--- | :--- | :--- |
| `openFile()` | Asíncrono (Invoca IPC) | Privado / Local | Abre un diálogo nativo del sistema operativo gestionado por el proceso principal. Lee el archivo y retorna de forma segura el contenido sin exponer rutas de red ni APIs del filesystem (`fs`) al cliente. |
| `readFile(ruta)` | Asíncrono (Invoca IPC) | Privado / Local | Lee de forma segura el contenido de un archivo Markdown de la sesión previa en una ruta física, controlada por el proceso principal para prevenir accesos a archivos restringidos. |
| `saveFile(ruta, contenido)` | Asíncrono (Invoca IPC) | Privado / Local | Guarda el contenido editado de forma segura en la ruta del archivo actual. El backend valida que la ruta sea local y escribe de forma asíncrona. |
| `saveAsFile(contenido)` | Asíncrono (Invoca IPC) | Privado / Local | Invoca el diálogo de guardado del sistema operativo de manera controlada por el proceso principal. Filtra las extensiones permitidas exclusivamente a `.md` para evitar escrituras arbitrarias de código malicioso. |
| `exportAsHTML(contenido)` | Asíncrono (Invoca IPC) | Privado / Local | Invoca un diálogo nativo para guardar en formato HTML el contenido formateado y sanitizado. Protege la app validando el path y limitando la extensión exclusivamente a `.html`. |
| `showUnsavedDialog()` | Asíncrono (Invoca IPC) | Privado / Local | Dispara un diálogo nativo de confirmación en el sistema operativo ante cambios pendientes de guardado, evitando que el renderer process tome decisiones del sistema. |
| `showErrorBox(titulo, msj)` | Asíncrono (Invoca IPC) | Privado / Local | Lanza notificaciones de error nativas del sistema operativo de forma aislada y controlada por el backend. |
| `closeWindow()` | Síncrono (Envía IPC) | Local | Envía una petición de cierre que es interceptada de forma segura por el Main Process para validar cambios pendientes. |
| `forceCloseWindow()` | Síncrono (Envía IPC) | Local | Fuerza el cierre efectivo de la ventana una vez salvado o descartado el archivo. |
| `onAttemptClose(callback)` | Suscripción (IPC Event) | Privado / Local | Canal unidireccional de escucha para reaccionar al intento de cierre interactivo de la ventana. |
| `minimizeWindow()` | Síncrono (Envía IPC) | Local | Minimiza la ventana mediante `win.minimize()` en el proceso principal. |
| `maximizeWindow()` | Síncrono (Envía IPC) | Local | Maximiza la ventana mediante `win.maximize()` en el proceso principal. |
| `unmaximizeWindow()` | Síncrono (Envía IPC) | Local | Desmaximiza la ventana mediante `win.unmaximize()` en el proceso principal. |
| `isMaximized()` | Síncrono (Envía IPC) | Local | Devuelve un booleano al frontend que indica si la ventana está maximizada de forma segura. |

---

## 3. Estrategia de Sanitización y Validación

### Prevención de SQL Injection y NoSQL Injection
*   **A03: Injection:** Esta aplicación no utiliza motores de base de datos SQL o NoSQL dinámicos, por lo que el riesgo de inyecciones a nivel de queries es nulo. Las lecturas y escrituras de archivos en el sistema local se realizan mediante flujos asíncronos y aislados de Node.js que emplean exclusivamente nombres de archivo validados por los diálogos nativos del sistema operativo (`dialog.showOpenDialogSync` y `dialog.showSaveDialogSync`), impidiendo ataques de Path Traversal.

### Prevención de XSS (Cross-Site Scripting)
*   El renderizado de Markdown a HTML es un vector de ataque XSS común si el texto markdown del usuario incluye etiquetas HTML de script o elementos con atributos ejecutables (`onload`, `onerror`, `onclick`, etc.).
*   **Medida de Control:** Se implementó un pipeline de sanitización estricta (`sanitizarHTML` en `app.js`) que procesa todo el marcado HTML generado por `marked` en el Main Process. Esta función remueve proactivamente cualquier etiqueta `<script>`, elimina handlers de eventos inline (patrón `on[event]`) y neutraliza pseudoprotocolos maliciosos como `javascript:` en atributos `href` o `src`, garantizando que solo se inyecte código seguro y limpio en el DOM del Renderer Process.

---

## 4. Matriz de Prevención de Vulnerabilidades (OWASP Top 10 / ISO 27001)

| Vulnerabilidad Mitigada | Tipo de Ataque Bloqueado | Mecanismo de Seguridad Aplicado | Control ISO 27002 Relacionado |
| :--- | :--- | :--- | :--- |
| **A01: Broken Access Control** (Control de Acceso Vulnerable) | Ejecución remota de comandos o acceso no autorizado al filesystem del cliente. | **Aislamiento del Renderer Process:** `contextIsolation: true` y `nodeIntegration: false`. El frontend no tiene acceso a módulos nativos de Node.js (`fs`, `child_process`). | **Control 8.20** - Seguridad de Redes y Acceso Limitado. |
| **A03: Injection** & **XSS** | Inyección de scripts dinámicos maliciosos dentro de archivos Markdown que se ejecutan al visualizarlos. | **Pipeline de Sanitización en app.js:** Sanitización estricta personalizada post-parseo para neutralizar scripts, handlers de eventos inline y pseudoprotocolos maliciosos. | **Control 8.28** - Desarrollo de Software Seguro. |
| **Diseño Inseguro** | Fuga de rutas físicas reales y manipulación no controlada de archivos en directorios críticos. | **Abstracción del Filesystem:** Las operaciones de archivos pasan obligatoriamente por diálogos nativos y se limitan por extensiones restringidas (`.md`). | **Control 8.25** - Ciclo de vida de desarrollo seguro. |
