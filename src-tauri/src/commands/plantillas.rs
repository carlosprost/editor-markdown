/// Módulo de plantillas para la exportación de documentos.
/// Centraliza el marcado HTML5 y estilos CSS embebidos para documentos exportados.

/// Constante con la cabecera HTML y los estilos embebidos para exportación en tema oscuro premium.
const PLANTILLA_HTML_PRE: &str = r#"<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exportación de Markdown - Editor Premium</title>
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --accent-color: #3b82f6;
      --border-color: #334155;
      --font-main: 'Inter', system-ui, -apple-system, sans-serif;
      --mono-font: 'Fira Code', 'Consolas', monospace;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-main);
      line-height: 1.7;
      padding: 40px 24px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 {
      color: var(--text-primary);
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.2;
    }
    h1 { font-size: 2.3em; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
    h2 { font-size: 1.8em; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
    h3 { font-size: 1.40em; }
    p { margin-bottom: 1em; color: var(--text-secondary); }
    a { color: var(--accent-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      background-color: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--mono-font);
      font-size: 0.9em;
      color: #fbbf24;
    }
    pre {
      background-color: var(--bg-secondary);
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 1em;
      border: 1px solid var(--border-color);
      position: relative;
    }
    pre code { background-color: transparent; color: var(--text-primary); padding: 0; }
    blockquote {
      border-left: 4px solid var(--accent-color);
      margin: 1em 0;
      padding: 10px 15px;
      color: var(--text-secondary);
      background-color: rgba(59, 130, 246, 0.1);
      border-radius: 0 4px 4px 0;
    }
    img { max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; }
    th { background-color: var(--bg-secondary); font-weight: 600; }
    hr { border: 0; height: 1px; background: var(--border-color); margin: 2em 0; }
    mark {
      background-color: rgba(245, 158, 11, 0.3);
      color: #fef08a;
      padding: 2px 4px;
      border-radius: 4px;
      font-weight: 500;
    }
    details {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 1em;
      padding: 12px 16px;
    }
    summary {
      font-weight: 600;
      cursor: pointer;
      outline: none;
      user-select: none;
      color: var(--text-primary);
    }
    .editor-alert {
      margin: 1.5em 0;
      padding: 15px;
      border-left: 4px solid var(--accent-color);
      border-radius: 0 8px 8px 0;
      background-color: rgba(59, 130, 246, 0.05);
    }
    .editor-alert__header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 0.9rem;
    }
    .editor-alert__title { text-transform: uppercase; letter-spacing: 0.05em; }
    .editor-alert__content { font-size: 0.95rem; color: var(--text-secondary); }
    .editor-alert__content p:last-child { margin-bottom: 0; }
    .editor-alert--note { border-left-color: #3b82f6; background-color: rgba(59, 130, 246, 0.08); }
    .editor-alert--note .editor-alert__header { color: #3b82f6; }
    .editor-alert--warning { border-left-color: #fbbf24; background-color: rgba(251, 191, 36, 0.08); }
    .editor-alert--warning .editor-alert__header { color: #fbbf24; }
    .editor-alert--tip { border-left-color: #22c55e; background-color: rgba(34, 197, 94, 0.08); }
    .editor-alert--tip .editor-alert__header { color: #22c55e; }
    .editor-alert--important { border-left-color: #a855f7; background-color: rgba(168, 85, 247, 0.08); }
    .editor-alert--important .editor-alert__header { color: #a855f7; }
    .editor-alert--caution { border-left-color: #ef4444; background-color: rgba(239, 68, 68, 0.08); }
    .editor-alert--caution .editor-alert__header { color: #ef4444; }
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
</head>
<body>
"#;

/// Constante con el cierre del documento HTML.
const PLANTILLA_HTML_POST: &str = r#"
</body>
</html>"#;

/// Genera la plantilla HTML5 completa con estilos embebidos del tema oscuro premium.
///
/// # Parámetros
/// * `html_content` - Contenido HTML del cuerpo a incrustar.
pub fn generar_plantilla_html(html_content: &str) -> String {
    let mut doc = String::with_capacity(
        PLANTILLA_HTML_PRE.len() + html_content.len() + PLANTILLA_HTML_POST.len(),
    );
    doc.push_str(PLANTILLA_HTML_PRE);
    doc.push_str(html_content);
    doc.push_str(PLANTILLA_HTML_POST);
    doc
}
