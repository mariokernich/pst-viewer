//! Types shared with the apps (exported through UniFFI). They mirror
//! `apps/desktop/src/shared/types.ts`. Times are epoch milliseconds, ids are
//! stable for the lifetime of an opened archive.

use std::collections::HashMap;

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ItemKind {
    Mail,
    Meeting,
    Appointment,
    Contact,
    Task,
    Note,
    Journal,
    Other,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SpecialFolder {
    Inbox,
    Drafts,
    Sent,
    Deleted,
    Archive,
    Junk,
    Outbox,
    Calendar,
    Contacts,
    Tasks,
    Notes,
    Journal,
    SyncIssues,
    Rss,
}

/// A folder of the archive. `folders()` lists them depth first in display
/// order; `parent_id` and `depth` describe the tree.
#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct FolderInfo {
    pub id: u32,
    pub parent_id: Option<u32>,
    pub depth: u32,
    pub name: String,
    pub special: Option<SpecialFolder>,
    pub container_class: String,
    /// Items stored directly in this folder.
    pub item_count: u32,
    pub unread_count: u32,
    /// Items in this folder and all of its descendants.
    pub total_count: u32,
    pub child_count: u32,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ArchiveFormat {
    /// Outlook 97-2002 data file.
    Ansi,
    /// Outlook 2003+ data file.
    Unicode,
    /// Outlook 2013+ offline file with 4 KB pages.
    Unicode4k,
    Unknown,
    Mbox,
    Eml,
    Msg,
    Folder,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct StoreInfo {
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub display_name: String,
    pub format: ArchiveFormat,
    pub item_count: u32,
    /// Unread messages (each counted once, also when it is in several folders).
    pub unread_count: u32,
    pub folder_count: u32,
    pub date_min: Option<i64>,
    pub date_max: Option<i64>,
    pub index_ms: i64,
    /// Number of items that could not be read.
    pub skipped_items: u32,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct SenderSuggestion {
    pub name: String,
    pub email: String,
    pub count: u32,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct OpenResult {
    pub store: StoreInfo,
    pub folders: Vec<FolderInfo>,
    pub senders: Vec<SenderSuggestion>,
    /// False while bodies and attachments are still indexed in the background.
    pub content_indexed: bool,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum OpenPhase {
    Opening,
    Scanning,
    Indexing,
    Finishing,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct OpenProgress {
    pub phase: OpenPhase,
    pub done: i64,
    pub total: i64,
    pub folder_name: Option<String>,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct IndexProgress {
    pub done: u32,
    pub total: u32,
    /// Set once every item is indexed.
    pub finished: bool,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SecurityKind {
    Signed,
    Encrypted,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Importance {
    Low,
    Normal,
    High,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct MessageSummary {
    pub id: u32,
    pub folder_id: u32,
    pub kind: ItemKind,
    pub message_class: String,
    pub subject: String,
    pub from_name: String,
    pub from_email: String,
    pub to_line: String,
    /// Epoch milliseconds, 0 if unknown.
    pub date: i64,
    pub size: i64,
    /// Visible (non-inline) attachments.
    pub attachment_count: u32,
    pub is_read: bool,
    pub importance: Importance,
    pub flagged: bool,
    pub security: Option<SecurityKind>,
    /// Body preview, or a snippet around the first match while searching.
    pub preview: String,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum SortField {
    Date,
    From,
    Subject,
    Size,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum SortDir {
    Asc,
    Desc,
}

#[derive(uniffi::Record, Clone, Copy, Debug, PartialEq, Eq)]
pub struct SortSpec {
    pub field: SortField,
    pub dir: SortDir,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SearchField {
    Subject,
    From,
    To,
    Body,
    Attachments,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum DatePreset {
    Any,
    Today,
    Week,
    Month,
    Year,
    Custom,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum AttachmentType {
    Pdf,
    Image,
    Office,
    Archive,
    Calendar,
    Message,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReadState {
    Any,
    Unread,
    Read,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct SearchFilters {
    /// Fields that free text terms are matched against. Empty means all.
    pub fields: Vec<SearchField>,
    pub date_preset: DatePreset,
    /// ISO date (YYYY-MM-DD), inclusive. Only used with `DatePreset::Custom`.
    pub date_from: Option<String>,
    /// ISO date (YYYY-MM-DD), inclusive. Only used with `DatePreset::Custom`.
    pub date_to: Option<String>,
    pub from: String,
    pub to: String,
    pub has_attachments: bool,
    pub attachment_type: Option<AttachmentType>,
    pub read_state: ReadState,
    pub important: bool,
    pub flagged: bool,
    /// Minimum size in bytes.
    pub min_size: Option<i64>,
    /// Item kinds to include. Empty means all kinds.
    pub kinds: Vec<ItemKind>,
}

impl Default for SearchFilters {
    fn default() -> Self {
        Self {
            fields: Vec::new(),
            date_preset: DatePreset::Any,
            date_from: None,
            date_to: None,
            from: String::new(),
            to: String::new(),
            has_attachments: false,
            attachment_type: None,
            read_state: ReadState::Any,
            important: false,
            flagged: false,
            min_size: None,
            kinds: Vec::new(),
        }
    }
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct SearchRequest {
    pub text: String,
    /// Folder to list or search in; None means all folders.
    pub folder_id: Option<u32>,
    pub include_subfolders: bool,
    pub filters: SearchFilters,
    pub sort: SortSpec,
    /// Client clock (epoch ms), used for relative date presets and grouping.
    pub now: i64,
    /// First day of the week for date grouping (0 = Sunday, 1 = Monday).
    pub first_day_of_week: u8,
    pub page_size: u32,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum DateGroup {
    Today,
    Yesterday,
    ThisWeek,
    LastWeek,
    ThisMonth,
    Month { year: i32, month: u32 },
    Unknown,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct ResultGroup {
    pub group: DateGroup,
    /// Index of the first item of this group within the result.
    pub start: u32,
    pub count: u32,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct SearchResponse {
    /// Identifies this result for `page()`.
    pub token: u64,
    pub total: u32,
    pub groups: Vec<ResultGroup>,
    /// The first page of the result.
    pub items: Vec<MessageSummary>,
    /// Folded terms (see `fold_for_index`) to highlight.
    pub highlight_terms: Vec<String>,
    /// Whether the query contains anything beyond plain folder browsing.
    pub is_search: bool,
    pub took_ms: i64,
}

/// Identifies a message: a top-level item, or a message attached to it
/// (`path` lists the attachment indices leading to it).
#[derive(uniffi::Record, Clone, Debug, PartialEq, Eq, Hash)]
pub struct MessageRef {
    pub id: u32,
    pub path: Vec<u32>,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum RecipientKind {
    To,
    Cc,
    Bcc,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq, Eq)]
pub struct Recipient {
    pub name: String,
    pub email: String,
    pub kind: RecipientKind,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq, Eq, Default)]
pub struct Mailbox {
    pub name: String,
    pub email: String,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq, Eq)]
pub struct AttachmentInfo {
    pub index: u32,
    pub name: String,
    pub size: i64,
    pub mime_type: String,
    /// Hidden attachments and images referenced by the HTML body.
    pub is_inline: bool,
    /// An attached message (Outlook item or .eml).
    pub is_message: bool,
    /// False for file types that could run code; those can only be saved.
    pub can_open: bool,
    pub preview_kind: PreviewKind,
}

/// File name and type of an attachment as it is saved (attached messages as .eml).
#[derive(uniffi::Record, Clone, Debug, PartialEq, Eq)]
pub struct AttachmentMeta {
    pub file_name: String,
    pub mime_type: String,
    pub is_message: bool,
    pub can_open: bool,
    pub preview_kind: PreviewKind,
    /// Bytes written.
    pub size: i64,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct AppointmentInfo {
    pub start: Option<i64>,
    pub end: Option<i64>,
    pub location: String,
    pub is_recurring: bool,
    pub recurrence: String,
    pub attendees: String,
    pub is_all_day: bool,
}

/// A field of a contact. Keys: company, jobTitle, department, email, email2,
/// email3, businessPhone, mobilePhone, homePhone, businessFax,
/// businessAddress, homeAddress, otherAddress, website, personalWebsite, im,
/// birthday and anniversary (ISO 8601 date-time).
#[derive(uniffi::Record, Clone, Debug, PartialEq, Eq)]
pub struct ContactField {
    pub key: String,
    pub value: String,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct TaskInfo {
    /// 0 not started, 1 in progress, 2 complete, 3 waiting, 4 deferred.
    pub status: i32,
    pub percent_complete: f64,
    pub start_date: Option<i64>,
    pub due_date: Option<i64>,
    pub owner: String,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum BodyFormat {
    Html,
    Text,
    None,
}

#[derive(uniffi::Record, Clone, Debug)]
pub struct MessageDetail {
    pub message_ref: MessageRef,
    pub folder_id: Option<u32>,
    pub kind: ItemKind,
    pub message_class: String,
    pub subject: String,
    pub from: Mailbox,
    /// Set when the message was sent on behalf of someone else.
    pub sender: Option<Mailbox>,
    pub reply_to: String,
    pub recipients: Vec<Recipient>,
    pub date: i64,
    pub sent_date: Option<i64>,
    pub received_date: Option<i64>,
    pub size: i64,
    pub importance: Importance,
    pub is_read: bool,
    pub flagged: bool,
    pub categories: Vec<String>,
    pub body_format: BodyFormat,
    pub html: Option<String>,
    pub text: String,
    pub attachments: Vec<AttachmentInfo>,
    /// Content-ID (lower case, without angle brackets) to data URL.
    pub inline_images: HashMap<String, String>,
    /// Internet headers as stored with the message.
    pub headers: String,
    pub security: Option<SecurityKind>,
    pub appointment: Option<AppointmentInfo>,
    pub contact: Option<Vec<ContactField>>,
    pub task: Option<TaskInfo>,
}

/// An attachment as a file: attached messages are converted to .eml.
#[derive(uniffi::Record, Clone, Debug)]
pub struct AttachmentFile {
    pub file_name: String,
    pub mime_type: String,
    pub is_message: bool,
    /// False for file types that could run code; those can only be saved.
    pub can_open: bool,
    pub preview_kind: PreviewKind,
    pub data: Vec<u8>,
}

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum PreviewKind {
    Pdf,
    Image,
    Text,
    Csv,
    Html,
    Calendar,
    Contact,
    Audio,
    Video,
    Message,
    None,
}

/// A range in a string, in UTF-16 code units (Swift `NSRange`, Kotlin `String`).
#[derive(uniffi::Record, Clone, Copy, Debug, PartialEq, Eq)]
pub struct MatchRange {
    pub start: u32,
    pub end: u32,
}
