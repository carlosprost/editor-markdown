# 💎 Editor de Markdown (v2.1.0)

¡Qué hacés! Te damos la bienvenida al **Editor de Markdown**, un editor e intérprete interactivo de alto rendimiento desarrollado en **Tauri V2** (Rust + HTML/CSS/JS Vanilla). 

Esta aplicación fue refactorizada a nivel comercial para ofrecer una experiencia de usuario (UX) sumamente fluida y moderna, inspirándose en las mejores prácticas de herramientas líderes del mercado como **Notion, Obsidian y GitHub**, todo blindado bajo estándares de ciberseguridad industrial.

---

## 🚀 Características Destacadas

### 🖥️ Modo Visor & Colapsado Suave (Notion-Style)
*   **Alternancia con un Clic:** Un botón interactivo en el header (`toggle-view`) te permite ocultar el panel del editor con un icono dinámico que cambia de ojo (`bi-eye`) a lápiz (`bi-pencil`) para re-editar al instante.
*   **Transiciones Cubic-Bezier:** El panel del editor se desliza y desvanece de forma ultrasuave a ancho 0 y opacidad 0 usando una curva de aceleración (`cubic-bezier(0.4, 0, 0.2, 1)`) en 300 ms, expandiendo de forma reactiva la vista previa de lectura.
*   **Sincronización Inteligente:** Al cerrar tu archivo, la app se colapsa automáticamente a su estado base de visualización y deshabilita el botón de Modo Visor de forma coherente.

### 🛡️ Aislamiento y Seguridad de Nivel Industrial (OWASP & ISO)
*   **Aislamiento de Procesos:** Cumpliendo con **OWASP A01**, separamos el Frontend (Webview) del Backend (Core en Rust). La interfaz no tiene acceso directo al sistema operativo, interactuando únicamente mediante comandos seguros IPC nativos de Tauri.
*   **Pipeline de Sanitización de HTML (OWASP A03 / XSS):** El parseo de Markdown a HTML se realiza de forma aislada en el backend de Rust, aplicando una función de sanitización personalizada que purga etiquetas `<script>`, neutraliza pseudoprotocolos `javascript:` y elimina handlers de eventos inline (`onload`, `onerror`).
*   **Seguridad de Filesystem:** Las operaciones de apertura y guardado de archivos pasan exclusivamente por diálogos nativos del sistema operativo (`dialog.showOpenDialog`), limitando las extensiones únicamente a `.md` para evitar Path Traversal y escrituras arbitrarias de código.

### 💎 Características Markdown Extendidas
*   **Texto Resaltado (`==resaltado==` - Obsidian Style):** Convierte tus marcas en etiquetas `<mark>` con un fondo fluorescente de tono ámbar sutil muy legible en modo oscuro. Está protegido para no alterar operadores lógicos `==` dentro de bloques de código.
*   **Emojis Shortcodes (`:rocket:` -> 🚀 - Slack/GitHub Style):** Soporte integrado para 25 de los shortcodes de emojis más populares, interpretados de manera dinámica antes de inyectar en el DOM.
*   **Botón Flotante "Copiar Código" (GitHub Style):** Inyecta botones interactivos de copia flotante (`bi-copy`) sobre todos los bloques `<pre>`. Copia asíncronamente al portapapeles y te da feedback visual de éxito verde temporal por 2 segundos.
*   **Checklists Reactivas Bidireccionales (Obsidian Style):** Los checkboxes en el preview se habilitan nativamente. Al alternar un checkbox en el preview, se busca de forma secuencial y exacta la línea correspondiente en el editor y se actualiza de `- [ ]` a `- [x]` (o viceversa) en tiempo real.
*   **Acordeones Colapsables (Notion Style):** Soporte y estilización interactiva de las etiquetas nativas `<details>` y `<summary>` con flechas de rotación suave animadas y bordes definidos.

### 💾 Productividad y UX de Alto Rango
*   **Atajos de Teclado Globales:** Shortcuts asíncronos de productividad para agilizar el trabajo:
    *   `Ctrl + S` -> Guardar archivo de forma directa.
    *   `Ctrl + Shift + S` -> Guardar como...
    *   `Ctrl + O` -> Abrir archivo.
    *   `Ctrl + N` -> Crear nuevo archivo limpio.
*   **Arrastrar y Soltar (Drag & Drop):** Podés arrastrar cualquier archivo `.md` desde tu explorador de Windows y soltarlo directamente en la app para abrirlo al instante.
*   **Exportación a HTML:** Botón nativo de exportación que compila y empaqueta tu Markdown en un archivo `.html` físico completo con las variables de colores, fuentes tipográficas y todo el set de estilos del tema oscuro de la aplicación.
*   **Exportación Limpia a PDF:** Botón nativo para guardar e imprimir el documento renderizado en PDF, con estilos especializados (`@media print`) para ocultar la interfaz, formatear el ancho de página en papel y preservar los resaltados de código.
*   **Doble Clic Reactivo (Maximización del SO):** El backend escucha de forma nativa los eventos del sistema operativo (`maximize` y `unmaximize`) para mantener sincronizados al instante los iconos de maximizar y restaurar de la ventana, incluso si hacés doble clic en la barra de título personalizada.

---

## 🎨 Identidad Visual y Diseño

*   **Icono Squircle de Vanguardia:** Se rediseñó la identidad visual de la aplicación usando un logo de Markdown en 3D con degradados neón azul/cian y estilo de vidrio esmerilado (glassmorphism), configurado tanto en la ventana y barra de tareas como en la esquina superior izquierda del header con micro-animaciones dinámicas al pasar el cursor.
*   **Esquema de Colores HSL:** Paleta de colores balanceada y armoniosa con variables CSS de tonos pizarra, carbón y realces azules para evitar fatiga visual durante sesiones prolongadas.

---

## 🛠️ Instalación y Uso en Local

### 1. Clonar e Instalar Dependencias
Para clonar el repositorio y levantar la aplicación en tu entorno local, ejecutá:
```bash
# Clonar
git clone https://github.com/carlosprost/editor-markdown.git

# Instalar dependencias
npm install
```

### 2. Ejecutar en Modo Desarrollo
Para lanzar la aplicación localmente en modo desarrollo (con recarga en caliente condicional activa):
```bash
npm run dev
```

### 3. Empaquetar y Compilar de Forma Local
Para compilar la aplicación y generar el instalador nativo ejecutable (`.exe`) de Windows de forma local:
```bash
npm run build
```
El instalador resultante y el software portable quedarán alojados en el directorio `/dist`.

---


## 🔒 Reporte de Seguridad

Para un desglose de cómo mitigamos el OWASP Top 10 y cumplimos con los controles de ISO 27001 / 27002, revisá el archivo **[SECURITY_REPORT.md](SECURITY_REPORT.md)** en la raíz del proyecto.

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Consultá el archivo `LICENSE` para más detalles.
