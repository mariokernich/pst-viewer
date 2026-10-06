//! Loaded messages: body, attachments and the fields of the reading pane
//! (port of `worker/content.ts`).
//!
//! Everything in here lives on the archive's worker thread; PST handles are
//! reference counted with `Rc`.

use std::rc::Rc;

use crate::error::{CoreError, Result};
use crate::mapi::{NamedMap, PropBag};
use crate::model::{Mailbox, Recipient, SecurityKind};

/// Where an attachment's content comes from.
#[derive(Clone)]
pub(crate) enum AttachmentBody {
    /// Bytes of a MIME part (also attached .eml messages).
    Bytes(Rc<Vec<u8>>),
    /// A file attached to a PST message, read on demand.
    PstData(crate::pst::PstAttachmentRef),
    /// An Outlook item attached to a PST message.
    PstEmbedded(crate::pst::PstAttachmentRef),
    /// A stream of a .msg file.
    MsgData(Rc<crate::msg::MsgFile>, String),
    /// An Outlook item attached to a .msg file (storage path).
    MsgEmbedded(Rc<crate::msg::MsgFile>, String),
    /// Attachments by reference and other kinds without content.
    Missing,
}

#[derive(Clone)]
pub(crate) struct ContentAttachment {
    pub name: String,
    pub size: i64,
    pub mime_type: String,
    /// Lower case, without angle brackets.
    pub content_id: String,
    pub hidden: bool,
    pub is_message: bool,
    pub body: AttachmentBody,
}

impl ContentAttachment {
    /// The attachment's bytes. Attached Outlook items have no bytes of their
    /// own; they are opened with `open_message` (and exported as .eml).
    pub fn read(&self) -> Result<Vec<u8>> {
        match &self.body {
            AttachmentBody::Bytes(bytes) => Ok(bytes.as_ref().clone()),
            AttachmentBody::PstData(r) => r.read_data(),
            AttachmentBody::MsgData(file, stream) => file.read_stream(stream),
            AttachmentBody::PstEmbedded(_) | AttachmentBody::MsgEmbedded(..) => Err(CoreError::internal("attached item has no file data")),
            AttachmentBody::Missing => Ok(Vec::new()),
        }
    }

    /// Opens an attached message (Outlook item or .eml).
    pub fn open_message(&self) -> Result<Resolved> {
        match &self.body {
            AttachmentBody::PstEmbedded(r) => r.open_embedded().map(Resolved::Mapi),
            AttachmentBody::MsgEmbedded(file, storage) => crate::msg::load_message(file, storage, true).map(Resolved::Mapi),
            AttachmentBody::Bytes(bytes) if self.is_message => {
                if bytes.is_empty() {
                    return Err(CoreError::not_found("The attached message is empty"));
                }
                Ok(Resolved::Mime(crate::mime::parse_mime(bytes.as_ref().clone())?))
            }
            _ => Err(CoreError::not_found("The attachment is not a message")),
        }
    }

    /// True for attached Outlook items (as opposed to attached .eml files).
    pub fn is_outlook_item(&self) -> bool {
        matches!(self.body, AttachmentBody::PstEmbedded(_) | AttachmentBody::MsgEmbedded(..))
    }
}

#[derive(Clone)]
pub(crate) struct MessageContent {
    pub html: Option<String>,
    /// Plain text body, or text derived from the HTML body.
    pub text: String,
    /// True if the plain text was not stored but derived from the HTML.
    pub text_derived: bool,
    pub attachments: Vec<ContentAttachment>,
    pub security: Option<SecurityKind>,
}

/// An Outlook item from a PST or .msg file.
pub(crate) struct MapiMessage {
    pub props: PropBag,
    pub named: Rc<NamedMap>,
    pub recipients: Vec<Recipient>,
    pub content: MessageContent,
}

impl MapiMessage {
    pub fn item(&self) -> crate::mapi::MapiItem<'_> {
        crate::mapi::MapiItem { props: &self.props, named: &self.named }
    }
}

/// A MIME message (.eml, MBOX entry, attached message/rfc822).
pub(crate) struct MimeMessage {
    pub raw: Vec<u8>,
    pub subject: String,
    pub from: Mailbox,
    pub sender: Option<Mailbox>,
    pub reply_to: Vec<Mailbox>,
    pub recipients: Vec<Recipient>,
    pub date: i64,
    pub importance: i64,
    /// The raw header block.
    pub headers: String,
    pub content: MessageContent,
}

pub(crate) enum Resolved {
    Mapi(MapiMessage),
    Mime(MimeMessage),
}

impl Resolved {
    pub fn content(&self) -> &MessageContent {
        match self {
            Resolved::Mapi(m) => &m.content,
            Resolved::Mime(m) => &m.content,
        }
    }
}

/// Body and security of an Outlook item. S/MIME signed messages are unwrapped
/// so that their actual content and attachments become visible.
pub(crate) fn mapi_content(message: &MapiMessage) -> MessageContent {
    let item = message.item();
    let class = item.message_class();
    let attachments = message.content.attachments.clone();
    let mut security = None;
    if class.to_uppercase().starts_with("IPM.NOTE.SMIME") {
        let signed_part = attachments.iter().find(|a| {
            let mime = a.mime_type.as_str();
            mime == "multipart/signed"
                || mime == "application/pkcs7-mime"
                || mime == "application/x-pkcs7-mime"
                || a.name.to_lowercase().ends_with(".p7m")
        });
        if class.to_uppercase().contains("MULTIPARTSIGNED") || signed_part.is_some_and(|p| p.mime_type == "multipart/signed") {
            security = Some(SecurityKind::Signed);
            if let Some(Ok(data)) = signed_part.map(ContentAttachment::read) {
                if !data.is_empty() {
                    if let Ok(mime) = crate::mime::parse_mime(data) {
                        return MessageContent { security, ..mime.content };
                    }
                }
            }
        } else {
            security = Some(SecurityKind::Encrypted);
        }
    }
    let body = item.body();
    MessageContent { html: body.html, text: body.text, text_derived: body.text_derived, attachments, security }
}

/// Maximum depth of attached messages that are followed.
pub(crate) const MAX_NESTING: usize = 8;

/// Follows attachment indices from a message into attached messages.
pub(crate) fn follow_path(message: Resolved, path: &[u32]) -> Result<Resolved> {
    if path.len() > MAX_NESTING {
        return Err(CoreError::not_found("Nesting too deep"));
    }
    let mut resolved = message;
    for &index in path {
        let attachment = resolved
            .content()
            .attachments
            .get(index as usize)
            .filter(|a| a.is_message)
            .cloned()
            .ok_or_else(|| CoreError::not_found(format!("Attachment {index} is not a message")))?;
        resolved = attachment.open_message()?;
    }
    Ok(resolved)
}

/// `name`, or the fallback if it is blank.
pub(crate) fn name_or(name: &str, fallback: impl FnOnce() -> String) -> String {
    if name.trim().is_empty() { fallback() } else { name.to_string() }
}

/// Adds a file extension derived from the MIME type to names without one.
/// Attached messages keep their subject as name.
pub(crate) fn with_extension(name: &str, mime_type: &str, is_message: bool) -> String {
    let clean: String = name.chars().filter(|c| !c.is_control()).collect::<String>().trim().to_string();
    if is_message {
        return clean;
    }
    let has_extension =
        clean.rsplit_once('.').is_some_and(|(_, ext)| (1..=8).contains(&ext.len()) && ext.chars().all(|c| c.is_ascii_alphanumeric()));
    if has_extension {
        return clean;
    }
    let ext = match mime_type {
        "image/png" => ".png",
        "image/jpeg" | "image/jpg" => ".jpg",
        "image/gif" => ".gif",
        "image/webp" => ".webp",
        "image/bmp" => ".bmp",
        "image/svg+xml" => ".svg",
        "image/tiff" => ".tif",
        "application/pdf" => ".pdf",
        "text/plain" => ".txt",
        "text/html" => ".html",
        "text/calendar" | "application/ics" => ".ics",
        "text/vcard" | "text/x-vcard" => ".vcf",
        "application/zip" => ".zip",
        "message/rfc822" => ".eml",
        _ => "",
    };
    format!("{clean}{ext}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_extensions() {
        assert_eq!(with_extension("bild", "image/png", false), "bild.png");
        assert_eq!(with_extension("Rechnung.PDF", "application/pdf", false), "Rechnung.PDF");
        assert_eq!(with_extension("Weitergeleitet: Angebot", "message/rfc822", true), "Weitergeleitet: Angebot");
        assert_eq!(with_extension("v1.2 notes", "text/plain", false), "v1.2 notes.txt");
    }
}
