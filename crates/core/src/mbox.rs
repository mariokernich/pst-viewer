//! MBOX support (mboxo/mboxrd as written by Thunderbird, Apple Mail and Google
//! Takeout; port of `worker/mbox.ts`). Messages are located by scanning for
//! "From " separator lines and read on demand by byte range, so files of any
//! size work.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::sync::LazyLock;

use regex::bytes::Regex;

use crate::error::Result;

const CHUNK_SIZE: usize = 8 * 1024 * 1024;
const TAIL: usize = 8;
const SEPARATOR: &[u8] = b"\nFrom ";

static SEPARATOR_LINE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^From \S+\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b").unwrap());
static MBOXRD_QUOTE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?m)^>(>*From )").unwrap());

pub(crate) struct MboxScan {
    /// Byte offsets of the "From " separator lines.
    pub offsets: Vec<u64>,
    pub size: u64,
}

/// True if the data looks like the start of an MBOX file.
pub(crate) fn looks_like_mbox(start: &[u8]) -> bool {
    start.starts_with(b"From ")
}

/// A "From " line starts a message if the previous line is empty or it looks
/// like an envelope line.
fn is_separator(data: &[u8], newline: usize) -> bool {
    if newline == 0 || data[newline - 1] == b'\n' || (data[newline - 1] == b'\r' && newline >= 2 && data[newline - 2] == b'\n') {
        return true;
    }
    let line_start = newline + 1;
    let line_end = data[line_start..].iter().position(|b| *b == b'\n').map_or(data.len().min(line_start + 200), |p| line_start + p);
    let line = &data[line_start..line_end];
    SEPARATOR_LINE.is_match(line) || line.starts_with(b"From - ")
}

pub(crate) fn scan_mbox(file: &mut File, on_progress: &mut dyn FnMut(u64, u64), is_canceled: &dyn Fn() -> bool) -> Result<MboxScan> {
    let size = file.metadata()?.len();
    let mut offsets = Vec::new();
    let mut first = [0u8; 5];
    file.seek(SeekFrom::Start(0))?;
    let read = file.read(&mut first)?;
    if looks_like_mbox(&first[..read]) {
        offsets.push(0);
    }

    file.seek(SeekFrom::Start(0))?;
    let mut position: u64 = 0;
    let mut tail: Vec<u8> = Vec::new();
    let mut chunk = vec![0u8; CHUNK_SIZE];
    while position < size {
        let read = read_full(file, &mut chunk)?;
        if read == 0 {
            break;
        }
        let mut data = std::mem::take(&mut tail);
        let tail_len = data.len();
        data.extend_from_slice(&chunk[..read]);
        let base = position - tail_len as u64;
        let mut from = 0;
        while let Some(found) = crate::mime::find(&data[from..], SEPARATOR) {
            let index = from + found;
            // Matches lying completely inside the carried-over tail were handled before.
            if index + SEPARATOR.len() > tail_len && is_separator(&data, index) {
                offsets.push(base + index as u64 + 1);
            }
            from = index + 1;
        }
        tail = data[data.len().saturating_sub(TAIL)..].to_vec();
        position += read as u64;
        on_progress(position, size);
        if is_canceled() {
            break;
        }
    }
    Ok(MboxScan { offsets, size })
}

fn read_full(file: &mut File, buffer: &mut [u8]) -> std::io::Result<usize> {
    let mut total = 0;
    while total < buffer.len() {
        match file.read(&mut buffer[total..]) {
            Ok(0) => break,
            Ok(n) => total += n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        }
    }
    Ok(total)
}

/// Reads `length` bytes at `start` (fewer at the end of the file).
pub(crate) fn read_range(file: &mut File, start: u64, length: usize) -> Result<Vec<u8>> {
    file.seek(SeekFrom::Start(start))?;
    let mut data = vec![0u8; length];
    let read = read_full(file, &mut data)?;
    data.truncate(read);
    Ok(data)
}

/// Reads one message (without its "From " line) and undoes mboxrd quoting.
pub(crate) fn read_mbox_message(file: &mut File, start: u64, end: u64) -> Result<Vec<u8>> {
    let data = read_range(file, start, end.saturating_sub(start) as usize)?;
    Ok(unwrap_message(data))
}

pub(crate) fn unwrap_message(data: Vec<u8>) -> Vec<u8> {
    let mut message: &[u8] = &data;
    if message.starts_with(b"From ") {
        if let Some(line_end) = message.iter().position(|b| *b == b'\n') {
            message = &message[line_end + 1..];
        }
    }
    // Drop the blank line that separates messages.
    let mut trimmed = message.len();
    while trimmed > 0 && matches!(message[trimmed - 1], b'\n' | b'\r') {
        trimmed -= 1;
    }
    let message = &message[..trimmed];
    // mboxrd: ">From " lines in the body are stored with one additional ">".
    if crate::mime::find(message, b"\n>From ").is_some() || crate::mime::find(message, b"\n>>From ").is_some() {
        return MBOXRD_QUOTE.replace_all(message, &b"$1"[..]).into_owned();
    }
    message.to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn scans_and_reads_messages() {
        let content = b"From a@example.com Sat Mar 01 10:00:00 2025\nSubject: One\n\n>From the start.\n>>From quoted\n\nFrom b@example.com Sun Mar 02 10:00:00 2025\r\nSubject: Two\r\n\r\nBody\r\n\r\n";
        let mut file = tempfile::tempfile().unwrap();
        file.write_all(content).unwrap();
        let scan = scan_mbox(&mut file, &mut |_, _| {}, &|| false).unwrap();
        assert_eq!(scan.offsets.len(), 2);
        let first = read_mbox_message(&mut file, scan.offsets[0], scan.offsets[1]).unwrap();
        assert_eq!(String::from_utf8(first).unwrap(), "Subject: One\n\nFrom the start.\n>From quoted");
        let second = read_mbox_message(&mut file, scan.offsets[1], scan.size).unwrap();
        assert_eq!(String::from_utf8(second).unwrap(), "Subject: Two\r\n\r\nBody");
    }
}
