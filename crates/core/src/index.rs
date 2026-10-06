//! The in-memory item list used for listing and searching (port of
//! `worker/archive.ts` and `worker/attachmentTypes.ts`).

use std::collections::HashMap;
use std::sync::LazyLock;

use regex::Regex;

use crate::model::{AttachmentType, Importance, ItemKind, MessageSummary, SecurityKind, SenderSuggestion};
use crate::text::{fold_for_index, squash, truncate_bytes, truncate_chars};

/// Characters of the body shown as preview in the message list.
pub(crate) const PREVIEW_LENGTH: usize = 240;
/// Upper bound of indexed body text per item, protects against huge items.
pub(crate) const MAX_BODY_INDEX_BYTES: usize = 512 * 1024;

/// An item as kept in memory for listing and searching.
#[derive(Clone, Debug)]
pub(crate) struct IndexedItem {
    pub id: u32,
    pub folder_id: u32,
    /// Additional folders the item appears in (e.g. Gmail labels).
    pub extra_folder_ids: Vec<u32>,
    pub kind: ItemKind,
    pub message_class: String,
    pub subject: String,
    pub from_name: String,
    pub from_email: String,
    pub to_line: String,
    pub date: i64,
    pub size: i64,
    pub attachment_count: u32,
    pub is_read: bool,
    pub importance: Importance,
    pub flagged: bool,
    pub security: Option<SecurityKind>,
    pub preview: String,
    /// Bit mask of attachment categories (see `attachment_type_bit`).
    pub attachment_kinds: u8,
    /// False while only list data is known (body not indexed yet).
    pub indexed: bool,
    // Folded search fields (see `text::fold_for_index`).
    pub s_subject: String,
    pub s_from: String,
    pub s_to: String,
    pub s_body: String,
    pub s_attach: String,
}

impl IndexedItem {
    pub fn new(kind: ItemKind, message_class: String) -> Self {
        Self {
            id: 0,
            folder_id: 0,
            extra_folder_ids: Vec::new(),
            kind,
            message_class,
            subject: String::new(),
            from_name: String::new(),
            from_email: String::new(),
            to_line: String::new(),
            date: 0,
            size: 0,
            attachment_count: 0,
            is_read: true,
            importance: Importance::Normal,
            flagged: false,
            security: None,
            preview: String::new(),
            attachment_kinds: 0,
            indexed: false,
            s_subject: String::new(),
            s_from: String::new(),
            s_to: String::new(),
            s_body: String::new(),
            s_attach: String::new(),
        }
    }

    pub fn set_subject(&mut self, subject: String) {
        self.s_subject = fold_for_index(&subject);
        self.subject = subject;
    }

    pub fn set_from(&mut self, name: String, email: String) {
        self.s_from = fold_for_index(&format!("{name} {email}"));
        self.from_name = name;
        self.from_email = email;
    }

    /// Body text for the preview and the full-text index.
    pub fn set_body(&mut self, text: &str) {
        let text = truncate_bytes(text, MAX_BODY_INDEX_BYTES);
        self.preview = truncate_chars(&squash(truncate_chars(text, PREVIEW_LENGTH * 2)), PREVIEW_LENGTH).to_string();
        self.s_body = fold_for_index(text);
    }

    pub fn summary(&self, preview: Option<String>) -> MessageSummary {
        MessageSummary {
            id: self.id,
            folder_id: self.folder_id,
            kind: self.kind,
            message_class: self.message_class.clone(),
            subject: self.subject.clone(),
            from_name: self.from_name.clone(),
            from_email: self.from_email.clone(),
            to_line: self.to_line.clone(),
            date: self.date,
            size: self.size,
            attachment_count: self.attachment_count,
            is_read: self.is_read,
            importance: self.importance,
            flagged: self.flagged,
            security: self.security,
            preview: preview.unwrap_or_else(|| self.preview.clone()),
        }
    }
}

/// Senders ordered by frequency (for suggestions), at most 5000.
pub(crate) fn collect_senders(items: &[IndexedItem]) -> Vec<SenderSuggestion> {
    let mut senders: HashMap<String, SenderSuggestion> = HashMap::new();
    let mut order: Vec<String> = Vec::new();
    for item in items {
        if item.from_email.is_empty() && item.from_name.is_empty() {
            continue;
        }
        let key = if item.from_email.is_empty() { &item.from_name } else { &item.from_email }.to_lowercase();
        match senders.get_mut(&key) {
            Some(entry) => entry.count += 1,
            None => {
                order.push(key.clone());
                senders.insert(key, SenderSuggestion { name: item.from_name.clone(), email: item.from_email.clone(), count: 1 });
            }
        }
    }
    let mut list: Vec<SenderSuggestion> = order.into_iter().filter_map(|key| senders.remove(&key)).collect();
    // Stable: equally frequent senders keep their first-seen order.
    list.sort_by_key(|s| std::cmp::Reverse(s.count));
    list.truncate(5000);
    list
}

pub(crate) fn attachment_type_bit(kind: AttachmentType) -> u8 {
    match kind {
        AttachmentType::Pdf => 1,
        AttachmentType::Image => 2,
        AttachmentType::Office => 4,
        AttachmentType::Archive => 8,
        AttachmentType::Calendar => 16,
        AttachmentType::Message => 32,
    }
}

static OFFICE_EXT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)\.(docx?|docm|dotx?|xlsx?|xlsm|xlsb|xltx?|csv|pptx?|pptm|ppsx?|potx?|odt|ods|odp|rtf|pages|numbers|key|vsdx?|one|pub)$",
    )
    .unwrap()
});
static IMAGE_EXT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\.(png|jpe?g|gif|bmp|tiff?|webp|heic|heif|svg|ico)$").unwrap());
static ARCHIVE_EXT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\.(zip|rar|7z|gz|tgz|tar|bz2|xz|cab)$").unwrap());
static CALENDAR_EXT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\.(ics|vcs)$").unwrap());
static MESSAGE_EXT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\.(msg|eml)$").unwrap());
static ARCHIVE_MIME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"zip|x-rar|x-7z|gzip|x-tar").unwrap());
static OFFICE_MIME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"officedocument|msword|ms-excel|ms-powerpoint|opendocument").unwrap());

/// The attachment category bit of a file (0 for other files).
pub(crate) fn classify_attachment(name: &str, mime_type: &str, is_message: bool) -> u8 {
    use AttachmentType::*;
    let bit = if is_message || MESSAGE_EXT.is_match(name) || mime_type == "message/rfc822" {
        Message
    } else if name.to_lowercase().ends_with(".pdf") || mime_type == "application/pdf" {
        Pdf
    } else if IMAGE_EXT.is_match(name) || mime_type.starts_with("image/") {
        Image
    } else if CALENDAR_EXT.is_match(name) || mime_type == "text/calendar" || mime_type == "application/ics" {
        Calendar
    } else if ARCHIVE_EXT.is_match(name) || ARCHIVE_MIME.is_match(mime_type) {
        Archive
    } else if OFFICE_EXT.is_match(name) || OFFICE_MIME.is_match(mime_type) {
        Office
    } else {
        return 0;
    };
    attachment_type_bit(bit)
}

/// Kind of an Outlook item from its message class.
pub(crate) fn kind_of(message_class: &str) -> ItemKind {
    let c = message_class.to_uppercase();
    if c.starts_with("IPM.SCHEDULE.MEETING") {
        ItemKind::Meeting
    } else if c.starts_with("IPM.APPOINTMENT") {
        ItemKind::Appointment
    } else if c.starts_with("IPM.CONTACT") || c.starts_with("IPM.DISTLIST") || c.starts_with("IPM.ABCHPERSON") {
        ItemKind::Contact
    } else if c.starts_with("IPM.TASK") {
        ItemKind::Task
    } else if c.starts_with("IPM.STICKYNOTE") {
        ItemKind::Note
    } else if c.starts_with("IPM.ACTIVITY") {
        ItemKind::Journal
    } else if c.starts_with("IPM.NOTE")
        || c.starts_with("REPORT.")
        || c.starts_with("IPM.POST")
        || c == "IPM"
        || c.starts_with("IPM.SHARING")
        || c.starts_with("IPM.OUTLOOK.RECALL")
    {
        ItemKind::Mail
    } else {
        ItemKind::Other
    }
}

/// Security of an item from its message class.
pub(crate) fn security_of_class(message_class: &str) -> Option<SecurityKind> {
    let c = message_class.to_uppercase();
    if !c.starts_with("IPM.NOTE.SMIME") {
        return None;
    }
    Some(if c.contains("MULTIPARTSIGNED") { SecurityKind::Signed } else { SecurityKind::Encrypted })
}

pub(crate) fn importance_from_value(value: i64) -> Importance {
    match value {
        2 => Importance::High,
        0 => Importance::Low,
        _ => Importance::Normal,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_attachments() {
        assert_eq!(classify_attachment("Vertrag.PDF", "application/octet-stream", false), 1);
        assert_eq!(classify_attachment("foto", "image/jpeg", false), 2);
        assert_eq!(classify_attachment("a.xlsx", "", false), 4);
        assert_eq!(classify_attachment("Fwd", "", true), 32);
        assert_eq!(classify_attachment("x.bin", "", false), 0);
    }

    #[test]
    fn kinds() {
        assert_eq!(kind_of("IPM.Note.SMIME.MultipartSigned"), ItemKind::Mail);
        assert_eq!(kind_of("IPM.Schedule.Meeting.Request"), ItemKind::Meeting);
        assert_eq!(kind_of("IPM.Contact"), ItemKind::Contact);
        assert_eq!(kind_of("IPM.Foo"), ItemKind::Other);
        assert_eq!(security_of_class("IPM.Note.SMIME.MultipartSigned"), Some(SecurityKind::Signed));
        assert_eq!(security_of_class("IPM.Note.SMIME"), Some(SecurityKind::Encrypted));
    }
}
