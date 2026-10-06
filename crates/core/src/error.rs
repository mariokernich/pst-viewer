use std::io;

/// Errors reported to the apps. The variants correspond to the error codes of
/// the desktop app (NOT_FOUND, NOT_PST, READ_FAILED, NOT_OPEN, CANCELED).
#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum CoreError {
    /// The file, item or attachment does not exist.
    #[error("Not found: {message}")]
    NotFound { message: String },
    /// The file is not a supported mail archive.
    #[error("Unsupported file: {message}")]
    Unsupported { message: String },
    /// The archive could not be read (damaged or unreadable file).
    #[error("Read failed: {message}")]
    ReadFailed { message: String },
    /// The archive has been closed.
    #[error("The archive is closed")]
    Closed,
    /// Opening was canceled.
    #[error("Canceled")]
    Canceled,
    #[error("{message}")]
    Internal { message: String },
}

impl CoreError {
    pub(crate) fn not_found(message: impl Into<String>) -> Self {
        Self::NotFound { message: message.into() }
    }

    pub(crate) fn unsupported(message: impl Into<String>) -> Self {
        Self::Unsupported { message: message.into() }
    }

    pub(crate) fn read_failed(message: impl Into<String>) -> Self {
        Self::ReadFailed { message: message.into() }
    }

    pub(crate) fn internal(message: impl Into<String>) -> Self {
        Self::Internal { message: message.into() }
    }
}

impl From<io::Error> for CoreError {
    fn from(err: io::Error) -> Self {
        match err.kind() {
            io::ErrorKind::NotFound => Self::not_found(err.to_string()),
            _ => Self::read_failed(err.to_string()),
        }
    }
}

impl From<uniffi::UnexpectedUniFFICallbackError> for CoreError {
    fn from(err: uniffi::UnexpectedUniFFICallbackError) -> Self {
        Self::internal(err.reason)
    }
}

pub(crate) type Result<T, E = CoreError> = std::result::Result<T, E>;
