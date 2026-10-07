//! An opened archive (port of `worker/service.ts`).
//!
//! Every archive gets a worker thread that owns the source (PST handles are
//! not thread-safe) and the item list. The methods of `ArchiveSession` send a
//! job to that thread and block until it is answered, so the apps call them
//! off the main thread. While the bodies are indexed in the background, the
//! worker answers jobs between two items.

use std::collections::{HashMap, VecDeque};
use std::fs::File;
use std::io::Write;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Instant;

use crate::archive::{ArchiveIndex, Source};
use crate::content::follow_path;
use crate::detail::message_detail;
use crate::eml::build_eml;
use crate::error::{CoreError, Result};
use crate::files::{attachment_file_name, is_unsafe_to_open, preview_kind};
use crate::index::collect_senders;
use crate::local::LocalSource;
use crate::model::{
    AttachmentFile, AttachmentMeta, IndexProgress, MessageDetail, MessageRef, MessageSummary, OpenProgress, OpenResult, SearchRequest,
    SearchResponse,
};
use crate::pst::{PstSource, pst_format};
use crate::search::run_search;
use crate::text::{make_snippet, squash};
use crate::vfs::{DirEntry, FileAccess, Vfs, file_from_fd, native_entry};

/// Progress reports of an archive, called on the archive's worker thread.
#[uniffi::export(with_foreign)]
pub trait ArchiveListener: Send + Sync {
    fn on_open_progress(&self, progress: OpenProgress);
    fn on_index_progress(&self, progress: IndexProgress);
}

/// Cancels opening an archive.
#[derive(uniffi::Object, Default)]
pub struct CancelToken {
    canceled: AtomicBool,
}

#[uniffi::export]
impl CancelToken {
    #[uniffi::constructor]
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn cancel(&self) {
        self.canceled.store(true, Ordering::Relaxed);
    }

    pub fn is_canceled(&self) -> bool {
        self.canceled.load(Ordering::Relaxed)
    }
}

type Reply<T> = Sender<Result<T>>;

enum Job {
    Info(Reply<OpenResult>),
    Search(SearchRequest, Reply<SearchResponse>),
    Page(u64, u32, u32, Reply<Option<Vec<MessageSummary>>>),
    Message(MessageRef, Reply<MessageDetail>),
    Attachment(MessageRef, u32, Reply<AttachmentFile>),
    AttachmentMeta(MessageRef, u32, Reply<AttachmentMeta>),
    SaveAttachment(MessageRef, u32, Target, Reply<AttachmentMeta>),
    ExportEml(MessageRef, Reply<Vec<u8>>),
    SaveEml(MessageRef, Target, Reply<i64>),
    Prioritize(Option<u32>),
}

/// Where a file the user saves is written: a path, or a file descriptor the
/// app opened for writing (Android). The descriptor is owned from the start,
/// so it is closed on every path, also when the job fails.
enum Target {
    Path(String),
    File(File),
}

impl Target {
    fn write(self, data: &[u8]) -> Result<()> {
        let mut file = match self {
            Target::Path(path) => File::create(&path).map_err(|e| CoreError::internal(format!("Cannot write {path}: {e}")))?,
            Target::File(file) => file,
        };
        file.write_all(data)?;
        file.flush()?;
        Ok(())
    }
}

#[derive(uniffi::Object)]
pub struct ArchiveSession {
    jobs: Mutex<Option<Sender<Job>>>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

enum Root {
    Native(String),
    Foreign(DirEntry, Arc<dyn FileAccess>),
}

#[uniffi::export]
impl ArchiveSession {
    /// Opens a file or folder by path. Blocks until the item list is built;
    /// bodies are indexed in the background afterwards.
    #[uniffi::constructor]
    pub fn open(path: String, listener: Option<Arc<dyn ArchiveListener>>, cancel: Option<Arc<CancelToken>>) -> Result<Arc<Self>> {
        Self::start(Root::Native(path), listener, cancel)
    }

    /// Opens a file or folder through the app's file access (Android).
    #[uniffi::constructor]
    pub fn open_with_access(
        root: DirEntry,
        access: Arc<dyn FileAccess>,
        listener: Option<Arc<dyn ArchiveListener>>,
        cancel: Option<Arc<CancelToken>>,
    ) -> Result<Arc<Self>> {
        Self::start(Root::Foreign(root, access), listener, cancel)
    }

    /// Store information, folders and senders (refined once indexing is done).
    pub fn info(&self) -> Result<OpenResult> {
        self.call(Job::Info)
    }

    pub fn search(&self, request: SearchRequest) -> Result<SearchResponse> {
        self.call(|reply| Job::Search(request, reply))
    }

    /// More items of a search result; None if the result is outdated.
    pub fn page(&self, token: u64, offset: u32, limit: u32) -> Result<Option<Vec<MessageSummary>>> {
        self.call(|reply| Job::Page(token, offset, limit, reply))
    }

    pub fn message(&self, message_ref: MessageRef) -> Result<MessageDetail> {
        self.call(|reply| Job::Message(message_ref, reply))
    }

    /// An attachment as file; attached messages are converted to .eml.
    pub fn attachment(&self, message_ref: MessageRef, index: u32) -> Result<AttachmentFile> {
        self.call(|reply| Job::Attachment(message_ref, index, reply))
    }

    /// File name and type of an attachment as it would be saved.
    pub fn attachment_meta(&self, message_ref: MessageRef, index: u32) -> Result<AttachmentMeta> {
        self.call(|reply| Job::AttachmentMeta(message_ref, index, reply))
    }

    /// Writes an attachment to a file the user chose (attached messages as
    /// .eml), without copying it through the app. This and `save_eml` are the
    /// only places where the core writes files.
    pub fn save_attachment(&self, message_ref: MessageRef, index: u32, path: String) -> Result<AttachmentMeta> {
        self.call(|reply| Job::SaveAttachment(message_ref, index, Target::Path(path), reply))
    }

    /// Like `save_attachment`, writing to a file descriptor opened for writing
    /// (e.g. a Storage Access Framework document); the core closes it.
    pub fn save_attachment_fd(&self, message_ref: MessageRef, index: u32, fd: i32) -> Result<AttachmentMeta> {
        let file = file_from_fd(fd)?;
        self.call(|reply| Job::SaveAttachment(message_ref, index, Target::File(file), reply))
    }

    /// The message as .eml (RFC 5322).
    pub fn export_eml(&self, message_ref: MessageRef) -> Result<Vec<u8>> {
        self.call(|reply| Job::ExportEml(message_ref, reply))
    }

    /// Writes the message as .eml to a file the user chose; returns the size.
    pub fn save_eml(&self, message_ref: MessageRef, path: String) -> Result<i64> {
        self.call(|reply| Job::SaveEml(message_ref, Target::Path(path), reply))
    }

    /// Like `save_eml`, writing to a file descriptor opened for writing; the core closes it.
    pub fn save_eml_fd(&self, message_ref: MessageRef, fd: i32) -> Result<i64> {
        let file = file_from_fd(fd)?;
        self.call(|reply| Job::SaveEml(message_ref, Target::File(file), reply))
    }

    /// Indexes the items of this folder first (usually the one on screen).
    pub fn prioritize_folder(&self, folder_id: Option<u32>) {
        if let Some(jobs) = self.jobs.lock().ok().and_then(|j| j.clone()) {
            let _ = jobs.send(Job::Prioritize(folder_id));
        }
    }

    /// Stops the worker and releases the files. Later calls fail with `Closed`.
    pub fn close(&self) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.take();
        }
        if let Some(worker) = self.worker.lock().ok().and_then(|mut w| w.take()) {
            // The worker finishes its current item and stops.
            let _ = worker.join();
        }
    }
}

impl Drop for ArchiveSession {
    fn drop(&mut self) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.take();
        }
    }
}

impl ArchiveSession {
    fn call<T>(&self, make: impl FnOnce(Reply<T>) -> Job) -> Result<T> {
        let (tx, rx) = mpsc::channel();
        {
            let jobs = self.jobs.lock().map_err(|_| CoreError::Closed)?;
            let sender = jobs.as_ref().ok_or(CoreError::Closed)?;
            sender.send(make(tx)).map_err(|_| CoreError::Closed)?;
        }
        rx.recv().map_err(|_| CoreError::Closed)?
    }

    fn start(root: Root, listener: Option<Arc<dyn ArchiveListener>>, cancel: Option<Arc<CancelToken>>) -> Result<Arc<Self>> {
        let (jobs_tx, jobs_rx) = mpsc::channel::<Job>();
        let (opened_tx, opened_rx) = mpsc::channel::<Result<()>>();
        let worker = thread::Builder::new()
            .name("pst-viewer-archive".into())
            .spawn(move || {
                let opened = catch_unwind(AssertUnwindSafe(|| open_source(root, listener.as_deref(), cancel.as_deref())))
                    .unwrap_or_else(|_| Err(CoreError::internal("The archive could not be read")));
                match opened {
                    Ok((source, index)) => {
                        let _ = opened_tx.send(Ok(()));
                        Worker::new(source, index, listener).run(jobs_rx);
                    }
                    Err(err) => {
                        let _ = opened_tx.send(Err(err));
                    }
                }
            })
            .map_err(|e| CoreError::internal(format!("Cannot start the worker: {e}")))?;
        match opened_rx.recv() {
            Ok(Ok(())) => Ok(Arc::new(Self { jobs: Mutex::new(Some(jobs_tx)), worker: Mutex::new(Some(worker)) })),
            Ok(Err(err)) => {
                let _ = worker.join();
                Err(err)
            }
            Err(_) => Err(CoreError::internal("The archive could not be read")),
        }
    }
}

fn open_source(
    root: Root,
    listener: Option<&dyn ArchiveListener>,
    cancel: Option<&CancelToken>,
) -> Result<(Box<dyn Source>, ArchiveIndex)> {
    let mut progress = |p: OpenProgress| {
        if let Some(listener) = listener {
            listener.on_open_progress(p);
        }
    };
    let is_canceled = || cancel.is_some_and(CancelToken::is_canceled);
    let (vfs, entry) = match root {
        Root::Native(path) => (Vfs::Native, native_entry(&path)?),
        Root::Foreign(entry, access) => (Vfs::Foreign(access), entry),
    };
    if !entry.is_directory {
        let mut file = vfs.open(&entry.id)?;
        if pst_format(&mut file)?.is_some() {
            let (source, index) = PstSource::open(file, &entry.id, &entry.name, &mut progress, &is_canceled)?;
            return Ok((Box::new(source), index));
        }
    }
    let (source, index) = LocalSource::open(vfs, entry, &mut progress, &is_canceled)?;
    Ok((Box::new(source), index))
}

const TEXT_CACHE_SIZE: usize = 400;
const MAX_PAGE_SIZE: u32 = 1000;
const SNIPPET_RADIUS: usize = 70;
/// Snippets of one page are computed within this time; later rows keep their preview.
const SNIPPET_BUDGET_MS: u128 = 400;

struct SearchState {
    token: u64,
    order: Vec<usize>,
    body_terms: Vec<String>,
}

struct Worker {
    source: Box<dyn Source>,
    index: ArchiveIndex,
    listener: Option<Arc<dyn ArchiveListener>>,
    /// Positions of items whose content is not indexed yet.
    pending: VecDeque<usize>,
    pending_total: usize,
    last_search: Option<SearchState>,
    next_token: u64,
    texts: HashMap<u32, String>,
    text_order: VecDeque<u32>,
}

impl Worker {
    fn new(source: Box<dyn Source>, index: ArchiveIndex, listener: Option<Arc<dyn ArchiveListener>>) -> Self {
        let mut pending: Vec<usize> = (0..index.items.len()).filter(|&i| !index.items[i].indexed).collect();
        // Start with the inbox, like the desktop app.
        let inbox = index.folders.special.iter().find(|(_, s)| **s == crate::model::SpecialFolder::Inbox).map(|(id, _)| *id);
        if let Some(ids) = inbox.and_then(|id| index.folders.subtree_ids.get(&id)) {
            pending.sort_by_key(|&i| !ids.contains(&index.items[i].folder_id));
        }
        let pending_total = pending.len();
        Self {
            source,
            index,
            listener,
            pending: pending.into(),
            pending_total,
            last_search: None,
            next_token: 1,
            texts: HashMap::new(),
            text_order: VecDeque::new(),
        }
    }

    fn run(mut self, jobs: Receiver<Job>) {
        let mut last_report = Instant::now();
        if !self.pending.is_empty() {
            self.report_index(false);
        }
        loop {
            // Answer waiting jobs first so that the UI stays responsive while indexing.
            loop {
                match jobs.try_recv() {
                    Ok(job) => self.handle(job),
                    Err(TryRecvError::Empty) => break,
                    Err(TryRecvError::Disconnected) => return,
                }
            }
            match self.pending.pop_front() {
                Some(position) => {
                    let item = &mut self.index.items[position];
                    let indexed = catch_unwind(AssertUnwindSafe(|| self.source.index_item(item)));
                    // Unreadable items keep their list data.
                    if !matches!(indexed, Ok(Ok(()))) {
                        self.index.items[position].indexed = true;
                    }
                    if self.pending.is_empty() {
                        self.index.content_indexed = true;
                        self.index.senders = collect_senders(&self.index.items);
                        self.report_index(true);
                    } else if last_report.elapsed().as_millis() > 250 {
                        last_report = Instant::now();
                        self.report_index(false);
                    }
                }
                None => match jobs.recv() {
                    Ok(job) => self.handle(job),
                    Err(_) => return,
                },
            }
        }
    }

    fn report_index(&self, finished: bool) {
        if let Some(listener) = &self.listener {
            let total = self.pending_total as u32;
            let done = if finished { total } else { (self.pending_total - self.pending.len()) as u32 };
            listener.on_index_progress(IndexProgress { done, total, finished });
        }
    }

    fn handle(&mut self, job: Job) {
        match job {
            Job::Info(reply) => {
                let _ = reply.send(Ok(self.index.open_result()));
            }
            Job::Search(request, reply) => {
                let _ = reply.send(self.guarded(|w| w.search(request)));
            }
            Job::Page(token, offset, limit, reply) => {
                let _ = reply.send(self.guarded(|w| Ok(w.page(token, offset, limit))));
            }
            Job::Message(message_ref, reply) => {
                let _ = reply.send(self.guarded(|w| w.message(message_ref)));
            }
            Job::Attachment(message_ref, index, reply) => {
                let _ = reply.send(self.guarded(|w| {
                    let (meta, data) = w.attachment(message_ref, index, true)?;
                    Ok(AttachmentFile {
                        file_name: meta.file_name,
                        mime_type: meta.mime_type,
                        is_message: meta.is_message,
                        can_open: meta.can_open,
                        preview_kind: meta.preview_kind,
                        data,
                    })
                }));
            }
            Job::AttachmentMeta(message_ref, index, reply) => {
                let _ = reply.send(self.guarded(|w| Ok(w.attachment(message_ref, index, false)?.0)));
            }
            Job::SaveAttachment(message_ref, index, target, reply) => {
                let _ = reply.send(self.guarded(|w| {
                    let (meta, data) = w.attachment(message_ref, index, true)?;
                    target.write(&data)?;
                    Ok(meta)
                }));
            }
            Job::ExportEml(message_ref, reply) => {
                let _ = reply.send(self.guarded(|w| {
                    let message = w.resolve(&message_ref)?;
                    build_eml(&message, 0)
                }));
            }
            Job::SaveEml(message_ref, target, reply) => {
                let _ = reply.send(self.guarded(|w| {
                    let data = build_eml(&w.resolve(&message_ref)?, 0)?;
                    target.write(&data)?;
                    Ok(data.len() as i64)
                }));
            }
            Job::Prioritize(folder_id) => self.prioritize(folder_id),
        }
    }

    /// Runs a job; a panic becomes an error instead of stopping the worker.
    fn guarded<T>(&mut self, job: impl FnOnce(&mut Self) -> Result<T>) -> Result<T> {
        catch_unwind(AssertUnwindSafe(|| job(self)))
            .unwrap_or_else(|_| Err(CoreError::internal("Unexpected error while reading the archive")))
    }

    fn prioritize(&mut self, folder_id: Option<u32>) {
        let Some(ids) = folder_id.and_then(|id| self.index.folders.subtree_ids.get(&id)) else {
            return;
        };
        let items = &self.index.items;
        let (mut first, rest): (VecDeque<usize>, VecDeque<usize>) =
            self.pending.drain(..).partition(|&p| ids.contains(&items[p].folder_id));
        first.extend(rest);
        self.pending = first;
    }

    fn search(&mut self, request: SearchRequest) -> Result<SearchResponse> {
        let started = Instant::now();
        let outcome = run_search(&self.index, &request);
        let token = self.next_token;
        self.next_token += 1;
        let total = outcome.order.len() as u32;
        self.last_search = Some(SearchState { token, order: outcome.order, body_terms: outcome.body_terms });
        let items = self.summaries(0, request.page_size.clamp(1, MAX_PAGE_SIZE));
        Ok(SearchResponse {
            token,
            total,
            groups: outcome.groups,
            items,
            highlight_terms: outcome.highlight_terms,
            is_search: outcome.is_search,
            took_ms: started.elapsed().as_millis() as i64,
        })
    }

    fn page(&mut self, token: u64, offset: u32, limit: u32) -> Option<Vec<MessageSummary>> {
        if self.last_search.as_ref().is_none_or(|s| s.token != token) {
            return None;
        }
        Some(self.summaries(offset, limit.min(MAX_PAGE_SIZE)))
    }

    fn summaries(&mut self, offset: u32, limit: u32) -> Vec<MessageSummary> {
        let Some(state) = &self.last_search else { return Vec::new() };
        let end = (offset as usize + limit as usize).min(state.order.len());
        let positions: Vec<usize> = state.order.get(offset as usize..end).unwrap_or_default().to_vec();
        let terms = state.body_terms.clone();
        let started = Instant::now();
        positions
            .into_iter()
            .map(|position| {
                let item = &self.index.items[position];
                // While searching the body, show the text around the first match instead of the preview.
                let wants_snippet = !terms.is_empty()
                    && terms.iter().any(|t| item.s_body.contains(t.as_str()))
                    && started.elapsed().as_millis() < SNIPPET_BUDGET_MS;
                let id = item.id;
                let snippet =
                    if wants_snippet { self.body_text(id).and_then(|text| make_snippet(&text, &terms, SNIPPET_RADIUS)) } else { None };
                self.index.items[position].summary(snippet)
            })
            .collect()
    }

    /// Body text (whitespace collapsed) for search snippets, LRU cached.
    fn body_text(&mut self, id: u32) -> Option<String> {
        if let Some(text) = self.texts.get(&id) {
            self.text_order.retain(|t| *t != id);
            self.text_order.push_back(id);
            return Some(text.clone());
        }
        let text = squash(&self.source.text(id).ok()?);
        self.texts.insert(id, text.clone());
        self.text_order.push_back(id);
        if self.text_order.len() > TEXT_CACHE_SIZE {
            if let Some(oldest) = self.text_order.pop_front() {
                self.texts.remove(&oldest);
            }
        }
        Some(text)
    }

    fn resolve(&mut self, message_ref: &MessageRef) -> Result<crate::content::Resolved> {
        if self.index.item(message_ref.id).is_none() {
            return Err(CoreError::not_found(format!("Item {} not found", message_ref.id)));
        }
        let message = self.source.load(message_ref.id)?;
        follow_path(message, &message_ref.path)
    }

    fn message(&mut self, message_ref: MessageRef) -> Result<MessageDetail> {
        let message = self.resolve(&message_ref)?;
        let indexed = if message_ref.path.is_empty() { self.index.item(message_ref.id) } else { None };
        Ok(message_detail(&message, message_ref, indexed))
    }

    /// An attachment's file name, type and (with `with_data`) bytes; attached
    /// Outlook items are converted to .eml.
    fn attachment(&mut self, message_ref: MessageRef, index: u32, with_data: bool) -> Result<(AttachmentMeta, Vec<u8>)> {
        let message = self.resolve(&message_ref)?;
        let attachment = message.content().attachments.get(index as usize).ok_or_else(|| CoreError::not_found("Attachment not found"))?;
        let data = match (with_data, attachment.is_outlook_item()) {
            (false, _) => Vec::new(),
            (true, true) => build_eml(&attachment.open_message()?, 0)?,
            (true, false) => attachment.read()?,
        };
        let file_name = attachment_file_name(&attachment.name, attachment.is_message);
        let mime_type = if attachment.is_message { "message/rfc822".to_string() } else { attachment.mime_type.clone() };
        let meta = AttachmentMeta {
            can_open: !is_unsafe_to_open(&file_name, &mime_type),
            preview_kind: preview_kind(&file_name, &mime_type, attachment.is_message),
            file_name,
            mime_type,
            is_message: attachment.is_message,
            size: if with_data { data.len() as i64 } else { attachment.size },
        };
        Ok((meta, data))
    }
}
