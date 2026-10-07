//! The opened archive: item list, folders and the source the items are read
//! from (port of `worker/archive.ts`).

use std::collections::HashMap;
use std::time::Instant;

use crate::content::Resolved;
use crate::error::Result;
use crate::folders::{FolderIndex, FolderNode, compute_totals, sort_folders};
use crate::html::referenced_content_ids;
use crate::index::{IndexedItem, classify_attachment, collect_senders};
use crate::model::{ArchiveFormat, ItemKind, OpenResult, SenderSuggestion, StoreInfo};
use crate::text::fold_for_index;

/// Where items come from: a PST file or local mail files.
pub(crate) trait Source {
    /// Loads a top-level item with everything needed for display.
    fn load(&mut self, id: u32) -> Result<Resolved>;
    /// Loads an item's content and adds it to the item's index entry.
    fn index_item(&mut self, item: &mut IndexedItem) -> Result<()>;
    /// The body text of an item (for search snippets).
    fn text(&mut self, id: u32) -> Result<String> {
        Ok(self.load(id)?.content().text.clone())
    }
}

pub(crate) struct ArchiveIndex {
    pub items: Vec<IndexedItem>,
    /// Item id to position in `items`.
    pub positions: HashMap<u32, usize>,
    pub folders: FolderIndex,
    pub store: StoreInfo,
    pub senders: Vec<SenderSuggestion>,
    pub content_indexed: bool,
}

impl ArchiveIndex {
    pub fn item(&self, id: u32) -> Option<&IndexedItem> {
        self.positions.get(&id).map(|&i| &self.items[i])
    }

    pub fn open_result(&self) -> OpenResult {
        OpenResult {
            store: self.store.clone(),
            folders: self.folders.list.clone(),
            senders: self.senders.clone(),
            content_indexed: self.content_indexed,
        }
    }
}

/// Finishes the folder tree and item list of a freshly opened archive.
#[allow(clippy::too_many_arguments)]
pub(crate) fn build_index(
    mut roots: Vec<FolderNode>,
    items: Vec<IndexedItem>,
    path: &str,
    file_name: &str,
    file_size: i64,
    display_name: &str,
    format: ArchiveFormat,
    skipped: u32,
    started: Instant,
) -> ArchiveIndex {
    for root in roots.iter_mut() {
        compute_totals(root);
    }
    sort_folders(&mut roots);
    let folders = FolderIndex::build(&roots);
    let positions = items.iter().enumerate().map(|(i, item)| (item.id, i)).collect();
    let dates = items.iter().map(|i| i.date).filter(|d| *d > 0);
    let (date_min, date_max) = (dates.clone().min(), dates.max());
    let store = StoreInfo {
        file_path: path.to_string(),
        file_name: file_name.to_string(),
        file_size,
        display_name: display_name.to_string(),
        format,
        item_count: items.len() as u32,
        unread_count: items.iter().filter(|i| !i.is_read && matches!(i.kind, ItemKind::Mail | ItemKind::Meeting)).count() as u32,
        folder_count: folders.list.len() as u32,
        date_min,
        date_max,
        index_ms: started.elapsed().as_millis() as i64,
        skipped_items: skipped,
    };
    let content_indexed = items.iter().all(|i| i.indexed);
    let senders = collect_senders(&items);
    ArchiveIndex { items, positions, folders, store, senders, content_indexed }
}

/// Adds body, attachments and decoded addresses of a loaded message to its
/// index entry (used for local mail files).
pub(crate) fn apply_content(item: &mut IndexedItem, message: &Resolved) {
    let content = message.content();
    let cids = referenced_content_ids(content.html.as_deref());
    let mut attachment_count = 0;
    let mut attachment_kinds = 0;
    let mut names = Vec::new();
    for att in &content.attachments {
        if att.hidden || (!att.content_id.is_empty() && cids.contains(&att.content_id)) {
            continue;
        }
        attachment_count += 1;
        attachment_kinds |= classify_attachment(&att.name, &att.mime_type, att.is_message);
        names.push(att.name.clone());
    }
    item.attachment_count = attachment_count;
    item.attachment_kinds = attachment_kinds;
    item.security = content.security;
    item.set_body(&content.text);
    item.s_attach = fold_for_index(&names.join(" "));
    if let Resolved::Mime(mime) = message {
        // The full parse decodes names more reliably than the quick header scan.
        if !mime.from.email.is_empty() {
            item.set_from(mime.from.name.clone(), mime.from.email.clone());
        }
        if item.subject.is_empty() && !mime.subject.is_empty() {
            item.set_subject(mime.subject.clone());
        }
    }
    item.indexed = true;
}
