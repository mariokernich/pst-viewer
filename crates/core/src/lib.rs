//! Read-only engine for e-mail archives (Outlook PST, MSG, EML/EMLX, MBOX and
//! folders of mail files), shared by the iOS and Android apps through UniFFI.
//! It mirrors the worker of the desktop app (`apps/desktop/src/worker`).
//!
//! Archives are only ever opened for reading.

uniffi::setup_scaffolding!();

mod archive;
mod codepage;
mod content;
mod detail;
mod eml;
mod error;
mod export;
mod files;
mod filters;
mod folders;
mod headers;
mod html;
mod ical;
mod index;
mod local;
mod mapi;
mod mbox;
mod mime;
mod model;
mod msg;
mod pst;
mod query;
mod rtf;
mod search;
mod session;
mod text;
mod time;
mod vfs;

use std::collections::HashMap;

pub use error::CoreError;
pub use export::{HeaderRow, PrintInput};
pub use html::MailDocument;
pub use ical::{CalendarEvent, CalendarInfo, CalendarPerson, CalendarTime, ContactCard, ContactCardField, ContactFieldKind};
pub use model::*;
pub use session::{ArchiveListener, ArchiveSession, CancelToken};
pub use vfs::{DirEntry, FileAccess};

/// Version of the core library.
#[uniffi::export]
pub fn core_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Filters with nothing selected.
#[uniffi::export]
pub fn default_filters() -> SearchFilters {
    SearchFilters::default()
}

/// Number of filters that differ from the defaults (for badges).
#[uniffi::export]
pub fn count_active_filters(filters: SearchFilters) -> u32 {
    filters::count_active_filters(&filters)
}

/// True if any filter restricts the result (search fields alone do not).
#[uniffi::export]
pub fn has_active_filters(filters: SearchFilters) -> bool {
    filters::has_active_filters(&filters)
}

/// Lower-cases text, strips diacritics and collapses whitespace, as used by
/// the search ("Müller" -> "muller").
#[uniffi::export]
pub fn fold_for_index(text: String) -> String {
    text::fold_for_index(&text)
}

/// Ranges of `text` (UTF-16 code units) matching any of the folded terms of a
/// search response, for highlighting.
#[uniffi::export]
pub fn find_matches(text: String, terms: Vec<String>) -> Vec<MatchRange> {
    text::find_matches(&text, &terms)
}

/// Parses sizes such as "500kb", "1.5 MB" or "2m" to bytes.
#[uniffi::export]
pub fn parse_size(value: String) -> Option<i64> {
    query::parse_size(&value)
}

/// A sanitised, locked down document of an HTML mail body for a WebView:
/// no scripts, forms or plugins, inline images resolved, remote images blocked
/// unless allowed. `extra_css` adapts fonts and spacing to the app.
#[uniffi::export]
pub fn prepare_mail_document(html: String, inline_images: HashMap<String, String>, allow_remote: bool, extra_css: String) -> MailDocument {
    html::prepare_mail_document(&html, &inline_images, allow_remote, &extra_css)
}

/// A plain text body as document with clickable links.
#[uniffi::export]
pub fn prepare_text_document(text: String, extra_css: String) -> MailDocument {
    html::prepare_text_document(&text, &extra_css)
}

/// A self-contained HTML document of a message for PDF export and printing.
#[uniffi::export]
pub fn build_print_document(input: PrintInput) -> String {
    export::build_print_document(input)
}

/// Plain text version of a message with its header fields.
#[uniffi::export]
pub fn build_export_text(subject_label: String, subject: String, rows: Vec<HeaderRow>, text: String) -> String {
    export::build_export_text(subject_label, subject, rows, text)
}

/// Suggested export file name without extension, e.g. "2026-01-26 Report".
#[uniffi::export]
pub fn export_base_name(subject: String, date: i64, no_subject: String) -> String {
    export::export_base_name(subject, date, no_subject)
}

/// Events of an iCalendar attachment (.ics).
#[uniffi::export]
pub fn parse_calendar(data: Vec<u8>) -> CalendarInfo {
    ical::parse_calendar(data)
}

/// Contacts of a vCard attachment (.vcf).
#[uniffi::export]
pub fn parse_contacts(data: Vec<u8>) -> Vec<ContactCard> {
    ical::parse_contacts(data)
}

/// Makes a string safe to use as a file name on all platforms.
#[uniffi::export]
pub fn sanitize_file_name(name: String, fallback: String) -> String {
    files::sanitize_file_name(&name, &fallback)
}

/// True if opening the file with its default app could execute code; such
/// files are only saved, never opened.
#[uniffi::export]
pub fn is_unsafe_to_open(name: String, mime_type: String) -> bool {
    files::is_unsafe_to_open(&name, &mime_type)
}

/// How an attachment can be previewed.
#[uniffi::export]
pub fn preview_kind(name: String, mime_type: String, is_message: bool) -> PreviewKind {
    files::preview_kind(&name, &mime_type, is_message)
}
