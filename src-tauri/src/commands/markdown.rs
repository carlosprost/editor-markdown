/// Módulo de procesamiento de Markdown.
/// Implementa el pipeline completo de transformación MD → HTML seguro,
/// incluyendo sanitización, alertas estilo GitHub y extensiones premium.
/// Reemplaza la lógica del Main Process de Electron (marked + funciones helper).
use pulldown_cmark::{html, Options, Parser};
use regex::Regex;
use std::collections::HashMap;

/// Parsea texto Markdown y lo transforma en HTML seguro y enriquecido.
/// Orquesta el pipeline completo de transformación en el orden correcto.
///
/// # Pipeline de transformación
/// 1. `pulldown-cmark` convierte MD → HTML crudo con soporte GFM
/// 2. `sanitizar_html` elimina vectores XSS (OWASP A03)
/// 3. `procesar_alertas_github` transforma blockquotes en cajas de alerta
/// 4. `procesar_markdown_extendido` procesa `==resaltado==` y emojis shortcodes
///
/// # Parámetros
/// * `texto` - Texto plano en formato Markdown escrito por el usuario.
#[tauri::command]
pub fn parsear_markdown(texto: String) -> String {
    if texto.is_empty() {
        return String::new();
    }

    // Habilitamos extensiones GFM: tablas, listas de tareas, texto tachado, etc.
    let mut opciones = Options::empty();
    opciones.insert(Options::ENABLE_TABLES);
    opciones.insert(Options::ENABLE_TASKLISTS);
    opciones.insert(Options::ENABLE_STRIKETHROUGH);
    opciones.insert(Options::ENABLE_FOOTNOTES);

    // Paso 1: MD → HTML crudo con pulldown-cmark
    let parser = Parser::new_ext(&texto, opciones);
    let mut html_crudo = String::new();
    html::push_html(&mut html_crudo, parser);

    // Paso 2: Sanitización anti-XSS
    let html_sanitizado = sanitizar_html(&html_crudo);

    // Paso 3: Procesamiento de alertas estilo GitHub
    let html_con_alertas = procesar_alertas_github(&html_sanitizado);

    // Paso 4: Extensiones premium (resaltado ==texto==, emojis shortcodes)
    procesar_markdown_extendido(&html_con_alertas)
}

/// Sanitiza el HTML eliminando vectores de ataque XSS comunes.
/// Previene ataques Cross-Site Scripting (OWASP A03).
///
/// La crate `regex` de Rust no soporta lookahead/lookbehind, por lo que
/// usamos patrones alternativos seguros para cada vector de ataque.
///
/// # Parámetros
/// * `html` - HTML crudo generado por el parser.
fn sanitizar_html(html: &str) -> String {
    // Elimina etiquetas <script>...</script> incluyendo su contenido
    // Usamos patrón simple sin lookahead que es suficiente para HTML parseado limpio
    let re_script = Regex::new(r"(?is)<script[^>]*>.*?</script>").unwrap();
    let sin_scripts = re_script.replace_all(html, "");

    // Elimina atributos de eventos inline (ej: onclick="...", onload='...')
    let re_eventos = Regex::new(r#"(?i)\s+on\w+\s*=\s*"[^"]*""#).unwrap();
    let sin_eventos_1 = re_eventos.replace_all(&sin_scripts, "");
    let re_eventos_single = Regex::new(r#"(?i)\s+on\w+\s*=\s*'[^']*'"#).unwrap();
    let sin_eventos = re_eventos_single.replace_all(&sin_eventos_1, "");

    // Reemplaza javascript: en href con # (enlace nulo seguro)
    let re_href_js = Regex::new(r#"(?i)href\s*=\s*"javascript:[^"]*""#).unwrap();
    let sin_href_js = re_href_js.replace_all(&sin_eventos, r##"href="#""##);

    // Elimina javascript: en src
    let re_src_js = Regex::new(r#"(?i)src\s*=\s*"javascript:[^"]*""#).unwrap();
    re_src_js.replace_all(&sin_href_js, r#"src="""#).to_string()
}

/// Transforma blockquotes con sintaxis de alerta GitHub en divs estilizados.
/// Soporta: `[!NOTE]`, `[!WARNING]`, `[!TIP]`, `[!IMPORTANT]`, `[!CAUTION]`
/// También es tolerante a la sintaxis `![NOTE]`.
///
/// # Parámetros
/// * `html` - HTML sanitizado con posibles blockquotes de alerta.
fn procesar_alertas_github(html: &str) -> String {
    let re_blockquote = Regex::new(r"(?is)<blockquote>(.*?)</blockquote>").unwrap();
    let re_tipo = Regex::new(
        r"(?is)^\s*<p>\s*!?\s*\[\s*!?\s*(NOTE|WARNING|WARN|TIP|IMPORTANT|CAUTION)\s*\]\s*(?::?|<br>)?\s*(.*?)</p>"
    ).unwrap();

    re_blockquote.replace_all(html, |caps: &regex::Captures| {
        let contenido = &caps[1];

        if let Some(m) = re_tipo.captures(contenido) {
            let tipo = m[1].to_uppercase();
            let resto_texto = m[2].trim().to_string();

            let (clase_alerta, titulo_alerta, icono_alerta) = match tipo.as_str() {
                "WARNING" | "WARN" => (
                    "editor-alert--warning",
                    "ADVERTENCIA",
                    "bi-exclamation-triangle-fill",
                ),
                "TIP" => ("editor-alert--tip", "CONSEJO", "bi-lightbulb-fill"),
                "IMPORTANT" => (
                    "editor-alert--important",
                    "IMPORTANTE",
                    "bi-exclamation-circle-fill",
                ),
                "CAUTION" => ("editor-alert--caution", "PRECAUCIÓN", "bi-shield-fill-x"),
                _ => ("editor-alert--note", "NOTA", "bi-info-circle-fill"),
            };

            // Eliminamos el primer párrafo del contenido (el que tiene el tipo)
            let parrafos_restantes = re_tipo.replace(contenido, "");

            return format!(
                r#"<div class="editor-alert {}">
  <div class="editor-alert__header">
    <i class="bi {} editor-alert__icon"></i>
    <span class="editor-alert__title">{}</span>
  </div>
  <div class="editor-alert__content">
    <p>{}</p>
    {}
  </div>
</div>"#,
                clase_alerta, icono_alerta, titulo_alerta, resto_texto, parrafos_restantes.trim()
            );
        }

        caps[0].to_string() // Retorna el blockquote original sin cambios si no es alerta
    }).to_string()
}

/// Construye el mapa de emojis shortcodes estilo Slack/GitHub.
/// Mapea los códigos más utilizados a sus respectivos caracteres Unicode.
fn construir_mapa_emojis() -> HashMap<&'static str, &'static str> {
    let mut mapa = HashMap::new();
    mapa.insert(":rocket:", "🚀");
    mapa.insert(":fire:", "🔥");
    mapa.insert(":heart:", "❤️");
    mapa.insert(":star:", "⭐");
    mapa.insert(":check:", "✅");
    mapa.insert(":warn:", "⚠️");
    mapa.insert(":smile:", "😊");
    mapa.insert(":bulb:", "💡");
    mapa.insert(":computer:", "💻");
    mapa.insert(":tada:", "🎉");
    mapa.insert(":ok_hand:", "👌");
    mapa.insert(":eyes:", "👀");
    mapa.insert(":thumbsup:", "👍");
    mapa.insert(":thumbsdown:", "👎");
    mapa.insert(":clap:", "👏");
    mapa.insert(":lock:", "🔒");
    mapa.insert(":key:", "🔑");
    mapa.insert(":memo:", "📝");
    mapa.insert(":books:", "📚");
    mapa.insert(":bug:", "🐛");
    mapa.insert(":hammer:", "🔨");
    mapa.insert(":wrench:", "🔧");
    mapa.insert(":gear:", "⚙️");
    mapa.insert(":construction:", "🚧");
    mapa.insert(":sparkles:", "✨");
    mapa
}

/// Procesa características de Markdown extendido fuera de bloques de código.
/// Aplica las siguientes transformaciones solo al contenido de texto (no a tags HTML):
/// - `==texto==` → `<mark>texto</mark>` (resaltado estilo Obsidian)
/// - `:shortcode:` → emoji Unicode (estilo Slack/GitHub)
///
/// Itera sobre los matches de tags HTML para separar texto de markup y aplicar
/// las transformaciones únicamente en nodos de texto fuera de bloques <code>/<pre>.
///
/// # Parámetros
/// * `html` - HTML con alertas procesadas.
fn procesar_markdown_extendido(html: &str) -> String {
    let mapa_emojis = construir_mapa_emojis();
    let re_resaltado = Regex::new(r"==([^=]+)==").unwrap();
    let re_emoji = Regex::new(r":[a-z0-9_+\-]+:").unwrap();
    let re_tag = Regex::new(r"</?[a-zA-Z0-9]+[^>]*>").unwrap();

    let mut resultado = String::new();
    let mut dentro_de_codigo: u32 = 0;
    let mut ultimo_fin: usize = 0;

    // Iteramos sobre cada tag HTML encontrado en el string
    for m in re_tag.find_iter(html) {
        // Procesamos el segmento de texto previo al tag actual
        let texto = &html[ultimo_fin..m.start()];
        if !texto.is_empty() {
            if dentro_de_codigo == 0 {
                // Aplicamos resaltado ==texto== → <mark>texto</mark>
                let con_resaltado = re_resaltado.replace_all(texto, "<mark>$1</mark>");
                // Aplicamos emojis shortcodes :shortcode: → emoji Unicode
                let con_emojis = re_emoji.replace_all(&con_resaltado, |caps: &regex::Captures| {
                    mapa_emojis
                        .get(caps[0].to_lowercase().as_str())
                        .copied()
                        .unwrap_or(&caps[0])
                        .to_string()
                });
                resultado.push_str(&con_emojis);
            } else {
                // Dentro de bloques de código: respetamos el contenido sin transformar
                resultado.push_str(texto);
            }
        }

        // Actualizamos el contador de profundidad de código según el tag encontrado
        let tag = m.as_str();
        let tag_lower = tag.to_lowercase();
        if tag_lower.starts_with("<code") || tag_lower.starts_with("<pre") {
            dentro_de_codigo += 1;
        } else if tag_lower.starts_with("</code") || tag_lower.starts_with("</pre") {
            dentro_de_codigo = dentro_de_codigo.saturating_sub(1);
        }

        resultado.push_str(tag);
        ultimo_fin = m.end();
    }

    // Procesamos el texto restante después del último tag
    let texto_final = &html[ultimo_fin..];
    if !texto_final.is_empty() {
        if dentro_de_codigo == 0 {
            let con_resaltado = re_resaltado.replace_all(texto_final, "<mark>$1</mark>");
            let con_emojis = re_emoji.replace_all(&con_resaltado, |caps: &regex::Captures| {
                mapa_emojis
                    .get(caps[0].to_lowercase().as_str())
                    .copied()
                    .unwrap_or(&caps[0])
                    .to_string()
            });
            resultado.push_str(&con_emojis);
        } else {
            resultado.push_str(texto_final);
        }
    }

    resultado
}
