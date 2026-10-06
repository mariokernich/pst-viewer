//! Mail archives made of plain files: a single EML/EMLX or MSG file, an MBOX
//! file (Thunderbird, Apple Mail, Google Takeout) or a folder containing any
//! of these (port of `worker/localArchive.ts`). Folders mirror the directory
//! structure; Google Takeout labels become folders.

use std::collections::HashMap;
use std::fs::File;
use std::time::Instant;

use crate::archive::{ArchiveIndex, Source, apply_content, build_index};
use crate::content::Resolved;
use crate::error::{CoreError, Result};
use crate::folders::{FolderNode, detect_special_folder, prune_empty};
use crate::headers::{HeaderMeta, header_meta};
use crate::index::{IndexedItem, importance_from_value, kind_of, security_of_class};
use crate::mapi::tag;
use crate::mbox::{looks_like_mbox, read_mbox_message, read_range, scan_mbox};
use crate::model::{ArchiveFormat, ItemKind, Mailbox, OpenPhase, OpenProgress, RecipientKind, SpecialFolder};
use crate::msg::{looks_like_msg, open_msg};
use crate::text::{fold_for_index, squash};
use crate::vfs::{DirEntry, Vfs};

const HEADER_READ_LIMIT: usize = 64 * 1024;
const MAX_SCAN_DEPTH: usize = 12;
const MAX_FILES: usize = 250_000;
const REPORT_INTERVAL_MS: u128 = 80;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum LocalFormat {
    Eml,
    Msg,
    Mbox,
}

enum ItemSource {
    Eml(String),
    Msg(String),
    Mbox { file: String, start: u64, end: u64 },
}

pub(crate) struct LocalSource {
    vfs: Vfs,
    sources: HashMap<u32, ItemSource>,
    /// Open MBOX files.
    handles: HashMap<String, File>,
}

/// A folder while the tree is built (arena with parent links).
struct BuildFolder {
    id: u32,
    name: String,
    special: Option<SpecialFolder>,
    parent: Option<usize>,
    children: Vec<usize>,
    item_count: u32,
    unread_count: u32,
}

struct Builder<'a> {
    vfs: Vfs,
    folders: Vec<BuildFolder>,
    roots: Vec<usize>,
    items: Vec<IndexedItem>,
    sources: HashMap<u32, ItemSource>,
    handles: HashMap<String, File>,
    skipped: u32,
    total_bytes: i64,
    progress: &'a mut dyn FnMut(OpenProgress),
    is_canceled: &'a dyn Fn() -> bool,
    last_report: Instant,
}

fn extension(name: &str) -> String {
    name.rsplit_once('.').map(|(_, ext)| ext.to_lowercase()).unwrap_or_default()
}

pub(crate) fn display_name(name: &str) -> String {
    match name.rsplit_once('.') {
        Some((stem, ext)) if matches!(ext.to_lowercase().as_str(), "eml" | "emlx" | "msg" | "mbox" | "mbx") && !stem.is_empty() => {
            stem.to_string()
        }
        _ => name.to_string(),
    }
}

fn looks_like_eml(head: &[u8]) -> bool {
    let text = String::from_utf8_lossy(head);
    let mut header_lines = 0;
    for line in text.lines().take(40) {
        if line.is_empty() {
            break;
        }
        if line.starts_with([' ', '\t']) {
            continue;
        }
        let Some((name, _)) = line.split_once(':') else { return false };
        if name.is_empty() || !name.bytes().all(|b| (b'!'..=b'~').contains(&b) && b != b':') {
            return false;
        }
        header_lines += 1;
    }
    let known = text.lines().take(40).any(|l| {
        let l = l.to_ascii_lowercase();
        ["from:", "date:", "subject:", "message-id:", "received:", "return-path:", "mime-version:"].iter().any(|p| l.starts_with(p))
    });
    header_lines >= 2 && known
}

/// Detects the format of a file from its first bytes and its name.
pub(crate) fn detect_local_format(vfs: &Vfs, id: &str, name: &str) -> Result<Option<LocalFormat>> {
    let mut file = vfs.open(id)?;
    let head = read_range(&mut file, 0, 512)?;
    if looks_like_msg(&head) {
        return Ok(Some(LocalFormat::Msg));
    }
    if looks_like_mbox(&head) {
        return Ok(Some(LocalFormat::Mbox));
    }
    let ext = extension(name);
    if ext == "mbox" || ext == "mbx" {
        return Ok(Some(LocalFormat::Mbox));
    }
    if ext == "eml" || ext == "emlx" || ext == "mht" || looks_like_eml(&head) {
        return Ok(Some(LocalFormat::Eml));
    }
    Ok(None)
}

/// Apple Mail .emlx files: a line with the message length, the message and a
/// property list with flags. Returns (start, length) of the message.
pub(crate) fn emlx_bounds(data: &[u8]) -> Option<(usize, usize)> {
    let head = &data[..data.len().min(24)];
    let line_end = head.iter().position(|b| *b == b'\n')?;
    let line = std::str::from_utf8(&head[..line_end]).ok()?.trim_end_matches('\r').trim_end_matches([' ', '\t']);
    if line.is_empty() || line.len() > 12 || !line.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    Some((line_end + 1, line.parse().ok()?))
}

fn apply_emlx_flags(meta: &mut HeaderMeta, plist: &[u8]) {
    let text = String::from_utf8_lossy(plist);
    let Some(key) = text.find("<key>flags</key>") else { return };
    let rest = &text[key + 16..];
    let Some(start) = rest.find("<integer>") else { return };
    let digits: String = rest[start + 9..].chars().take_while(char::is_ascii_digit).collect();
    let Ok(flags) = digits.parse::<u64>() else { return };
    meta.is_read = flags & 0x01 != 0;
    meta.flagged = flags & 0x10 != 0;
}

fn apply_gmail_labels(meta: &mut HeaderMeta) -> Vec<String> {
    let is = |label: &str, names: &[&str]| names.iter().any(|n| label.eq_ignore_ascii_case(n));
    const READ: [&str; 5] = ["opened", "geöffnet", "geoeffnet", "read", "gelesen"];
    const UNREAD: [&str; 2] = ["unread", "ungelesen"];
    const STARRED: [&str; 3] = ["starred", "markiert", "mit stern"];
    let mut folders = Vec::new();
    for label in &meta.labels {
        if is(label, &READ) {
            meta.is_read = true;
        } else if is(label, &UNREAD) {
            meta.is_read = false;
        } else if is(label, &STARRED) {
            meta.flagged = true;
        } else {
            folders.push(label.clone());
        }
    }
    // Well-known folders first, so that they become the primary folder.
    let rank = |label: &String| match detect_special_folder(label, "", 0) {
        Some(SpecialFolder::Inbox) => 0,
        Some(SpecialFolder::Sent) => 1,
        Some(SpecialFolder::Drafts) => 2,
        Some(_) => 3,
        None => 4,
    };
    folders.sort_by_key(rank);
    folders
}

fn item_from_headers(meta: &HeaderMeta, size: i64) -> IndexedItem {
    let mut item = IndexedItem::new(ItemKind::Mail, "IPM.Note".into());
    item.set_subject(meta.subject.clone());
    item.set_from(if meta.from.name.is_empty() { meta.from.email.clone() } else { meta.from.name.clone() }, meta.from.email.clone());
    item.to_line =
        squash(&meta.to.iter().map(|m| if m.name.is_empty() { m.email.as_str() } else { m.name.as_str() }).collect::<Vec<_>>().join("; "));
    let text = |list: &[Mailbox]| list.iter().map(|m| format!("{} {}", m.name, m.email)).collect::<Vec<_>>().join(" ");
    item.s_to = fold_for_index(&format!("{} {} {} {}", item.to_line, text(&meta.to), text(&meta.cc), text(&meta.bcc)));
    item.date = meta.date;
    item.size = size;
    item.attachment_count = u32::from(meta.has_attachments);
    item.is_read = meta.is_read;
    item.flagged = meta.flagged;
    item.importance = importance_from_value(meta.importance);
    item
}

impl Builder<'_> {
    fn report(&mut self, progress: OpenProgress) {
        if self.last_report.elapsed().as_millis() >= REPORT_INTERVAL_MS {
            self.last_report = Instant::now();
            (self.progress)(progress);
        }
    }

    fn canceled(&self) -> Result<()> {
        if (self.is_canceled)() { Err(CoreError::Canceled) } else { Ok(()) }
    }

    fn create_folder(&mut self, name: String, parent: Option<usize>) -> usize {
        let index = self.folders.len();
        let special = detect_special_folder(&name, "", 0);
        self.folders.push(BuildFolder {
            id: index as u32 + 1,
            name,
            special,
            parent,
            children: Vec::new(),
            item_count: 0,
            unread_count: 0,
        });
        match parent {
            Some(p) => self.folders[p].children.push(index),
            None => self.roots.push(index),
        }
        index
    }

    fn add_item(&mut self, source: ItemSource, mut item: IndexedItem, folder: usize, extra: &[usize]) {
        item.id = self.items.len() as u32 + 1;
        item.folder_id = self.folders[folder].id;
        let mut all = vec![folder];
        for &e in extra {
            if !all.contains(&e) {
                all.push(e);
                item.extra_folder_ids.push(self.folders[e].id);
            }
        }
        for f in all {
            self.folders[f].item_count += 1;
            if !item.is_read {
                self.folders[f].unread_count += 1;
            }
        }
        self.sources.insert(item.id, source);
        self.items.push(item);
    }

    /// Apple Mail exports mailboxes as "Name.mbox" folders with an "mbox" file inside.
    fn apple_mail_mbox(&self, dir: &DirEntry) -> Option<DirEntry> {
        self.vfs.list(&dir.id).ok()?.into_iter().find(|e| !e.is_directory && e.name == "mbox")
    }

    /// Adds a directory as a folder. Apple Mail keeps a mailbox as "Name.mbox"
    /// directory with the messages in structural sub directories
    /// (".../Data/0/1/Messages/1234.emlx"); those are collected into the
    /// mailbox folder (`target`) instead of becoming folders of their own.
    fn add_directory(&mut self, dir: &DirEntry, parent: Option<usize>, depth: usize, target: Option<usize>) -> Result<()> {
        if depth > MAX_SCAN_DEPTH || self.sources.len() >= MAX_FILES {
            return Ok(());
        }
        let folder = target.unwrap_or_else(|| self.create_folder(display_name(&dir.name), parent));
        let mailbox = target.or_else(|| extension(&dir.name).eq("mbox").then_some(folder));
        let Ok(entries) = self.vfs.list(&dir.id) else { return Ok(()) };
        for entry in entries {
            if entry.name.starts_with('.') || self.sources.len() >= MAX_FILES {
                continue;
            }
            self.canceled()?;
            if entry.is_directory {
                if let Some(mbox) = self.apple_mail_mbox(&entry) {
                    self.add_mbox(&mbox.id, display_name(&entry.name), Some(folder))?;
                } else if mailbox.is_some() && extension(&entry.name) != "mbox" {
                    self.add_directory(&entry, Some(folder), depth + 1, mailbox)?;
                } else {
                    self.add_directory(&entry, Some(folder), depth + 1, None)?;
                }
                continue;
            }
            // Outlook data files are archives of their own and are opened separately.
            if matches!(extension(&entry.name).as_str(), "pst" | "ost") {
                continue;
            }
            match detect_local_format(&self.vfs, &entry.id, &entry.name).ok().flatten() {
                Some(LocalFormat::Mbox) => self.add_mbox(&entry.id, display_name(&entry.name), Some(folder))?,
                Some(format) => {
                    self.add_file(&entry.id, format, folder);
                    let name = self.folders[folder].name.clone();
                    let done = self.items.len() as i64;
                    self.report(OpenProgress { phase: OpenPhase::Scanning, done, total: 0, folder_name: Some(name) });
                }
                None => {}
            }
        }
        Ok(())
    }

    fn add_file(&mut self, id: &str, format: LocalFormat, folder: usize) {
        let result = match format {
            LocalFormat::Msg => self.add_msg(id, folder),
            _ => self.add_eml(id, folder),
        };
        if result.is_err() {
            self.skipped += 1;
        }
    }

    fn add_eml(&mut self, id: &str, folder: usize) -> Result<()> {
        let mut file = self.vfs.open(id)?;
        let size = file.metadata().map(|m| m.len()).unwrap_or(0);
        self.total_bytes += size as i64;
        let head = read_range(&mut file, 0, HEADER_READ_LIMIT.min(size as usize))?;
        let emlx = emlx_bounds(&head);
        let mut meta = header_meta(emlx.map_or(&head[..], |(start, _)| &head[start.min(head.len())..]));
        if let Some((start, length)) = emlx {
            let plist_start = (start + length) as u64;
            let plist = read_range(&mut file, plist_start, (size.saturating_sub(plist_start) as usize).min(HEADER_READ_LIMIT))?;
            apply_emlx_flags(&mut meta, &plist);
        }
        let item = item_from_headers(&meta, emlx.map_or(size as i64, |(_, length)| length as i64));
        self.add_item(ItemSource::Eml(id.to_string()), item, folder, &[]);
        Ok(())
    }

    fn add_msg(&mut self, id: &str, folder: usize) -> Result<()> {
        let data = self.vfs.read(id)?;
        self.total_bytes += data.len() as i64;
        let size = data.len() as i64;
        let message = open_msg(data)?;
        let mapi = message.item();
        let class = mapi.message_class();
        let mut item = IndexedItem::new(kind_of(&class), class.clone());
        let from = mapi.sender();
        item.set_subject(mapi.subject());
        item.set_from(from.name, from.email);
        item.to_line = squash(
            &message
                .recipients
                .iter()
                .filter(|r| r.kind == RecipientKind::To)
                .map(|r| if r.name.is_empty() { r.email.as_str() } else { r.name.as_str() })
                .collect::<Vec<_>>()
                .join("; "),
        );
        item.s_to = fold_for_index(&format!(
            "{} {}",
            item.to_line,
            message.recipients.iter().map(|r| format!("{} {}", r.name, r.email)).collect::<Vec<_>>().join(" ")
        ));
        let p = &message.props;
        item.date = [tag::CLIENT_SUBMIT_TIME, tag::MESSAGE_DELIVERY_TIME, tag::CREATION_TIME, tag::LAST_MODIFICATION_TIME]
            .iter()
            .find_map(|t| p.time(*t))
            .unwrap_or(0);
        item.size = size;
        item.is_read = mapi.is_read();
        item.flagged = mapi.flagged();
        item.importance = importance_from_value(mapi.importance());
        item.security = security_of_class(&class);
        // The whole item is loaded anyway, so it is indexed right away.
        apply_content(&mut item, &Resolved::Mapi(message));
        self.add_item(ItemSource::Msg(id.to_string()), item, folder, &[]);
        Ok(())
    }

    fn add_mbox(&mut self, id: &str, name: String, parent: Option<usize>) -> Result<()> {
        let mut file = self.vfs.open(id)?;
        let progress = &mut *self.progress;
        let mut last = Instant::now();
        let scan = scan_mbox(
            &mut file,
            &mut |done, total| {
                if last.elapsed().as_millis() >= REPORT_INTERVAL_MS {
                    last = Instant::now();
                    progress(OpenProgress {
                        phase: OpenPhase::Scanning,
                        done: done as i64,
                        total: total as i64,
                        folder_name: Some(name.clone()),
                    });
                }
            },
            self.is_canceled,
        )?;
        self.canceled()?;
        self.total_bytes += scan.size as i64;
        let fallback = self.create_folder(name.clone(), parent);
        let mut label_folders: HashMap<String, usize> = HashMap::new();
        let count = scan.offsets.len();
        for (i, &start) in scan.offsets.iter().enumerate() {
            let end = scan.offsets.get(i + 1).copied().unwrap_or(scan.size);
            let item = (|| -> Result<(IndexedItem, Vec<String>)> {
                let raw = read_range(&mut file, start, ((end - start) as usize).min(HEADER_READ_LIMIT))?;
                // Skip the "From " envelope line.
                let headers = raw.iter().position(|b| *b == b'\n').map_or(&raw[..], |p| &raw[p + 1..]);
                let mut meta = header_meta(headers);
                let labels = apply_gmail_labels(&mut meta);
                Ok((item_from_headers(&meta, (end - start) as i64), labels))
            })();
            match item {
                Ok((item, labels)) => {
                    let folders: Vec<usize> = labels.iter().map(|label| self.label_folder(label, fallback, &mut label_folders)).collect();
                    let primary = folders.first().copied().unwrap_or(fallback);
                    self.add_item(
                        ItemSource::Mbox { file: id.to_string(), start, end },
                        item,
                        primary,
                        folders.get(1..).unwrap_or_default(),
                    );
                }
                Err(_) => self.skipped += 1,
            }
            if i % 64 == 0 {
                self.canceled()?;
                self.report(OpenProgress {
                    phase: OpenPhase::Indexing,
                    done: i as i64,
                    total: count as i64,
                    folder_name: Some(name.clone()),
                });
            }
        }
        // With labels the file folder only keeps messages without any label; empty folders are pruned later.
        self.handles.insert(id.to_string(), file);
        Ok(())
    }

    /// Folder for a Gmail label; "A/B" labels become nested folders next to the file's folder.
    fn label_folder(&mut self, label: &str, fallback: usize, cache: &mut HashMap<String, usize>) -> usize {
        if let Some(&cached) = cache.get(label) {
            return cached;
        }
        let mut parent = self.folders[fallback].parent;
        let mut node = None;
        let mut path = String::new();
        for part in label.split('/').filter(|p| !p.is_empty()) {
            if !path.is_empty() {
                path.push('/');
            }
            path.push_str(part);
            let index = match cache.get(&path) {
                Some(&index) => index,
                None => {
                    let index = self.create_folder(part.to_string(), parent);
                    cache.insert(path.clone(), index);
                    index
                }
            };
            parent = Some(index);
            node = Some(index);
        }
        node.unwrap_or(fallback)
    }

    fn folder_tree(&self) -> Vec<FolderNode> {
        fn build(folders: &[BuildFolder], index: usize) -> FolderNode {
            let f = &folders[index];
            let mut node = FolderNode::new(f.id, f.name.clone(), f.special, "IPF.Note".into());
            node.item_count = f.item_count;
            node.unread_count = f.unread_count;
            node.children = f.children.iter().map(|&c| build(folders, c)).collect();
            node
        }
        let mut roots: Vec<FolderNode> = self.roots.iter().map(|&r| build(&self.folders, r)).collect();
        prune_empty(&mut roots);
        roots
    }
}

impl LocalSource {
    /// Opens a mail file or a folder of mail files.
    pub fn open(
        vfs: Vfs,
        root: DirEntry,
        progress: &mut dyn FnMut(OpenProgress),
        is_canceled: &dyn Fn() -> bool,
    ) -> Result<(LocalSource, ArchiveIndex)> {
        let started = Instant::now();
        progress(OpenProgress { phase: OpenPhase::Opening, done: 0, total: 0, folder_name: None });
        let mut builder = Builder {
            vfs: vfs.clone(),
            folders: Vec::new(),
            roots: Vec::new(),
            items: Vec::new(),
            sources: HashMap::new(),
            handles: HashMap::new(),
            skipped: 0,
            total_bytes: 0,
            progress,
            is_canceled,
            last_report: Instant::now(),
        };

        let format = if root.is_directory {
            if let Some(mbox) = builder.apple_mail_mbox(&root) {
                builder.add_mbox(&mbox.id, display_name(&root.name), None)?;
                ArchiveFormat::Mbox
            } else {
                builder.add_directory(&root, None, 0, None)?;
                ArchiveFormat::Folder
            }
        } else {
            match detect_local_format(&vfs, &root.id, &root.name)? {
                Some(LocalFormat::Mbox) => {
                    builder.add_mbox(&root.id, display_name(&root.name), None)?;
                    ArchiveFormat::Mbox
                }
                Some(format) => {
                    let folder = builder.create_folder(display_name(&root.name), None);
                    match format {
                        LocalFormat::Msg => builder.add_msg(&root.id, folder)?,
                        _ => builder.add_eml(&root.id, folder)?,
                    }
                    if format == LocalFormat::Msg { ArchiveFormat::Msg } else { ArchiveFormat::Eml }
                }
                None => return Err(CoreError::unsupported(format!("Unsupported file: {}", root.name))),
            }
        };
        if builder.items.is_empty() {
            return Err(CoreError::unsupported(format!("No messages found in {}", root.name)));
        }
        (builder.progress)(OpenProgress { phase: OpenPhase::Finishing, done: 0, total: 0, folder_name: None });
        let roots = builder.folder_tree();
        let items = std::mem::take(&mut builder.items);
        let index = build_index(
            roots,
            items,
            &root.id,
            &root.name,
            builder.total_bytes,
            &display_name(&root.name),
            format,
            builder.skipped,
            started,
        );
        Ok((LocalSource { vfs, sources: std::mem::take(&mut builder.sources), handles: std::mem::take(&mut builder.handles) }, index))
    }

    fn load_source(&mut self, id: u32) -> Result<Resolved> {
        let source = self.sources.get(&id).ok_or_else(|| CoreError::not_found(format!("Item {id} not found")))?;
        match source {
            ItemSource::Msg(file) => Ok(Resolved::Mapi(open_msg(self.vfs.read(file)?)?)),
            ItemSource::Eml(file) => {
                let data = self.vfs.read(file)?;
                let data = match emlx_bounds(&data) {
                    Some((start, length)) => data[start.min(data.len())..(start + length).min(data.len())].to_vec(),
                    None => data,
                };
                Ok(Resolved::Mime(crate::mime::parse_mime(data)?))
            }
            ItemSource::Mbox { file, start, end } => {
                let (start, end) = (*start, *end);
                if !self.handles.contains_key(file) {
                    let handle = self.vfs.open(file)?;
                    self.handles.insert(file.clone(), handle);
                }
                let handle = self.handles.get_mut(file).expect("handle inserted");
                Ok(Resolved::Mime(crate::mime::parse_mime(read_mbox_message(handle, start, end)?)?))
            }
        }
    }
}

impl Source for LocalSource {
    fn load(&mut self, id: u32) -> Result<Resolved> {
        self.load_source(id)
    }

    fn index_item(&mut self, item: &mut IndexedItem) -> Result<()> {
        let message = self.load_source(item.id)?;
        apply_content(item, &message);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_names() {
        assert_eq!(display_name("Archiv.mbox"), "Archiv");
        assert_eq!(display_name("Rechnung.EML"), "Rechnung");
        assert_eq!(display_name("Inbox"), "Inbox");
        assert_eq!(display_name("notes.txt"), "notes.txt");
    }

    #[test]
    fn emlx() {
        assert_eq!(emlx_bounds(b"1234      \nFrom: a"), Some((11, 1234)));
        assert_eq!(emlx_bounds(b"From: a\n"), None);
        let mut meta = HeaderMeta { is_read: true, ..HeaderMeta::default() };
        apply_emlx_flags(&mut meta, b"<plist><dict><key>flags</key>\n\t<integer>16</integer></dict></plist>");
        assert!(!meta.is_read && meta.flagged);
    }

    #[test]
    fn eml_heuristic() {
        assert!(looks_like_eml(b"Received: x\r\nFrom: a@b.c\r\nSubject: s\r\n\r\nbody"));
        assert!(!looks_like_eml(b"just some text\nwith lines"));
    }
}
