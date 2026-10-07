//! File access. The core reads archives either by path (desktop, iOS with
//! security-scoped URLs) or through a `FileAccess` implemented by the app
//! (Android: content URIs of the Storage Access Framework, opened as file
//! descriptors). Files are only ever opened for reading.

use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use std::sync::Arc;

use crate::error::{CoreError, Result};

/// An entry of a directory listed by a `FileAccess`.
#[derive(uniffi::Record, Clone, Debug)]
pub struct DirEntry {
    /// Opaque id passed back to `list` / `open_fd` (e.g. a document URI).
    pub id: String,
    pub name: String,
    pub is_directory: bool,
    pub size: i64,
}

/// File access implemented by the app.
#[uniffi::export(with_foreign)]
pub trait FileAccess: Send + Sync {
    /// The entries of a directory (not recursive).
    fn list(&self, directory: String) -> Result<Vec<DirEntry>, CoreError>;
    /// Opens a file read-only and returns a file descriptor. The core takes
    /// ownership and closes it.
    fn open_fd(&self, file: String) -> Result<i32, CoreError>;
}

#[derive(Clone)]
pub(crate) enum Vfs {
    Native,
    Foreign(Arc<dyn FileAccess>),
}

impl Vfs {
    pub fn open(&self, id: &str) -> Result<File> {
        match self {
            Vfs::Native => File::open(id).map_err(|e| match e.kind() {
                std::io::ErrorKind::NotFound => CoreError::not_found(format!("File not found: {id}")),
                _ => CoreError::read_failed(format!("{id}: {e}")),
            }),
            Vfs::Foreign(access) => {
                let fd = access.open_fd(id.to_string())?;
                file_from_fd(fd)
            }
        }
    }

    pub fn read(&self, id: &str) -> Result<Vec<u8>> {
        let mut data = Vec::new();
        self.open(id)?.read_to_end(&mut data)?;
        Ok(data)
    }

    pub fn list(&self, directory: &str) -> Result<Vec<DirEntry>> {
        let mut entries = match self {
            Vfs::Native => {
                let mut entries = Vec::new();
                for entry in fs::read_dir(directory)? {
                    let Ok(entry) = entry else { continue };
                    // Symbolic links are followed by metadata(); broken ones are skipped.
                    let Ok(meta) = fs::metadata(entry.path()) else { continue };
                    entries.push(DirEntry {
                        id: entry.path().to_string_lossy().into_owned(),
                        name: entry.file_name().to_string_lossy().into_owned(),
                        is_directory: meta.is_dir(),
                        size: meta.len() as i64,
                    });
                }
                entries
            }
            Vfs::Foreign(access) => access.list(directory.to_string())?,
        };
        entries.sort_by(|a, b| crate::folders::compare_names(&a.name, &b.name));
        Ok(entries)
    }
}

/// Name and kind of a native path.
pub(crate) fn native_entry(path: &str) -> Result<DirEntry> {
    let meta = fs::metadata(path).map_err(|_| CoreError::not_found(format!("File not found: {path}")))?;
    let name = Path::new(path).file_name().map_or_else(|| path.to_string(), |n| n.to_string_lossy().into_owned());
    Ok(DirEntry { id: path.to_string(), name, is_directory: meta.is_dir(), size: meta.len() as i64 })
}

#[cfg(unix)]
pub(crate) fn file_from_fd(fd: i32) -> Result<File> {
    use std::os::fd::FromRawFd;
    if fd < 0 {
        return Err(CoreError::read_failed("Invalid file descriptor"));
    }
    // SAFETY: the app hands over ownership of an open descriptor (readable, or
    // writable for saving).
    Ok(unsafe { File::from_raw_fd(fd) })
}

#[cfg(not(unix))]
pub(crate) fn file_from_fd(_fd: i32) -> Result<File> {
    Err(CoreError::internal("File descriptors are not supported on this platform"))
}
