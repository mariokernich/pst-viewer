//! Outlook data files (.pst) via Microsoft's `outlook-pst` crate (port of
//! `worker/indexer.ts`, `worker/contentsTable.ts` and the PST parts of
//! `worker/content.ts`).
//!
//! The file is opened read-only and handed to `read_from`, so the crate never
//! holds a writable handle. All handles are `Rc` based and stay on the
//! archive's worker thread.

use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::rc::Rc;
use std::time::Instant;

use outlook_pst::ltp::prop_context::PropertyValue;
use outlook_pst::ltp::table_context::TableContext;
use outlook_pst::messaging::attachment::{AnsiAttachment, Attachment, AttachmentData, UnicodeAttachment};
use outlook_pst::messaging::folder::Folder;
use outlook_pst::messaging::message::{AnsiMessage, Message, UnicodeMessage};
use outlook_pst::messaging::store::{AnsiStore, Store, UnicodeStore};
use outlook_pst::ndb::node_id::{NodeId, NodeIdType};
use outlook_pst::{AnsiPstFile, UnicodePstFile};

use crate::archive::{ArchiveIndex, Source, build_index};
use crate::codepage;
use crate::content::{AttachmentBody, ContentAttachment, MapiMessage, MessageContent, Resolved, mapi_content, name_or, with_extension};
use crate::error::{CoreError, Result};
use crate::folders::{FolderNode, detect_special_folder};
use crate::html::referenced_content_ids;
use crate::index::{IndexedItem, classify_attachment, importance_from_value, kind_of, security_of_class};
use crate::mapi::{AttachmentMeta, MSGFLAG_HASATTACH, MSGFLAG_READ, NamedMap, PropBag, Value, recipient_from, tag};
use crate::model::{ArchiveFormat, OpenPhase, OpenProgress, RecipientKind, SpecialFolder};
use crate::text::{fold_for_index, squash};
use crate::time::filetime_to_ms;

const NID_ROOT_FOLDER: u32 = 0x122;
/// Attachments up to this size are read when a message is displayed, so that
/// their exact size is known; larger ones are read on demand.
const EAGER_ATTACHMENT_BYTES: i64 = 8 * 1024 * 1024;

// -----------------------------------------------------------------------------
// Handles of both PST flavours

#[derive(Clone)]
pub(crate) enum PstStore {
    Unicode(Rc<UnicodeStore>),
    Ansi(Rc<AnsiStore>),
}

impl PstStore {
    fn store(&self) -> Rc<dyn Store> {
        match self {
            PstStore::Unicode(s) => s.clone(),
            PstStore::Ansi(s) => s.clone(),
        }
    }

    fn open_folder(&self, nid: u32) -> io::Result<Rc<dyn Folder>> {
        let store = self.store();
        let entry = store.properties().make_entry_id(NodeId::from(nid))?;
        store.open_folder(&entry)
    }

    fn open_message(&self, nid: u32) -> io::Result<PstMessage> {
        let store = self.store();
        let entry = store.properties().make_entry_id(NodeId::from(nid))?;
        Ok(match self {
            PstStore::Unicode(s) => PstMessage::Unicode(UnicodeMessage::read(s.clone(), &entry, None)?),
            PstStore::Ansi(s) => PstMessage::Ansi(AnsiMessage::read(s.clone(), &entry, None)?),
        })
    }
}

#[derive(Clone)]
pub(crate) enum PstMessage {
    Unicode(Rc<UnicodeMessage>),
    Ansi(Rc<AnsiMessage>),
}

impl PstMessage {
    fn message(&self) -> &dyn Message {
        match self {
            PstMessage::Unicode(m) => m.as_ref(),
            PstMessage::Ansi(m) => m.as_ref(),
        }
    }

    fn read_attachment(&self, sub_node: u32, with_data: bool) -> io::Result<PstAttachment> {
        let node = NodeId::from(sub_node);
        Ok(match (self, with_data) {
            (PstMessage::Unicode(m), true) => PstAttachment::Unicode(UnicodeAttachment::read(m.clone(), node, None)?),
            (PstMessage::Unicode(m), false) => PstAttachment::Unicode(UnicodeAttachment::read_metadata(m.clone(), node)?),
            (PstMessage::Ansi(m), true) => PstAttachment::Ansi(AnsiAttachment::read(m.clone(), node, None)?),
            (PstMessage::Ansi(m), false) => PstAttachment::Ansi(AnsiAttachment::read_metadata(m.clone(), node)?),
        })
    }
}

enum PstAttachment {
    Unicode(Rc<UnicodeAttachment>),
    Ansi(Rc<AnsiAttachment>),
}

impl PstAttachment {
    fn attachment(&self) -> &dyn Attachment {
        match self {
            PstAttachment::Unicode(a) => a.as_ref(),
            PstAttachment::Ansi(a) => a.as_ref(),
        }
    }

    fn data(&self) -> Vec<u8> {
        match self.attachment().data() {
            Some(AttachmentData::Binary(binary)) => binary.buffer().to_vec(),
            _ => Vec::new(),
        }
    }

    fn embedded(&self) -> Option<PstMessage> {
        match self {
            PstAttachment::Unicode(a) => a.embedded_message().map(PstMessage::Unicode),
            PstAttachment::Ansi(a) => a.embedded_message().map(PstMessage::Ansi),
        }
    }
}

/// An attachment of a loaded PST message, read on demand.
#[derive(Clone)]
pub(crate) struct PstAttachmentRef {
    message: PstMessage,
    sub_node: u32,
    named: Rc<NamedMap>,
}

impl PstAttachmentRef {
    pub fn read_data(&self) -> Result<Vec<u8>> {
        Ok(self.message.read_attachment(self.sub_node, true)?.data())
    }

    pub fn open_embedded(&self) -> Result<MapiMessage> {
        let attachment = self.message.read_attachment(self.sub_node, true)?;
        let message = attachment.embedded().ok_or_else(|| CoreError::not_found("The attached message cannot be read"))?;
        load_message(&message, &self.named, true)
    }
}

// -----------------------------------------------------------------------------
// Property conversion

fn utf16(units: &[u16]) -> String {
    let end = units.iter().rposition(|u| *u != 0).map_or(0, |i| i + 1);
    String::from_utf16_lossy(&units[..end])
}

fn string8(bytes: &[u8], codepage: Option<u32>) -> String {
    let end = bytes.iter().rposition(|b| *b != 0).map_or(0, |i| i + 1);
    codepage::decode(&bytes[..end], codepage)
}

/// Converts a property value of the crate; strings in 8-bit code pages are
/// decoded with `codepage` (windows-1252 if unknown).
fn convert(value: &PropertyValue, codepage: Option<u32>) -> Value {
    match value {
        PropertyValue::Integer16(v) => Value::Int(i64::from(*v)),
        PropertyValue::Integer32(v) => Value::Int(i64::from(*v)),
        PropertyValue::Integer64(v) | PropertyValue::Currency(v) => Value::Int(*v),
        PropertyValue::Boolean(v) => Value::Bool(*v),
        PropertyValue::Floating32(v) => Value::Float(f64::from(*v)),
        PropertyValue::Floating64(v) => Value::Float(*v),
        PropertyValue::FloatingTime(days) => Value::Time(((days - 25_569.0) * 86_400_000.0) as i64),
        PropertyValue::Time(t) => filetime_to_ms(*t).map_or(Value::Other, Value::Time),
        PropertyValue::String8(s) => Value::Str(string8(s.buffer(), codepage)),
        PropertyValue::Unicode(s) => Value::Str(utf16(s.buffer())),
        PropertyValue::Binary(b) => Value::Bin(b.buffer().to_vec()),
        PropertyValue::Object(o) => Value::Object(u32::from(o.node())),
        PropertyValue::MultipleUnicode(list) => Value::StrList(list.iter().map(|s| utf16(s.buffer())).collect()),
        PropertyValue::MultipleString8(list) => Value::StrList(list.iter().map(|s| string8(s.buffer(), codepage)).collect()),
        _ => Value::Other,
    }
}

fn prop_bag(props: &[(&u16, &PropertyValue)]) -> PropBag {
    let codepage =
        props.iter().filter(|(id, _)| **id == tag::INTERNET_CODEPAGE || **id == tag::MESSAGE_CODEPAGE).find_map(|(_, v)| match v {
            PropertyValue::Integer32(cp) if *cp > 0 => Some(*cp as u32),
            _ => None,
        });
    let mut bag = PropBag::default();
    for (id, value) in props {
        let value = convert(value, codepage);
        if value != Value::Other {
            bag.props.insert(**id, value);
        }
    }
    bag
}

/// Rows of a table (contents, recipients, attachments) as property bags.
fn table_rows(table: &dyn TableContext) -> Vec<(u32, PropBag)> {
    let context = table.context();
    table
        .rows_matrix()
        .map(|row| {
            let mut bag = PropBag::default();
            if let Ok(values) = row.columns(context) {
                for (column, value) in context.columns().iter().zip(values) {
                    let Some(value) = value else { continue };
                    let Ok(value) = table.read_column(&value, column.prop_type()) else { continue };
                    let value = convert(&value, None);
                    if value != Value::Other {
                        bag.props.insert(column.prop_id(), value);
                    }
                }
            }
            (u32::from(row.id()), bag)
        })
        .collect()
}

// -----------------------------------------------------------------------------
// Messages

/// Loads properties, recipients, body and attachments of a message.
/// `for_display` reads small attachments right away (exact sizes, inline
/// images); indexing only reads their properties.
pub(crate) fn load_message(message: &PstMessage, named: &Rc<NamedMap>, for_display: bool) -> Result<MapiMessage> {
    let msg = message.message();
    let props = prop_bag(&msg.properties().iter().collect::<Vec<_>>());
    let recipients = msg
        .recipient_table()
        .map(|t| table_rows(t.as_ref()))
        .unwrap_or_default()
        .iter()
        .filter_map(|(_, bag)| recipient_from(bag))
        .collect();
    let attachments = list_attachments(message, named, for_display);

    let mapi = MapiMessage {
        props,
        named: Rc::clone(named),
        recipients,
        content: MessageContent { html: None, text: String::new(), text_derived: false, attachments, security: None },
    };
    let content = mapi_content(&mapi);
    Ok(MapiMessage { content, ..mapi })
}

fn list_attachments(message: &PstMessage, named: &Rc<NamedMap>, for_display: bool) -> Vec<ContentAttachment> {
    let Some(table) = message.message().attachment_table() else {
        return Vec::new();
    };
    let rows = table_rows(table.as_ref());
    let mut result = Vec::with_capacity(rows.len());
    for (i, (sub_node, row)) in rows.iter().enumerate() {
        // The table only has some columns; the attachment object has them all.
        let Ok(attachment) = message.read_attachment(*sub_node, false) else {
            let meta = AttachmentMeta::from_props(row);
            result.push(ContentAttachment {
                name: with_extension(&name_or(&meta.name, || format!("attachment-{}", i + 1)), &meta.mime_type, false),
                size: meta.declared_size,
                mime_type: if meta.mime_type.is_empty() { "application/octet-stream".into() } else { meta.mime_type },
                content_id: meta.content_id,
                hidden: meta.hidden,
                is_message: false,
                body: AttachmentBody::Missing,
            });
            continue;
        };
        let props = prop_bag(&attachment.attachment().properties().iter().collect::<Vec<_>>());
        let meta = AttachmentMeta::from_props(&props);
        let reference = PstAttachmentRef { message: message.clone(), sub_node: *sub_node, named: Rc::clone(named) };

        if meta.is_embedded_message() {
            let mut name = meta.name.clone();
            if name.trim().is_empty() {
                name = reference.open_embedded().map(|m| m.item().subject()).unwrap_or_default();
            }
            result.push(ContentAttachment {
                name: with_extension(&name_or(&name, || format!("attachment-{}", i + 1)), "message/rfc822", true),
                size: meta.declared_size,
                mime_type: "message/rfc822".into(),
                content_id: meta.content_id,
                hidden: meta.hidden,
                is_message: true,
                body: AttachmentBody::PstEmbedded(reference),
            });
            continue;
        }

        let is_message = meta.is_mime_message();
        let mime_type = if !meta.mime_type.is_empty() {
            meta.mime_type.clone()
        } else if is_message {
            "message/rfc822".to_string()
        } else {
            "application/octet-stream".to_string()
        };
        let name = with_extension(&name_or(&meta.name, || format!("attachment-{}", i + 1)), &mime_type, is_message);
        let (size, body) = if meta.method == 1 && for_display && meta.declared_size <= EAGER_ATTACHMENT_BYTES {
            match reference.read_data() {
                Ok(data) => (data.len() as i64, AttachmentBody::Bytes(Rc::new(data))),
                Err(_) => (meta.declared_size, AttachmentBody::Missing),
            }
        } else if meta.method == 1 || meta.method == 6 {
            (meta.declared_size, AttachmentBody::PstData(reference))
        } else {
            (meta.declared_size, AttachmentBody::Missing)
        };
        result.push(ContentAttachment { name, size, mime_type, content_id: meta.content_id, hidden: meta.hidden, is_message, body });
    }
    result
}

// -----------------------------------------------------------------------------
// Opening

struct ScannedFolder {
    id: u32,
    name: String,
    special: Option<SpecialFolder>,
    content_count: i64,
}

pub(crate) struct PstSource {
    store: PstStore,
    named: Rc<NamedMap>,
    specials: HashMap<u32, SpecialFolder>,
}

/// File header: "!BDN" and the format version.
pub(crate) fn pst_format(file: &mut File) -> Result<Option<ArchiveFormat>> {
    let mut header = [0u8; 12];
    file.seek(SeekFrom::Start(0))?;
    if file.read(&mut header)? < 12 || &header[..4] != b"!BDN" {
        return Ok(None);
    }
    let version = u16::from_le_bytes([header[10], header[11]]);
    Ok(Some(match version {
        14 | 15 => ArchiveFormat::Ansi,
        23 => ArchiveFormat::Unicode,
        36 => ArchiveFormat::Unicode4k,
        _ => ArchiveFormat::Unknown,
    }))
}

impl PstSource {
    /// Opens a PST file and builds the item list from the folders' contents
    /// tables (fast); bodies are indexed afterwards.
    pub fn open(
        mut file: File,
        path: &str,
        file_name: &str,
        progress: &mut dyn FnMut(OpenProgress),
        is_canceled: &dyn Fn() -> bool,
    ) -> Result<(PstSource, ArchiveIndex)> {
        let started = Instant::now();
        let file_size = file.metadata().map(|m| m.len() as i64).unwrap_or(0);
        let format = pst_format(&mut file)?.ok_or_else(|| CoreError::unsupported("Not an Outlook data file"))?;
        if format == ArchiveFormat::Unicode4k {
            return Err(CoreError::unsupported("Offline data files (.ost) of Outlook 2013 and later are not supported"));
        }
        progress(OpenProgress { phase: OpenPhase::Opening, done: 0, total: 0, folder_name: None });
        file.seek(SeekFrom::Start(0))?;
        let not_pst = |e: io::Error| CoreError::unsupported(format!("Not a valid Outlook data file: {e}"));
        let store = if format == ArchiveFormat::Ansi {
            PstStore::Ansi(AnsiStore::read(Rc::new(AnsiPstFile::read_from(Box::new(file)).map_err(not_pst)?)).map_err(not_pst)?)
        } else {
            PstStore::Unicode(UnicodeStore::read(Rc::new(UnicodePstFile::read_from(Box::new(file)).map_err(not_pst)?)).map_err(not_pst)?)
        };
        let named = Rc::new(named_map(&store));
        let mut source = PstSource { store, named, specials: HashMap::new() };

        let (roots, scanned) = source.scan_folders()?;
        let total: i64 = scanned.iter().map(|s| s.content_count).sum();
        progress(OpenProgress { phase: OpenPhase::Scanning, done: 0, total, folder_name: None });

        let mut items: Vec<IndexedItem> = Vec::new();
        let mut seen: HashSet<u32> = HashSet::new();
        let mut skipped = 0u32;
        let mut done = 0i64;
        let mut last_report = Instant::now();
        let mut folder_counts: HashMap<u32, (u32, u32)> = HashMap::new();
        for folder in &scanned {
            if folder.content_count == 0 {
                continue;
            }
            if is_canceled() {
                return Err(CoreError::Canceled);
            }
            let rows = source.contents_rows(folder.id);
            let usable = rows.iter().any(|(_, row)| row.get(tag::SUBJECT).is_some() || row.get(tag::MESSAGE_CLASS).is_some());
            for (nid, row) in rows {
                if !seen.insert(nid) {
                    continue;
                }
                let item = if usable {
                    item_from_row(nid, &row, folder.id, folder.special)
                } else {
                    // The contents table lacks the list columns: open the message instead.
                    let mut item = IndexedItem::new(crate::model::ItemKind::Mail, "IPM.Note".into());
                    item.id = nid;
                    item.folder_id = folder.id;
                    if source.index_item(&mut item).is_err() {
                        skipped += 1;
                        continue;
                    }
                    item
                };
                let counts = folder_counts.entry(folder.id).or_default();
                counts.0 += 1;
                if !item.is_read && matches!(item.kind, crate::model::ItemKind::Mail | crate::model::ItemKind::Meeting) {
                    counts.1 += 1;
                }
                items.push(item);
            }
            done += folder.content_count;
            if last_report.elapsed().as_millis() > 80 {
                last_report = Instant::now();
                progress(OpenProgress { phase: OpenPhase::Indexing, done: done.min(total), total, folder_name: Some(folder.name.clone()) });
            }
        }
        progress(OpenProgress { phase: OpenPhase::Finishing, done: total, total, folder_name: None });

        let mut roots = roots;
        apply_counts(&mut roots, &folder_counts);
        let display_name =
            source.store.store().properties().display_name().ok().filter(|n| !n.trim().is_empty()).unwrap_or_else(|| file_name.to_string());
        let index = build_index(roots, items, path, file_name, file_size, &display_name, format, skipped, started);
        Ok((source, index))
    }

    fn scan_folders(&mut self) -> Result<(Vec<FolderNode>, Vec<ScannedFolder>)> {
        let root =
            self.store.open_folder(NID_ROOT_FOLDER).map_err(|e| CoreError::read_failed(format!("Cannot read the folder list: {e}")))?;
        let ipm_subtree = self.store.store().properties().ipm_sub_tree_entry_id().ok().map(|e| u32::from(e.node_id()));
        let top_level = child_folder_ids(root.as_ref());

        let ipm = ipm_subtree.filter(|id| top_level.contains(id)).or_else(|| {
            // Fallback: the top-level folder with the most subfolders.
            top_level.iter().copied().max_by_key(|id| self.store.open_folder(*id).map(|f| child_folder_ids(f.as_ref()).len()).unwrap_or(0))
        });

        let mut roots = Vec::new();
        let mut scanned = Vec::new();
        if let Some(ipm) = ipm {
            if let Ok(folder) = self.store.open_folder(ipm) {
                for child in child_folder_ids(folder.as_ref()) {
                    if let Some(node) = self.scan_folder(child, 0, &mut scanned) {
                        roots.push(node);
                    }
                }
            }
        }
        // Some tools write folders next to the IPM subtree; keep those that hold items.
        for id in top_level {
            if Some(id) == ipm || is_search_folder(id) {
                continue;
            }
            let before = scanned.len();
            if let Some(node) = self.scan_folder(id, 0, &mut scanned) {
                if scanned[before..].iter().any(|s| s.content_count > 0) {
                    roots.push(node);
                } else {
                    scanned.truncate(before);
                }
            }
        }
        Ok((roots, scanned))
    }

    fn scan_folder(&mut self, id: u32, depth: usize, scanned: &mut Vec<ScannedFolder>) -> Option<FolderNode> {
        if depth > 64 {
            return None;
        }
        let folder = self.store.open_folder(id).ok()?;
        let props = folder.properties();
        let name = props.display_name().ok().map(|n| squash(&n)).filter(|n| !n.is_empty()).unwrap_or_else(|| "—".to_string());
        let container_class = match props.get(tag::CONTAINER_CLASS) {
            Some(value) => match convert(value, None) {
                Value::Str(s) => s,
                _ => String::new(),
            },
            None => String::new(),
        };
        let special = detect_special_folder(&name, &container_class, depth);
        if let Some(special) = special {
            self.specials.insert(id, special);
        }
        if !is_search_folder(id) {
            scanned.push(ScannedFolder { id, name: name.clone(), special, content_count: i64::from(props.content_count().unwrap_or(0)) });
        }
        let mut node = FolderNode::new(id, name, special, container_class);
        for child in child_folder_ids(folder.as_ref()) {
            if let Some(child) = self.scan_folder(child, depth + 1, scanned) {
                node.children.push(child);
            }
        }
        Some(node)
    }

    fn contents_rows(&self, folder: u32) -> Vec<(u32, PropBag)> {
        let Ok(folder) = self.store.open_folder(folder) else { return Vec::new() };
        let Some(table) = folder.contents_table() else { return Vec::new() };
        table_rows(table.as_ref())
            .into_iter()
            .filter(|(nid, _)| matches!(NodeId::from(*nid).id_type(), Ok(NodeIdType::NormalMessage)))
            .collect()
    }

    fn load(&self, id: u32, for_display: bool) -> Result<MapiMessage> {
        let message = self.store.open_message(id).map_err(|_| CoreError::not_found(format!("Item {id} not found")))?;
        load_message(&message, &self.named, for_display)
    }
}

impl Source for PstSource {
    fn load(&mut self, id: u32) -> Result<Resolved> {
        PstSource::load(self, id, true).map(Resolved::Mapi)
    }

    fn text(&mut self, id: u32) -> Result<String> {
        Ok(PstSource::load(self, id, false)?.content.text)
    }

    /// Adds body, recipients and attachments of an item to the search index.
    fn index_item(&mut self, item: &mut IndexedItem) -> Result<()> {
        let message = PstSource::load(self, item.id, false)?;
        let special = self.specials.get(&item.folder_id).copied();
        let mapi = message.item();
        let class = mapi.message_class();
        let kind = kind_of(&class);
        let content = &message.content;
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

        let from = mapi.sender();
        let to_names: Vec<&str> =
            message.recipients.iter().filter(|r| r.kind == RecipientKind::To).map(|r| r.name.as_str()).filter(|n| !n.is_empty()).collect();
        let display_to = squash(&message.props.string(tag::DISPLAY_TO));
        let to_line = if display_to.is_empty() { squash(&to_names.join("; ")) } else { display_to };
        let emails: Vec<&str> = message.recipients.iter().map(|r| r.email.as_str()).filter(|e| !e.is_empty()).collect();

        item.kind = kind;
        item.set_subject(mapi.subject());
        item.set_from(from.name, from.email);
        item.s_to = fold_for_index(&format!(
            "{to_line} {} {} {}",
            message.props.string(tag::DISPLAY_CC),
            message.props.string(tag::DISPLAY_BCC),
            emails.join(" ")
        ));
        item.to_line = to_line;
        item.date = mapi.item_date(kind, special);
        item.size = mapi.size();
        item.attachment_count = attachment_count;
        item.attachment_kinds = attachment_kinds;
        item.is_read = mapi.is_read();
        item.importance = importance_from_value(mapi.importance());
        item.flagged = mapi.flagged();
        item.security = content.security;
        item.set_body(&content.text);
        item.s_attach = fold_for_index(&names.join(" "));
        item.message_class = class;
        item.indexed = true;
        Ok(())
    }
}

fn named_map(store: &PstStore) -> NamedMap {
    let Ok(map) = store.store().named_property_map() else {
        return NamedMap::default();
    };
    let props = map.properties();
    let bin = |id: u16| match props.get(id) {
        Some(PropertyValue::Binary(b)) => b.buffer().to_vec(),
        _ => Vec::new(),
    };
    NamedMap::parse(&bin(0x0002), &bin(0x0003), &bin(0x0004))
}

fn child_folder_ids(folder: &dyn Folder) -> Vec<u32> {
    let Some(table) = folder.hierarchy_table() else { return Vec::new() };
    table
        .rows_matrix()
        .map(|row| u32::from(row.id()))
        .filter(|id| matches!(NodeId::from(*id).id_type(), Ok(NodeIdType::NormalFolder | NodeIdType::SearchFolder)))
        .collect()
}

fn is_search_folder(id: u32) -> bool {
    // NID type 0x03 marks search folders; their contents duplicate other folders.
    matches!(NodeId::from(id).id_type(), Ok(NodeIdType::SearchFolder))
}

fn apply_counts(nodes: &mut [FolderNode], counts: &HashMap<u32, (u32, u32)>) {
    for node in nodes {
        if let Some((items, unread)) = counts.get(&node.id) {
            node.item_count = *items;
            node.unread_count = *unread;
        }
        apply_counts(&mut node.children, counts);
    }
}

/// A provisional item from a contents table row.
fn item_from_row(nid: u32, row: &PropBag, folder_id: u32, special: Option<SpecialFolder>) -> IndexedItem {
    let class = row.str(tag::MESSAGE_CLASS).filter(|c| !c.is_empty()).unwrap_or("IPM.Note").to_string();
    let kind = kind_of(&class);
    let mut item = IndexedItem::new(kind, class.clone());
    item.id = nid;
    item.folder_id = folder_id;
    item.set_subject(crate::mapi::clean_subject(&row.string(tag::SUBJECT)));
    let from = squash(
        &[tag::SENT_REPRESENTING_NAME, tag::SENDER_NAME].iter().map(|t| row.string(*t)).find(|s| !s.trim().is_empty()).unwrap_or_default(),
    );
    item.s_from = fold_for_index(&from);
    item.from_name = from;
    item.to_line = squash(&row.string(tag::DISPLAY_TO));
    item.s_to = fold_for_index(&item.to_line);
    let flags = row.int(tag::MESSAGE_FLAGS).unwrap_or(0);
    let sent_like = matches!(special, Some(SpecialFolder::Sent | SpecialFolder::Drafts | SpecialFolder::Outbox));
    let order: &[u16] = if sent_like {
        &[tag::CLIENT_SUBMIT_TIME, tag::LAST_MODIFICATION_TIME]
    } else {
        &[tag::MESSAGE_DELIVERY_TIME, tag::CLIENT_SUBMIT_TIME, tag::LAST_MODIFICATION_TIME]
    };
    item.date = order.iter().find_map(|t| row.time(*t)).unwrap_or(0);
    item.size = row.int(tag::MESSAGE_SIZE).unwrap_or(0);
    // Provisional: the flag also counts inline images; refined while indexing.
    item.attachment_count = u32::from(flags & MSGFLAG_HASATTACH != 0);
    item.is_read = flags & MSGFLAG_READ != 0;
    item.importance = importance_from_value(row.int(tag::IMPORTANCE).unwrap_or(1));
    item.flagged = row.int(tag::FLAG_STATUS) == Some(2);
    item.security = security_of_class(&class);
    item
}
