//! HTML helpers: text extraction (port of `worker/html.ts`) and sanitising of
//! mail bodies for display (port of `renderer/src/lib/emailHtml.ts`, with
//! ammonia instead of DOMPurify).

use std::borrow::Cow;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock};

use regex::Regex;

use crate::text::tidy_text;

fn re(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid regex")
}

static COMMENTS: LazyLock<Regex> = LazyLock::new(|| re(r"(?s)<!--.*?-->"));
static CONDITIONAL: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)<!\[(?:end)?if[^\]]*\]>"));
static DROP_BLOCKS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    ["head", "style", "script", "title", "noscript", "template", "xml"]
        .iter()
        .map(|tag| re(&format!(r"(?is)<{tag}\b[^>]*>.*?</{tag}\s*>")))
        .collect()
});
static LINE_BREAK: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)<(br|hr)\b[^>]*>"));
static BLOCK_END: LazyLock<Regex> =
    LazyLock::new(|| re(r"(?i)</(p|div|tr|li|h[1-6]|table|blockquote|pre|section|article|header|footer|ul|ol|dl|dt|dd)\s*>"));
static CELL_END: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)</t[dh]\s*>"));
static TAGS: LazyLock<Regex> = LazyLock::new(|| re(r"<[^>]+>"));

/// Converts an HTML mail body to readable plain text. Fast and DOM-free, good
/// enough for search indexing and previews.
pub(crate) fn html_to_text(html: &str) -> String {
    if html.is_empty() {
        return String::new();
    }
    let mut text: Cow<str> = COMMENTS.replace_all(html, " ");
    text = Cow::Owned(CONDITIONAL.replace_all(&text, " ").into_owned());
    for block in DROP_BLOCKS.iter() {
        if let Cow::Owned(replaced) = block.replace_all(&text, " ") {
            text = Cow::Owned(replaced);
        }
    }
    let text = LINE_BREAK.replace_all(&text, "\n");
    let text = BLOCK_END.replace_all(&text, "\n");
    let text = CELL_END.replace_all(&text, "\t");
    let text = TAGS.replace_all(&text, " ");
    tidy_text(&html_escape::decode_html_entities(&text))
}

static CID_REF: LazyLock<Regex> = LazyLock::new(|| re(r#"(?i)cid:([^"'\s)>]+)"#));

/// Decodes %XX escapes (like `decodeURIComponent`); invalid input is kept.
fn percent_decode(value: &str) -> String {
    if !value.contains('%') {
        return value.to_string();
    }
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let hex = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push(high << 4 | low);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| value.to_string())
}

pub(crate) fn normalize_content_id(id: &str) -> String {
    let id = id.trim();
    let id = id.strip_prefix('<').unwrap_or(id);
    let id = id.strip_suffix('>').unwrap_or(id);
    id.to_lowercase()
}

/// The (lower-cased, decoded) content IDs referenced by an HTML body.
pub(crate) fn referenced_content_ids(html: Option<&str>) -> HashSet<String> {
    let mut ids = HashSet::new();
    if let Some(html) = html {
        for m in CID_REF.captures_iter(html) {
            ids.insert(normalize_content_id(&percent_decode(&m[1])));
        }
    }
    ids
}

pub fn escape_html(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&#38;"),
            '<' => out.push_str("&#60;"),
            '>' => out.push_str("&#62;"),
            '"' => out.push_str("&#34;"),
            '\'' => out.push_str("&#39;"),
            c => out.push(c),
        }
    }
    out
}

pub(crate) fn escape_attribute(value: &str) -> String {
    value.replace('&', "&amp;").replace('"', "&quot;").replace('<', "&lt;")
}

// -----------------------------------------------------------------------------
// Sanitising

/// 1x1 transparent GIF used in place of blocked remote images.
const BLANK_IMAGE: &str = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

static REMOTE_URL: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)^\s*(https?:)?//"));
static CSS_REMOTE: LazyLock<Regex> = LazyLock::new(|| re(r#"(?i)url\(\s*['"]?\s*(https?:)?//"#));
static CSS_IMPORT: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)@import"));
static STYLE_BLOCK: LazyLock<Regex> = LazyLock::new(|| re(r"(?is)<style\b[^>]*>(.*?)</style\s*>"));
static STYLE_CLOSE: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)</style"));
static BODY_TAG: LazyLock<Regex> = LazyLock::new(|| re(r"(?is)<body\b([^>]*)>"));
static ATTRIBUTE: LazyLock<Regex> = LazyLock::new(|| re(r#"([a-zA-Z][a-zA-Z-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))"#));

const BODY_ATTRIBUTES: [&str; 9] = ["bgcolor", "text", "link", "vlink", "alink", "background", "dir", "lang", "style"];

pub(crate) struct SanitizedMail {
    /// Style sheets of the mail, moved out of the document.
    pub styles: Vec<String>,
    /// Sanitised content of the mail's body.
    pub body: String,
    /// Serialised, allowed attributes of the mail's `<body>` element.
    pub body_attributes: String,
    /// True if the message references remote resources.
    pub has_remote: bool,
}

/// Replaces `cid:` references by the data URLs of inline images.
fn resolve_inline_images(html: &str, inline_images: &HashMap<String, String>) -> String {
    if inline_images.is_empty() {
        return html.to_string();
    }
    CID_REF
        .replace_all(html, |caps: &regex::Captures| {
            let key = normalize_content_id(&percent_decode(&caps[1]));
            inline_images.get(&key).cloned().unwrap_or_else(|| caps[0].to_string())
        })
        .into_owned()
}

fn allowed_image_data(value: &str) -> bool {
    value.trim_start().get(..11).is_some_and(|p| p.eq_ignore_ascii_case("data:image/"))
}

/// Sanitises an HTML mail body: no scripts, no forms, no plugins and - unless
/// allowed - no remote images. Inline images (`cid:`) become data URLs.
pub(crate) fn sanitize_mail(html: &str, inline_images: &HashMap<String, String>, allow_remote: bool) -> SanitizedMail {
    let html = resolve_inline_images(html, inline_images);

    let styles: Vec<String> = STYLE_BLOCK.captures_iter(&html).map(|c| STYLE_CLOSE.replace_all(&c[1], "").into_owned()).collect();
    let has_remote = Arc::new(AtomicBool::new(styles.iter().any(|css| CSS_REMOTE.is_match(css) || CSS_IMPORT.is_match(css))));

    let mut body_attributes = Vec::new();
    if let Some(body) = BODY_TAG.captures(&html) {
        for attr in ATTRIBUTE.captures_iter(&body[1]) {
            let name = attr[1].to_lowercase();
            let value = attr.get(2).or(attr.get(3)).or(attr.get(4)).map_or("", |m| m.as_str());
            if !BODY_ATTRIBUTES.contains(&name.as_str()) {
                continue;
            }
            let value = html_escape::decode_html_entities(value);
            if name == "background" {
                if REMOTE_URL.is_match(&value) {
                    has_remote.store(true, Ordering::Relaxed);
                    if !allow_remote {
                        continue;
                    }
                } else if !allowed_image_data(&value) {
                    continue;
                }
            }
            if name == "style" && CSS_REMOTE.is_match(&value) {
                has_remote.store(true, Ordering::Relaxed);
            }
            body_attributes.push(format!("{name}=\"{}\"", escape_attribute(&value)));
        }
    }

    let flag = Arc::clone(&has_remote);
    let mut builder = ammonia::Builder::default();
    builder
        .add_tags(["font", "big", "section", "main", "address", "tfoot", "caption"])
        .add_clean_content_tags(["title", "noscript", "template", "xml"])
        .add_generic_attributes([
            "style",
            "class",
            "id",
            "dir",
            "align",
            "valign",
            "bgcolor",
            "background",
            "width",
            "height",
            "border",
            "color",
            "face",
            "size",
            "nowrap",
            "cellpadding",
            "cellspacing",
            "colspan",
            "rowspan",
            "hspace",
            "vspace",
        ])
        .add_tag_attributes("a", ["name"])
        .add_tag_attributes("img", ["border"])
        .add_tag_attributes("ol", ["type"])
        .add_tag_attributes("ul", ["type"])
        .add_tag_attributes("li", ["value"])
        .add_url_schemes(["data", "cid"])
        .link_rel(Some("noopener noreferrer"))
        .attribute_filter(move |element, attribute, value| {
            match attribute {
                "src" => {
                    if value.trim_start().to_ascii_lowercase().starts_with("data:") {
                        return allowed_image_data(value).then(|| value.into());
                    }
                    if REMOTE_URL.is_match(value) {
                        flag.store(true, Ordering::Relaxed);
                        if !allow_remote {
                            return Some(BLANK_IMAGE.into());
                        }
                    }
                    Some(value.into())
                }
                "background" => {
                    if REMOTE_URL.is_match(value) {
                        flag.store(true, Ordering::Relaxed);
                        return allow_remote.then(|| value.into());
                    }
                    allowed_image_data(value).then(|| value.into())
                }
                "href" => {
                    // Links may not open documents embedded in the mail.
                    let lower = value.trim_start().to_ascii_lowercase();
                    (!lower.starts_with("data:") && !lower.starts_with("cid:")).then(|| value.into())
                }
                "style" => {
                    if CSS_REMOTE.is_match(value) {
                        flag.store(true, Ordering::Relaxed);
                    }
                    Some(value.into())
                }
                _ => {
                    let _ = element;
                    Some(value.into())
                }
            }
        });
    let body = builder.clean(&html).to_string();

    SanitizedMail { styles, body, body_attributes: body_attributes.join(" "), has_remote: has_remote.load(Ordering::Relaxed) }
}

/// Content Security Policy for documents showing mail content.
pub(crate) fn mail_csp(allow_remote: bool) -> String {
    [
        "default-src 'none'",
        &format!("img-src data: blob:{}", if allow_remote { " https: http:" } else { "" }),
        "style-src 'unsafe-inline'",
        "font-src data:",
        "media-src 'none'",
        "script-src 'none'",
        "frame-src 'none'",
        "form-action 'none'",
        "base-uri 'none'",
    ]
    .join("; ")
}

const BASE_CSS: &str = r#"
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { margin: 0; padding: 16px; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif; color: #1d1d1f; background: #fff; overflow-wrap: break-word; -webkit-font-smoothing: antialiased; }
img { max-width: 100%; }
img:not([height]) { height: auto; }
pre { white-space: pre-wrap; }
a { color: #0a64d8; }
blockquote[type="cite"] { margin: 0 0 0 0.8ex; border-left: 2px solid #c7c7cc; padding-left: 1ex; color: #48484a; }
.pst-text { white-space: pre-wrap; margin: 0; font: inherit; }
.pst-quote { border-left: 2px solid #c7c7cc; padding-left: 0.75em; color: #6e6e73; }
"#;

/// A sanitised, self-contained document for a WebView.
#[derive(uniffi::Record, Clone, Debug)]
pub struct MailDocument {
    pub html: String,
    /// True if the message references remote images or styles.
    pub has_remote: bool,
}

fn document(title_lang: &str, csp: &str, extra_head: &str, body_attributes: &str, body: &str) -> String {
    format!(
        "<!doctype html><html{lang}><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"{csp}\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"color-scheme\" content=\"light\"><style>{BASE_CSS}</style>{extra_head}</head><body {body_attributes}>{body}</body></html>",
        lang = if title_lang.is_empty() { String::new() } else { format!(" lang=\"{}\"", escape_attribute(title_lang)) },
        csp = escape_attribute(csp),
    )
}

/// Sanitises an HTML mail body and wraps it in a locked down document.
/// `extra_css` lets the app adapt fonts and spacing.
pub(crate) fn prepare_mail_document(
    html: &str,
    inline_images: &HashMap<String, String>,
    allow_remote: bool,
    extra_css: &str,
) -> MailDocument {
    let mail = sanitize_mail(html, inline_images, allow_remote);
    let mut head = String::new();
    if !extra_css.is_empty() {
        head.push_str(&format!("<style>{}</style>", STYLE_CLOSE.replace_all(extra_css, "")));
    }
    for css in &mail.styles {
        head.push_str(&format!("<style>{css}</style>"));
    }
    MailDocument { html: document("", &mail_csp(allow_remote), &head, &mail.body_attributes, &mail.body), has_remote: mail.has_remote }
}

static LINK: LazyLock<Regex> = LazyLock::new(|| re(r#"(?i)\b(?:https?://|www\.)[^\s<>"]+|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b"#));

/// Plain text with clickable links, HTML escaped.
pub(crate) fn linkify(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 64);
    let mut last = 0;
    for m in LINK.find_iter(text) {
        let mut link = m.as_str();
        // Trailing punctuation usually belongs to the sentence.
        while let Some(stripped) = link.strip_suffix(['.', ',', ';', ':', '!', '?', ')', ']', '\'']) {
            link = stripped;
        }
        let end = m.start() + link.len();
        out.push_str(&escape_html(&text[last..m.start()]));
        let href = if link.contains('@') && !link.contains("://") {
            format!("mailto:{link}")
        } else if link.to_ascii_lowercase().starts_with("www.") {
            format!("https://{link}")
        } else {
            link.to_string()
        };
        out.push_str(&format!("<a href=\"{}\">{}</a>", escape_attribute(&href), escape_html(link)));
        last = end;
    }
    out.push_str(&escape_html(&text[last..]));
    out
}

/// Plain text as HTML lines with clickable links; quoted lines (starting
/// with ">") get the class `pst-quote`, like in the desktop app.
pub(crate) fn text_to_html(text: &str) -> String {
    text.split('\n')
        .map(|line| {
            let content = if line.trim().is_empty() { "<br>".to_string() } else { linkify(line) };
            if line.trim_start().starts_with('>') {
                format!("<div class=\"pst-quote\">{content}</div>")
            } else {
                format!("<div>{content}</div>")
            }
        })
        .collect()
}

/// A plain text body as document (same look and link handling as HTML mails).
pub(crate) fn prepare_text_document(text: &str, extra_css: &str) -> MailDocument {
    let head = if extra_css.is_empty() { String::new() } else { format!("<style>{}</style>", STYLE_CLOSE.replace_all(extra_css, "")) };
    let body = format!("<div class=\"pst-text\">{}</div>", text_to_html(text));
    MailDocument { html: document("", &mail_csp(false), &head, "", &body), has_remote: false }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_html_to_text() {
        let html = "<html><head><title>T</title><style>p{color:red}</style></head><body><p>Hallo&nbsp;M&uuml;ller,</p><table><tr><td>a</td><td>b</td></tr></table><!-- x --><br>Gr&#252;&szlig;e</body></html>";
        assert_eq!(html_to_text(html), "Hallo Müller,\na b\n\nGrüße");
    }

    #[test]
    fn finds_content_ids() {
        let ids = referenced_content_ids(Some(r#"<img src="cid:Logo%40Example"><img src='cid:<x@y>'>"#));
        assert!(ids.contains("logo@example"));
    }

    #[test]
    fn sanitizes_mail() {
        let html = r##"<html><head><style>.a{color:red}</style></head><body bgcolor="#eee" onload="x()"><p class="a" onclick="evil()">Hi</p><script>alert(1)</script><img src="https://tracker.example/p.gif"><img src="cid:logo@x"><a href="javascript:alert(1)">x</a><form><input></form></body></html>"##;
        let images = HashMap::from([("logo@x".to_string(), "data:image/png;base64,AAAA".to_string())]);
        let mail = sanitize_mail(html, &images, false);
        assert_eq!(mail.styles, vec![".a{color:red}"]);
        assert_eq!(mail.body_attributes, "bgcolor=\"#eee\"");
        assert!(mail.has_remote);
        assert!(!mail.body.contains("script") && !mail.body.contains("onclick") && !mail.body.contains("javascript"));
        assert!(mail.body.contains(BLANK_IMAGE));
        assert!(mail.body.contains("data:image/png;base64,AAAA"));
        assert!(mail.body.contains("class=\"a\""));
        let allowed = sanitize_mail(html, &images, true);
        assert!(allowed.body.contains("https://tracker.example/p.gif"));
    }

    #[test]
    fn marks_quoted_lines() {
        assert_eq!(
            text_to_html("Hallo\n\n> Zitat <b>\nEnde"),
            "<div>Hallo</div><div><br></div><div class=\"pst-quote\">&#62; Zitat &#60;b&#62;</div><div>Ende</div>"
        );
    }

    #[test]
    fn linkifies_text() {
        assert_eq!(
            linkify("Siehe https://example.com/a?b=1. Mail: anna@example.com <x>"),
            "Siehe <a href=\"https://example.com/a?b=1\">https://example.com/a?b=1</a>. Mail: <a href=\"mailto:anna@example.com\">anna@example.com</a> &#60;x&#62;"
        );
    }
}
