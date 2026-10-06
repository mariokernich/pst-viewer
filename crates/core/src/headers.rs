//! List information from message headers, used to show MBOX and EML
//! messages before their full content is indexed (port of
//! `worker/headers.ts`, with mail-parser for RFC 2047 decoding).

use mail_parser::{Address, HeaderForm, HeaderValue, MessageParser, MimeHeaders};

use crate::mime::importance_from_headers;
use crate::model::Mailbox;
use crate::text::squash;

#[derive(Clone, Debug, Default)]
pub(crate) struct HeaderMeta {
    pub subject: String,
    pub from: Mailbox,
    pub to: Vec<Mailbox>,
    pub cc: Vec<Mailbox>,
    pub bcc: Vec<Mailbox>,
    pub date: i64,
    pub is_read: bool,
    pub flagged: bool,
    pub importance: i64,
    pub has_attachments: bool,
    /// Gmail labels (Google Takeout), decoded.
    pub labels: Vec<String>,
}

fn mailboxes(address: Option<&Address>) -> Vec<Mailbox> {
    let list: Vec<&mail_parser::Addr> = match address {
        Some(Address::List(list)) => list.iter().collect(),
        Some(Address::Group(groups)) => groups.iter().flat_map(|g| g.addresses.iter()).collect(),
        None => Vec::new(),
    };
    list.into_iter()
        .map(|a| Mailbox {
            name: squash(a.name.as_deref().unwrap_or_default()),
            email: a.address.as_deref().unwrap_or_default().trim().to_string(),
        })
        .filter(|m| !m.name.is_empty() || !m.email.is_empty())
        .collect()
}

fn text(message: &mail_parser::Message, name: &str) -> String {
    match message.header(name) {
        Some(HeaderValue::Text(t)) => t.to_string(),
        Some(HeaderValue::TextList(list)) => list.join(", "),
        _ => String::new(),
    }
}

/// Extracts list information from the header block at the start of `data`.
pub(crate) fn header_meta(data: &[u8]) -> HeaderMeta {
    let parser = MessageParser::default();
    let Some(message) = parser.parse_headers(data) else {
        return HeaderMeta { is_read: true, importance: 1, ..HeaderMeta::default() };
    };

    let from = mailboxes(message.from()).into_iter().next().or_else(|| mailboxes(message.sender()).into_iter().next()).unwrap_or_default();

    // Read and flag state as stored by Thunderbird, Apple Mail and others.
    let mut is_read = true;
    let mut flagged = false;
    let mozilla = text(&message, "X-Mozilla-Status");
    let mozilla = mozilla.trim();
    if mozilla.len() == 4 && mozilla.chars().all(|c| c.is_ascii_hexdigit()) {
        let bits = u32::from_str_radix(mozilla, 16).unwrap_or(1);
        is_read = bits & 0x0001 != 0;
        flagged = bits & 0x0004 != 0;
    } else if message.header("Status").is_some() {
        is_read = text(&message, "Status").contains('R');
    }
    if text(&message, "X-Status").contains('F') {
        flagged = true;
    }

    let content_type =
        message.content_type().map(|ct| format!("{}/{}", ct.ctype(), ct.subtype().unwrap_or_default()).to_lowercase()).unwrap_or_default();
    let labels = message
        .header_as("X-Gmail-Labels", HeaderForm::Text)
        .into_iter()
        .filter_map(|v| v.as_text().map(str::to_string))
        .flat_map(|v| split_labels(&v))
        .collect();

    HeaderMeta {
        subject: message.subject().map(squash).unwrap_or_default(),
        from: Mailbox { name: if from.name.is_empty() { from.email.clone() } else { from.name }, email: from.email },
        to: mailboxes(message.to()),
        cc: mailboxes(message.cc()),
        bcc: mailboxes(message.bcc()),
        date: message.date().map_or(0, |d| d.to_timestamp() * 1000),
        is_read,
        flagged,
        importance: importance_from_headers(&text(&message, "Importance"), &text(&message, "X-Priority"), &text(&message, "Priority")),
        has_attachments: content_type == "multipart/mixed",
        labels,
    }
}

/// Splits a Gmail label list; labels containing commas are quoted.
pub(crate) fn split_labels(value: &str) -> Vec<String> {
    let mut labels = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for c in value.chars() {
        match c {
            '"' => quoted = !quoted,
            ',' if !quoted => {
                if !current.trim().is_empty() {
                    labels.push(current.trim().to_string());
                }
                current.clear();
            }
            c => current.push(c),
        }
    }
    if !current.trim().is_empty() {
        labels.push(current.trim().to_string());
    }
    labels
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_list_information() {
        let headers = b"From: =?UTF-8?Q?J=C3=BCrgen?= <j@example.com>\r\nTo: a@example.com, B <b@example.com>\r\nSubject: =?ISO-8859-1?Q?Gr=FC=DFe?=\r\n  aus Bonn\r\nDate: Sat, 01 Mar 2025 10:00:00 +0100\r\nX-Mozilla-Status: 0005\r\nX-Gmail-Labels: Posteingang,\"Kunden, alt\",=?UTF-8?Q?Ge=C3=B6ffnet?=\r\nContent-Type: multipart/mixed; boundary=x\r\n\r\nbody";
        let meta = header_meta(headers);
        assert_eq!(meta.subject, "Grüße aus Bonn");
        assert_eq!(meta.from, Mailbox { name: "Jürgen".into(), email: "j@example.com".into() });
        assert_eq!(meta.to.len(), 2);
        assert_eq!(meta.date, 1_740_819_600_000);
        assert!(meta.is_read && meta.flagged && meta.has_attachments);
        assert_eq!(meta.labels, vec!["Posteingang", "Kunden, alt", "Geöffnet"]);
    }

    #[test]
    fn status_headers() {
        assert!(!header_meta(b"Subject: x\nStatus: O\n\n").is_read);
        assert!(header_meta(b"Subject: x\nStatus: RO\n\n").is_read);
        assert!(header_meta(b"Subject: x\n\n").is_read);
    }
}
