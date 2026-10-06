//! Export as RFC 5322 / MIME (.eml), so that a message can be opened in any
//! mail client (port of `worker/eml.ts`, with mail-builder instead of
//! nodemailer's composer). MIME messages are returned unchanged; Outlook
//! items are rebuilt with attachments, inline images and original headers.
//! Nothing is ever sent.

use mail_builder::MessageBuilder;
use mail_builder::headers::address::Address;
use mail_builder::headers::date::Date;
use mail_builder::headers::raw::Raw;
use mail_builder::mime::{BodyPart, MimePart};

use crate::content::{MapiMessage, Resolved};
use crate::error::{CoreError, Result};
use crate::html::referenced_content_ids;
use crate::mapi::tag;
use crate::model::{Mailbox, RecipientKind};

const MAX_DEPTH: usize = 5;

/// Headers that are rebuilt from the message itself and must not be copied.
const REBUILT_HEADERS: [&str; 18] = [
    "from",
    "to",
    "cc",
    "bcc",
    "subject",
    "date",
    "message-id",
    "mime-version",
    "content-type",
    "content-transfer-encoding",
    "content-disposition",
    "content-id",
    "content-description",
    "x-ms-has-attach",
    "x-ms-tnef-correlator",
    // Signatures cover the original encoding and would no longer verify.
    "dkim-signature",
    "arc-seal",
    "arc-message-signature",
];

pub(crate) fn build_eml(message: &Resolved, depth: usize) -> Result<Vec<u8>> {
    match message {
        Resolved::Mime(m) => Ok(m.raw.clone()),
        Resolved::Mapi(m) => compose(m, depth),
    }
}

/// Parses a raw header block, keeping folded values unchanged.
pub(crate) fn parse_headers(raw: &str) -> Vec<(String, String)> {
    let mut headers: Vec<(String, String)> = Vec::new();
    for line in raw.replace("\r\n", "\n").split('\n') {
        if line.starts_with([' ', '\t']) {
            if let Some(last) = headers.last_mut() {
                last.1.push_str("\r\n");
                last.1.push_str(line);
            }
            continue;
        }
        if let Some((key, value)) = line.split_once(':') {
            if !key.is_empty() && key.bytes().all(|b| (b'!'..=b'~').contains(&b)) {
                headers.push((key.to_string(), value.strip_prefix([' ', '\t']).unwrap_or(value).to_string()));
            }
        }
    }
    headers
}

fn file_safe(name: &str) -> String {
    let cleaned: String = name.chars().map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c }).collect();
    cleaned.trim().chars().take(150).collect()
}

fn mailbox_address(m: &Mailbox) -> Address<'static> {
    let name = (!m.name.is_empty() && m.name != m.email).then(|| m.name.clone());
    Address::new_address(name, m.email.clone())
}

fn compose(message: &MapiMessage, depth: usize) -> Result<Vec<u8>> {
    let item = message.item();
    let content = &message.content;
    let original = parse_headers(&item.headers());

    let mut builder = MessageBuilder::new();
    let from = item.sender();
    if !from.email.is_empty() {
        builder = builder.from(mailbox_address(&from));
    } else if !from.name.is_empty() {
        builder = builder.header("From", Raw::new(format!("\"{}\" <>", from.name.replace('"', "'"))));
    }
    for (kind, header) in [(RecipientKind::To, "To"), (RecipientKind::Cc, "Cc"), (RecipientKind::Bcc, "Bcc")] {
        let list: Vec<Address> = message
            .recipients
            .iter()
            .filter(|r| r.kind == kind && !r.email.is_empty())
            .map(|r| mailbox_address(&Mailbox { name: r.name.clone(), email: r.email.clone() }))
            .collect();
        if !list.is_empty() {
            builder = builder.header(header, Address::new_list(list));
        }
    }
    builder = builder.subject(item.subject());
    if let Some(date) = item.sent_date().or(item.received_date()) {
        builder = builder.date(Date::new(date.div_euclid(1000)));
    }
    let message_id = Some(message.props.string(tag::INTERNET_MESSAGE_ID))
        .filter(|id| !id.trim().is_empty())
        .or_else(|| original.iter().find(|(k, _)| k.eq_ignore_ascii_case("message-id")).map(|(_, v)| v.clone()))
        .unwrap_or_default();
    let message_id = message_id.trim().trim_start_matches('<').trim_end_matches('>').to_string();
    if !message_id.is_empty() {
        builder = builder.message_id(message_id);
    }
    for (key, value) in original.iter().filter(|(k, _)| !REBUILT_HEADERS.contains(&k.to_lowercase().as_str())) {
        builder = builder.header(key.clone(), Raw::new(value.clone()));
    }

    // Body: text and HTML as alternatives, inline images next to the HTML.
    let cids = referenced_content_ids(content.html.as_deref());
    let mut inline_parts = Vec::new();
    let mut attachment_parts = Vec::new();
    for att in &content.attachments {
        if att.is_message {
            if depth >= MAX_DEPTH {
                continue;
            }
            let data = if att.is_outlook_item() { att.open_message().and_then(|m| build_eml(&m, depth + 1)) } else { att.read() };
            let Ok(data) = data else { continue };
            let name = Some(file_safe(&att.name)).filter(|n| !n.is_empty()).unwrap_or_else(|| "message".into());
            let file_name = if name.to_lowercase().ends_with(".eml") { name } else { format!("{name}.eml") };
            // message/rfc822 bodies may only use 7bit, 8bit or binary (RFC 2046).
            let encoding = if data.is_ascii() { "7bit" } else { "8bit" };
            attachment_parts
                .push(MimePart::new("message/rfc822", BodyPart::Binary(data.into())).attachment(file_name).transfer_encoding(encoding));
            continue;
        }
        let Ok(data) = att.read() else { continue };
        let mime = if att.mime_type.is_empty() { "application/octet-stream".to_string() } else { att.mime_type.clone() };
        if !att.content_id.is_empty() && cids.contains(&att.content_id) {
            inline_parts.push(MimePart::new(mime, BodyPart::Binary(data.into())).inline().cid(att.content_id.clone()));
        } else {
            attachment_parts.push(MimePart::new(mime, BodyPart::Binary(data.into())).attachment(att.name.clone()));
        }
    }

    let text = (!content.text.is_empty() && (!content.text_derived || content.html.is_none()))
        .then(|| MimePart::new("text/plain", content.text.clone()));
    let html = content.html.clone().map(|html| {
        let html = MimePart::new("text/html", html);
        if inline_parts.is_empty() {
            html
        } else {
            let mut parts = vec![html];
            parts.append(&mut inline_parts);
            MimePart::new("multipart/related", parts)
        }
    });
    let body = match (text, html) {
        (Some(text), Some(html)) => MimePart::new("multipart/alternative", vec![text, html]),
        (Some(text), None) => text,
        (None, Some(html)) => html,
        (None, None) => MimePart::new("text/plain", ""),
    };
    let body = if attachment_parts.is_empty() {
        body
    } else {
        let mut parts = vec![body];
        parts.append(&mut attachment_parts);
        MimePart::new("multipart/mixed", parts)
    };
    builder.body(body).write_to_vec().map_err(|e| CoreError::internal(format!("Cannot build the message: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_header_blocks() {
        let headers = parse_headers("Received: from a\r\n\tby b\r\nSubject: Hi\r\nX-Empty:\r\n");
        assert_eq!(
            headers,
            vec![("Received".into(), "from a\r\n\tby b".into()), ("Subject".into(), "Hi".into()), ("X-Empty".into(), String::new())]
        );
    }
}
