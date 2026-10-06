//! Documents for exporting and printing a single message (port of
//! `renderer/src/lib/exportDocument.ts`): a self-contained, sanitised HTML
//! page that the app renders to PDF or prints, and a plain text version.
//! Labels and formatted values of the header rows come from the app, which
//! owns localisation and date formatting.

use std::collections::HashMap;

use crate::html::{escape_attribute, escape_html, mail_csp, sanitize_mail};
use crate::time::local_parts;

#[derive(uniffi::Record, Clone, Debug)]
pub struct HeaderRow {
    /// Empty for continuation rows (e.g. "on behalf of …").
    pub label: String,
    pub value: String,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct PrintInput {
    /// Language of the document ("de", "en").
    pub lang: String,
    /// Subject, or the localised "(no subject)".
    pub subject: String,
    pub rows: Vec<HeaderRow>,
    pub html: Option<String>,
    pub text: String,
    pub inline_images: HashMap<String, String>,
    /// Remote images may be loaded (the user allowed them for this message).
    pub allow_remote: bool,
}

const PRINT_CSS: &str = r#"
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 10.5pt/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1d1d1f; background: #fff; overflow-wrap: break-word; }
img { max-width: 100%; }
img:not([height]) { height: auto; }
pre { white-space: pre-wrap; }
table { max-width: 100%; }
blockquote[type="cite"] { margin: 0 0 0 0.8ex; border-left: 2px solid #c7c7cc; padding-left: 1ex; color: #48484a; }
"#;

/// A complete, sanitised HTML document of a message for PDF export and printing.
pub fn build_print_document(input: PrintInput) -> String {
    let rows: String = input
        .rows
        .iter()
        .filter(|r| !r.value.trim().is_empty())
        .map(|r| {
            format!(
                "<tr><th style=\"text-align:left;vertical-align:top;padding:1.5pt 12pt 1.5pt 0;width:1%;white-space:nowrap;font-weight:500;color:#6e6e73;border:0\">{}</th><td style=\"padding:1.5pt 0;border:0;color:#1d1d1f\">{}</td></tr>",
                escape_html(&r.label),
                escape_html(r.value.trim())
            )
        })
        .collect();
    let head = format!(
        "<header style=\"margin:0 0 14pt;padding:0;font:10pt/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f\"><h1 style=\"margin:0 0 9pt;padding:0;font-size:16pt;line-height:1.25;font-weight:700;color:#1d1d1f;letter-spacing:-0.01em\">{}</h1><table style=\"border-collapse:collapse;border:0;margin:0;width:100%;font-size:9.5pt;line-height:1.45\">{rows}</table><div style=\"height:0;border-top:0.75pt solid #d2d2d7;margin:12pt 0 0\"></div></header>",
        escape_html(&input.subject)
    );

    let mut styles = String::new();
    let body = match &input.html {
        Some(html) if !input.text.trim().is_empty() || html.to_lowercase().contains("<img") => {
            let mail = sanitize_mail(html, &input.inline_images, input.allow_remote);
            for css in &mail.styles {
                styles.push_str(&format!("<style>{css}</style>"));
            }
            format!("<div class=\"pst-mail-body\" {}>{}</div>", mail.body_attributes, mail.body)
        }
        _ if !input.text.trim().is_empty() => format!(
            "<div style=\"white-space:pre-wrap;font:10.5pt/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif\">{}</div>",
            escape_html(&input.text)
        ),
        _ => String::new(),
    };

    format!(
        "<!doctype html><html lang=\"{lang}\"><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"{csp}\"><title>{title}</title><style>{PRINT_CSS}</style>{styles}</head><body>{head}{body}</body></html>",
        lang = escape_attribute(&input.lang),
        csp = escape_attribute(&mail_csp(input.allow_remote)),
        title = escape_html(&input.subject),
    )
}

/// Plain text version of a message with its header fields.
pub fn build_export_text(subject_label: String, subject: String, rows: Vec<HeaderRow>, text: String) -> String {
    let rows: Vec<&HeaderRow> = rows.iter().filter(|r| !r.value.trim().is_empty()).collect();
    let width = rows.iter().map(|r| r.label.chars().count()).max().unwrap_or(0).max(subject_label.chars().count());
    let line = |label: &str, value: &str| -> String {
        let prefix = if label.is_empty() { String::new() } else { format!("{label}:") };
        format!("{prefix:<pad$}{value}", pad = width + 2)
    };
    let mut header = vec![line(&subject_label, &subject)];
    header.extend(rows.iter().map(|r| line(&r.label, r.value.trim())));
    format!("{}\n\n{}\n\n{}\n", header.join("\n"), "-".repeat(60), text.trim())
}

/// Suggested file name without extension, e.g. "2026-01-26 Quarterly report".
pub fn export_base_name(subject: String, date: i64, no_subject: String) -> String {
    let prefix = if date > 0 {
        let p = local_parts(date);
        format!("{:04}-{:02}-{:02} ", p.year, p.month0 + 1, p.day)
    } else {
        String::new()
    };
    let subject = if subject.trim().is_empty() { no_subject.replace(['(', ')'], "") } else { subject };
    let subject = crate::text::squash(&subject.split(':').map(str::trim).collect::<Vec<_>>().join(" - "));
    let name: String = format!("{prefix}{subject}").chars().take(120).collect();
    crate::files::sanitize_file_name(&name, "message")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_text_export() {
        let rows = vec![
            HeaderRow { label: "Von".into(), value: "Anna <anna@example.com>".into() },
            HeaderRow { label: "An".into(), value: "".into() },
        ];
        let text = build_export_text("Betreff".into(), "Hallo".into(), rows, " Text \n".into());
        assert_eq!(text, format!("Betreff: Hallo\nVon:     Anna <anna@example.com>\n\n{}\n\nText\n", "-".repeat(60)));
    }

    #[test]
    fn builds_print_documents() {
        let doc = build_print_document(PrintInput {
            lang: "de".into(),
            subject: "Q3 <Bericht>".into(),
            rows: vec![HeaderRow { label: "Von".into(), value: "Anna".into() }],
            html: Some("<p onclick=x>Hallo</p><script>x</script>".into()),
            text: "Hallo".into(),
            inline_images: HashMap::new(),
            allow_remote: false,
        });
        assert!(doc.contains("<h1") && doc.contains("Q3 &#60;Bericht&#62;") && doc.contains("<p>Hallo</p>"));
        assert!(!doc.contains("script>x") && !doc.contains("onclick"));
    }

    #[test]
    fn base_names() {
        assert_eq!(export_base_name("Re: Angebot".into(), 0, "(Kein Betreff)".into()), "Re - Angebot");
        assert_eq!(export_base_name("".into(), 0, "(Kein Betreff)".into()), "Kein Betreff");
    }
}
