//! MIME messages (.eml, MBOX entries, attached message/rfc822 parts) with
//! mail-parser (the desktop app uses postal-mime).

use std::rc::Rc;

use mail_parser::{Addr, Address, HeaderValue, MessageParser, MimeHeaders, PartType};

use crate::content::{AttachmentBody, ContentAttachment, MessageContent, MimeMessage};
use crate::error::{CoreError, Result};
use crate::html::{html_to_text, normalize_content_id};
use crate::model::{Mailbox, Recipient, RecipientKind, SecurityKind};
use crate::text::{squash, tidy_text};

fn mailboxes(address: Option<&Address>) -> Vec<Mailbox> {
    let to_mailbox = |a: &Addr| {
        let email = a.address.as_deref().unwrap_or_default().trim().to_string();
        let name = squash(a.name.as_deref().unwrap_or_default());
        Mailbox { name: if name.is_empty() { email.clone() } else { name }, email }
    };
    match address {
        Some(Address::List(list)) => list.iter().map(to_mailbox).collect(),
        Some(Address::Group(groups)) => groups.iter().flat_map(|g| g.addresses.iter().map(to_mailbox)).collect(),
        None => Vec::new(),
    }
}

/// Position after the header block (start of the body), if any.
pub(crate) fn header_end(data: &[u8]) -> Option<usize> {
    let crlf = find(data, b"\r\n\r\n").map(|i| i + 4);
    let lf = find(data, b"\n\n").map(|i| i + 2);
    match (crlf, lf) {
        (Some(a), Some(b)) => Some(a.min(b)),
        (a, b) => a.or(b),
    }
}

pub(crate) fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack.windows(needle.len()).position(|w| w == needle)
}

fn header_text(message: &mail_parser::Message, name: &str) -> String {
    message.header(name).and_then(HeaderValue::as_text).unwrap_or_default().to_string()
}

/// Importance from Importance/X-Priority/Priority headers: 2 high, 0 low, 1 normal.
pub(crate) fn importance_from_headers(importance: &str, x_priority: &str, priority: &str) -> i64 {
    let value = format!("{importance} {x_priority} {priority}").to_lowercase();
    let words: Vec<&str> = value.split(|c: char| !c.is_alphanumeric() && c != '-').filter(|w| !w.is_empty()).collect();
    if words.iter().any(|w| matches!(*w, "high" | "urgent" | "1" | "2")) {
        2
    } else if words.iter().any(|w| matches!(*w, "low" | "non-urgent" | "4" | "5")) {
        0
    } else {
        1
    }
}

/// Parses a MIME message.
pub(crate) fn parse_mime(raw: Vec<u8>) -> Result<MimeMessage> {
    let parser = MessageParser::default();
    let message = parser.parse(&raw).ok_or_else(|| CoreError::read_failed("Not a valid e-mail message"))?;

    let content_type =
        message.content_type().map(|ct| format!("{}/{}", ct.ctype(), ct.subtype().unwrap_or_default()).to_lowercase()).unwrap_or_default();
    let security = if content_type == "multipart/signed" {
        Some(SecurityKind::Signed)
    } else if content_type == "application/pkcs7-mime" || content_type == "application/x-pkcs7-mime" {
        Some(SecurityKind::Encrypted)
    } else {
        None
    };

    // Only real HTML and text parts count (mail-parser converts between them).
    let html_parts: Vec<String> = message
        .html_body
        .iter()
        .filter_map(|id| message.part(*id))
        .filter_map(|p| if let PartType::Html(html) = &p.body { Some(html.to_string()) } else { None })
        .collect();
    let text_parts: Vec<String> = message
        .text_body
        .iter()
        .filter_map(|id| message.part(*id))
        .filter_map(|p| if let PartType::Text(text) = &p.body { Some(text.to_string()) } else { None })
        .collect();
    let html = (!html_parts.is_empty()).then(|| html_parts.join("\n"));
    let mut text = tidy_text(&text_parts.join("\n"));
    let text_derived = text.is_empty() && html.is_some();
    if text_derived {
        text = html_to_text(html.as_deref().unwrap_or_default());
    }

    let attachments = message
        .attachments()
        .filter(|part| {
            let mime = part
                .content_type()
                .map(|ct| format!("{}/{}", ct.ctype(), ct.subtype().unwrap_or_default()).to_lowercase())
                .unwrap_or_default();
            mime != "application/pkcs7-signature" && mime != "application/x-pkcs7-signature"
        })
        .enumerate()
        .map(|(i, part)| {
            let mut mime = part
                .content_type()
                .map(|ct| format!("{}/{}", ct.ctype(), ct.subtype().unwrap_or("octet-stream")).to_lowercase())
                .unwrap_or_else(|| "application/octet-stream".to_string());
            let is_message = matches!(part.body, PartType::Message(_)) || mime == "message/rfc822";
            if is_message {
                mime = "message/rfc822".to_string();
            }
            let data = part.contents().to_vec();
            let fallback = if is_message {
                part.message().and_then(|m| m.subject()).map(str::to_string).unwrap_or_else(|| format!("message-{}.eml", i + 1))
            } else {
                format!("attachment-{}", i + 1)
            };
            let name = part.attachment_name().map(str::to_string).filter(|n| !n.trim().is_empty()).unwrap_or(fallback);
            ContentAttachment {
                name: crate::content::with_extension(&name, &mime, is_message),
                size: data.len() as i64,
                mime_type: mime,
                content_id: normalize_content_id(part.content_id().unwrap_or_default()),
                hidden: false,
                is_message,
                body: AttachmentBody::Bytes(Rc::new(data)),
            }
        })
        .collect();

    let from = mailboxes(message.from()).into_iter().next().unwrap_or_default();
    let sender =
        mailboxes(message.sender()).into_iter().next().filter(|s| !s.email.is_empty() && !s.email.eq_ignore_ascii_case(&from.email));
    let mut recipients: Vec<Recipient> = Vec::new();
    for (list, kind) in [(message.to(), RecipientKind::To), (message.cc(), RecipientKind::Cc), (message.bcc(), RecipientKind::Bcc)] {
        recipients.extend(mailboxes(list).into_iter().map(|m| Recipient { name: m.name, email: m.email, kind }));
    }
    let headers = header_end(&raw).map(|end| String::from_utf8_lossy(&raw[..end]).trim_end().to_string()).unwrap_or_default();
    let importance = importance_from_headers(
        &header_text(&message, "Importance"),
        &header_text(&message, "X-Priority"),
        &header_text(&message, "Priority"),
    );

    let result = MimeMessage {
        subject: message.subject().unwrap_or_default().to_string(),
        from,
        sender,
        reply_to: mailboxes(message.reply_to()),
        recipients,
        date: message.date().map_or(0, |d| d.to_timestamp() * 1000),
        importance,
        headers,
        content: MessageContent { html, text, text_derived, attachments, security },
        raw: Vec::new(),
    };
    drop(message);
    Ok(MimeMessage { raw, ..result })
}

#[cfg(test)]
mod tests {
    use super::*;

    const MAIL: &str = "From: =?UTF-8?Q?Anna_M=C3=BCller?= <anna@example.com>\r\nTo: Bob <bob@example.com>, team: carl@example.com, dora@example.com;\r\nSubject: =?UTF-8?Q?Gr=C3=BC=C3=9Fe?=\r\nDate: Sat, 01 Mar 2025 10:00:00 +0000\r\nX-Priority: 1\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"b1\"\r\n\r\n--b1\r\nContent-Type: multipart/related; boundary=\"b2\"\r\n\r\n--b2\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Hallo <img src=\"cid:logo@x\"></p>\r\n--b2\r\nContent-Type: image/png\r\nContent-ID: <Logo@X>\r\nContent-Transfer-Encoding: base64\r\n\r\niVBORw0KGgo=\r\n--b2--\r\n--b1\r\nContent-Type: application/pdf; name=\"rechnung.pdf\"\r\nContent-Disposition: attachment; filename=\"rechnung.pdf\"\r\nContent-Transfer-Encoding: base64\r\n\r\nJVBERi0xLjQ=\r\n--b1\r\nContent-Type: message/rfc822\r\n\r\nFrom: x@example.com\r\nSubject: Innen\r\n\r\nText\r\n--b1--\r\n";

    #[test]
    fn parses_messages() {
        let m = parse_mime(MAIL.as_bytes().to_vec()).unwrap();
        assert_eq!(m.subject, "Grüße");
        assert_eq!(m.from, Mailbox { name: "Anna Müller".into(), email: "anna@example.com".into() });
        assert_eq!(
            m.recipients.iter().map(|r| r.email.as_str()).collect::<Vec<_>>(),
            vec!["bob@example.com", "carl@example.com", "dora@example.com"]
        );
        assert_eq!(m.date, 1_740_823_200_000);
        assert_eq!(m.importance, 2);
        assert!(m.content.html.as_deref().unwrap().contains("Hallo"));
        assert!(m.content.text_derived);
        assert_eq!(m.content.text, "Hallo");
        let names: Vec<_> = m.content.attachments.iter().map(|a| (a.name.as_str(), a.content_id.as_str(), a.is_message)).collect();
        assert_eq!(names, vec![("attachment-1.png", "logo@x", false), ("rechnung.pdf", "", false), ("Innen", "", true)]);
        let inner = m.content.attachments[2].open_message().unwrap();
        assert!(matches!(inner, crate::content::Resolved::Mime(ref i) if i.subject == "Innen"));
        assert!(m.headers.starts_with("From:") && m.headers.ends_with("boundary=\"b1\""));
    }

    #[test]
    fn importance() {
        assert_eq!(importance_from_headers("", "3 (Normal)", ""), 1);
        assert_eq!(importance_from_headers("high", "", ""), 2);
        assert_eq!(importance_from_headers("", "5 (Lowest)", ""), 0);
    }
}
