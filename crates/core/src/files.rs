//! File names and types of attachments (port of `shared/files.ts` and the
//! preview type detection of `main/attachments.ts`).

use std::sync::LazyLock;

use regex::Regex;

use crate::model::PreviewKind;

/// Makes a string safe to use as a file name on all platforms.
pub fn sanitize_file_name(name: &str, fallback: &str) -> String {
    let replaced: String = name.chars().map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c }).collect();
    let collapsed = crate::text::squash(&replaced);
    let trimmed = collapsed.trim_matches(|c: char| c.is_whitespace() || c == '.');
    let cleaned: String = trimmed.chars().take(200).collect::<String>().trim().to_string();
    static RESERVED: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$").unwrap());
    if cleaned.is_empty() || RESERVED.is_match(&cleaned) {
        return if cleaned.is_empty() { fallback.to_string() } else { format!("{fallback}-{cleaned}") };
    }
    cleaned
}

/// Lower-case extension without dot, or "".
pub fn file_extension(name: &str) -> String {
    static EXT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)\.([a-z0-9-]{1,20})$").unwrap());
    EXT.captures(name.trim()).map(|c| c[1].to_lowercase()).unwrap_or_default()
}

/// File types that can run code when opened. They are never opened directly
/// from the viewer - the user has to save them explicitly.
const UNSAFE_EXTENSIONS: &[&str] = &[
    "action",
    "ade",
    "adp",
    "apk",
    "app",
    "application",
    "appref-ms",
    "applescript",
    "bas",
    "bat",
    "bin",
    "cab",
    "cmd",
    "com",
    "command",
    "cpl",
    "csh",
    "dll",
    "dmg",
    "exe",
    "gadget",
    "hta",
    "inf",
    "ins",
    "iso",
    "isp",
    "jar",
    "js",
    "jse",
    "ksh",
    "lnk",
    "mde",
    "mpkg",
    "msc",
    "msh",
    "msi",
    "msp",
    "mst",
    "osax",
    "pif",
    "pkg",
    "prg",
    "ps1",
    "ps1xml",
    "ps2",
    "psc1",
    "psm1",
    "py",
    "pyc",
    "rb",
    "reg",
    "run",
    "scf",
    "scpt",
    "scptd",
    "scr",
    "sct",
    "sh",
    "shb",
    "shs",
    "svg",
    "terminal",
    "tool",
    "url",
    "vb",
    "vbe",
    "vbs",
    "vhd",
    "vhdx",
    "webloc",
    "workflow",
    "ws",
    "wsc",
    "wsf",
    "wsh",
    "xpi",
    "zsh",
    "bash",
    "img",
    "html",
    "htm",
    "xhtml",
    "mht",
    "mhtml",
    "xml",
    "library-ms",
    "settingcontent-ms",
    "desktop",
    "appimage",
    "ipa",
    "xapk",
    "apks",
    "aab",
    "mobileconfig",
    "dex",
    "so",
];

/// True if opening the file with its default app could execute code.
pub fn is_unsafe_to_open(name: &str, mime_type: &str) -> bool {
    static UNSAFE_MIME: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?i)x-(ms)?dos(exec|-program)|x-msdownload|x-executable|x-sh\b|x-shellscript|javascript|x-apple-diskimage|java-archive|text/html|vnd\.android\.package-archive").unwrap()
    });
    UNSAFE_EXTENSIONS.contains(&file_extension(name).as_str()) || UNSAFE_MIME.is_match(mime_type)
}

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "ico", "heic", "heif", "tif", "tiff", "svg"];
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac"];
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "m4v", "mov", "webm", "ogv"];
const TEXT_EXTENSIONS: &[&str] = &[
    "txt",
    "text",
    "log",
    "md",
    "markdown",
    "json",
    "xml",
    "ini",
    "cfg",
    "conf",
    "yaml",
    "yml",
    "sql",
    "css",
    "js",
    "ts",
    "py",
    "java",
    "c",
    "h",
    "cpp",
    "cs",
    "sh",
    "bat",
    "ps1",
    "eml",
    "diff",
    "patch",
    "properties",
    "toml",
    "srt",
    "vtt",
    "rtf",
    "tex",
];

/// How an attachment can be previewed inside the app.
pub fn preview_kind(name: &str, mime_type: &str, is_message: bool) -> PreviewKind {
    if is_message {
        return PreviewKind::Message;
    }
    let ext = file_extension(name);
    let mime = mime_type.to_lowercase();
    let ext = ext.as_str();
    static IMAGE_MIME: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"^image/(png|jpe?g|gif|webp|bmp|avif|x-icon|heic|heif|tiff|svg\+xml)$").unwrap());
    if ext == "pdf" || mime == "application/pdf" {
        PreviewKind::Pdf
    } else if IMAGE_EXTENSIONS.contains(&ext) || IMAGE_MIME.is_match(&mime) {
        PreviewKind::Image
    } else if ext == "csv" || ext == "tsv" || mime == "text/csv" {
        PreviewKind::Csv
    } else if ext == "ics" || ext == "vcs" || mime == "text/calendar" || mime == "application/ics" {
        PreviewKind::Calendar
    } else if ext == "vcf" || mime == "text/vcard" || mime == "text/x-vcard" {
        PreviewKind::Contact
    } else if ext == "html" || ext == "htm" || ext == "xhtml" || mime == "text/html" {
        PreviewKind::Html
    } else if AUDIO_EXTENSIONS.contains(&ext) || mime.starts_with("audio/") {
        PreviewKind::Audio
    } else if VIDEO_EXTENSIONS.contains(&ext) || mime.starts_with("video/") {
        PreviewKind::Video
    } else if TEXT_EXTENSIONS.contains(&ext) || mime.starts_with("text/") || mime == "application/json" {
        PreviewKind::Text
    } else {
        PreviewKind::None
    }
}

/// File name of an attachment on disk; attached messages become .eml files.
pub(crate) fn attachment_file_name(name: &str, is_message: bool) -> String {
    let name = sanitize_file_name(name, if is_message { "message" } else { "attachment" });
    if is_message && !name.to_lowercase().ends_with(".eml") { format!("{name}.eml") } else { name }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_names() {
        assert_eq!(sanitize_file_name("  Re: Angebot / Q3?.pdf ", "attachment"), "Re_ Angebot _ Q3_.pdf");
        assert_eq!(sanitize_file_name("...", "attachment"), "attachment");
        assert_eq!(sanitize_file_name("CON.txt", "attachment"), "attachment-CON.txt");
        assert_eq!(attachment_file_name("Weitergeleitet: Info", true), "Weitergeleitet_ Info.eml");
    }

    #[test]
    fn flags_unsafe_files() {
        assert!(is_unsafe_to_open("setup.EXE", "application/octet-stream"));
        assert!(is_unsafe_to_open("x.bin", "application/x-msdownload"));
        assert!(is_unsafe_to_open("seite.html", "text/html"));
        assert!(!is_unsafe_to_open("rechnung.pdf", "application/pdf"));
    }

    #[test]
    fn preview_kinds() {
        assert_eq!(preview_kind("a.PDF", "", false), PreviewKind::Pdf);
        assert_eq!(preview_kind("foto", "image/heic", false), PreviewKind::Image);
        assert_eq!(preview_kind("termin.ics", "", false), PreviewKind::Calendar);
        assert_eq!(preview_kind("x", "", true), PreviewKind::Message);
        assert_eq!(
            preview_kind("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", false),
            PreviewKind::None
        );
    }
}
