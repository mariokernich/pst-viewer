//! RTF bodies of Outlook items: decompression ([MS-OXRTFCP]), de-encapsulation
//! of HTML and plain text ([MS-OXRTFEX], following the rules of the
//! `rtf-stream-parser` package used by the desktop app, including its Outlook
//! quirks mode) and a simple text extraction for genuine RTF documents.

use std::collections::HashMap;
use std::sync::LazyLock;

use regex::Regex;

use crate::codepage;

pub(crate) struct RtfBody {
    pub html: Option<String>,
    pub text: String,
}

// -----------------------------------------------------------------------------
// Decompression

const COMPRESSED: u32 = 0x7546_5A4C; // "LZFu"
const UNCOMPRESSED: u32 = 0x414C_454D; // "MELA"
const PREBUFFER: &[u8] = b"{\\rtf1\\ansi\\mac\\deff0\\deftab720{\\fonttbl;}{\\f0\\fnil \\froman \\fswiss \\fmodern \\fscript \\fdecor MS Sans SerifSymbolArialTimes New RomanCourier{\\colortbl\\red0\\green0\\blue0\r\n\\par \\pard\\plain\\f0\\fs20\\b\\i\\u\\tab\\tx";

fn u32_at(data: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_le_bytes(data.get(offset..offset + 4)?.try_into().ok()?))
}

/// Decompresses `PidTagRtfCompressed`. The CRC is not verified: a damaged
/// body is better than none.
pub(crate) fn decompress_rtf(data: &[u8]) -> Option<Vec<u8>> {
    let raw_size = u32_at(data, 4)? as usize;
    let kind = u32_at(data, 8)?;
    let body = data.get(16..)?;
    match kind {
        UNCOMPRESSED => Some(body[..raw_size.min(body.len())].to_vec()),
        COMPRESSED => {
            let mut dictionary = [0u8; 4096];
            dictionary[..PREBUFFER.len()].copy_from_slice(PREBUFFER);
            let mut write = PREBUFFER.len();
            let mut out = Vec::with_capacity(raw_size.min(64 * 1024 * 1024));
            let mut pos = 0;
            'outer: while pos < body.len() {
                let control = body[pos];
                pos += 1;
                for bit in 0..8 {
                    if control & (1 << bit) == 0 {
                        let Some(&byte) = body.get(pos) else { break 'outer };
                        pos += 1;
                        out.push(byte);
                        dictionary[write] = byte;
                        write = (write + 1) % 4096;
                    } else {
                        let Some(pair) = body.get(pos..pos + 2) else { break 'outer };
                        pos += 2;
                        let word = u16::from_be_bytes([pair[0], pair[1]]);
                        let offset = usize::from(word >> 4);
                        let length = usize::from(word & 0xF) + 2;
                        if offset == write {
                            break 'outer;
                        }
                        for i in 0..length {
                            let byte = dictionary[(offset + i) % 4096];
                            out.push(byte);
                            dictionary[write] = byte;
                            write = (write + 1) % 4096;
                        }
                    }
                }
            }
            Some(out)
        }
        _ => None,
    }
}

// -----------------------------------------------------------------------------
// Tokens

#[derive(Clone, Copy, Debug, PartialEq)]
enum Token<'a> {
    Open,
    Close,
    Word(&'a str, Option<i32>),
    Symbol(u8),
    Hex(u8),
    Text(&'a [u8]),
}

struct Tokenizer<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Iterator for Tokenizer<'a> {
    type Item = Token<'a>;

    fn next(&mut self) -> Option<Token<'a>> {
        let data = self.data;
        loop {
            let byte = *data.get(self.pos)?;
            match byte {
                b'{' => {
                    self.pos += 1;
                    return Some(Token::Open);
                }
                b'}' => {
                    self.pos += 1;
                    return Some(Token::Close);
                }
                b'\r' | b'\n' => self.pos += 1,
                b'\\' => {
                    let Some(&next) = data.get(self.pos + 1) else {
                        self.pos += 1;
                        return None;
                    };
                    if next.is_ascii_alphabetic() {
                        let start = self.pos + 1;
                        let mut end = start;
                        while end < data.len() && data[end].is_ascii_alphabetic() && end - start < 32 {
                            end += 1;
                        }
                        // Safe: ASCII letters only.
                        let word = std::str::from_utf8(&data[start..end]).unwrap_or_default();
                        let mut p = end;
                        let negative = data.get(p) == Some(&b'-') && data.get(p + 1).is_some_and(u8::is_ascii_digit);
                        if negative {
                            p += 1;
                        }
                        let digits = p;
                        while p < data.len() && data[p].is_ascii_digit() && p - digits < 10 {
                            p += 1;
                        }
                        let param = (p > digits).then(|| {
                            let value: i64 = std::str::from_utf8(&data[digits..p]).ok().and_then(|s| s.parse().ok()).unwrap_or(0);
                            let value = if negative { -value } else { value };
                            value.clamp(i64::from(i32::MIN), i64::from(i32::MAX)) as i32
                        });
                        if data.get(p) == Some(&b' ') {
                            p += 1;
                        }
                        self.pos = p;
                        return Some(Token::Word(word, param));
                    }
                    if next == b'\'' {
                        let hex = data
                            .get(self.pos + 2..self.pos + 4)
                            .and_then(|h| std::str::from_utf8(h).ok())
                            .and_then(|h| u8::from_str_radix(h, 16).ok());
                        if let Some(value) = hex {
                            self.pos += 4;
                            return Some(Token::Hex(value));
                        }
                    }
                    self.pos += 2;
                    return Some(Token::Symbol(next));
                }
                _ => {
                    let start = self.pos;
                    while self.pos < data.len() && !matches!(data[self.pos], b'{' | b'}' | b'\\' | b'\r' | b'\n') {
                        self.pos += 1;
                    }
                    return Some(Token::Text(&data[start..self.pos]));
                }
            }
        }
    }
}

fn tokens(rtf: &[u8]) -> Tokenizer<'_> {
    Tokenizer { data: rtf, pos: 0 }
}

/// Code page of an RTF \fcharset value.
fn charset_codepage(charset: i32) -> Option<u32> {
    Some(match charset {
        0 => 1252,
        77 => 10000,
        89 => 10007,
        128 => 932,
        129 => 949,
        134 => 936,
        136 => 950,
        161 => 1253,
        162 => 1254,
        163 => 1258,
        177 => 1255,
        178 => 1256,
        186 => 1257,
        204 => 1251,
        222 => 874,
        238 => 1250,
        _ => return None,
    })
}

// -----------------------------------------------------------------------------
// De-encapsulation

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Html,
    Text,
}

#[derive(Clone, Default)]
struct GroupState {
    uc: u32,
    ignorable: bool,
    in_htmltag: bool,
    /// Inside \fonttbl, \colortbl, \stylesheet or \pntext.
    in_table: bool,
    in_fonttbl: bool,
    htmlrtf: bool,
    font: Option<i32>,
}

static CHARSET: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#"(?i)(\bcharset=)([\w-]+)(")"#).unwrap());

struct DeEncapsulator {
    mode: Option<Mode>,
    stack: Vec<GroupState>,
    state: GroupState,
    ansi_codepage: u32,
    default_font: Option<i32>,
    fonts: HashMap<i32, u32>,
    font_entry: Option<i32>,
    skip: usize,
    pending: Vec<u8>,
    out: String,
    charset_fixed: bool,
}

impl DeEncapsulator {
    fn suppressed(&self) -> bool {
        let s = &self.state;
        s.htmlrtf || (!s.in_htmltag && (s.ignorable || s.in_table))
    }

    fn codepage(&self) -> u32 {
        if self.state.in_htmltag {
            return self.ansi_codepage;
        }
        self.state.font.or(self.default_font).and_then(|f| self.fonts.get(&f).copied()).unwrap_or(self.ansi_codepage)
    }

    fn push(&mut self, text: &str) {
        if self.suppressed() || text.is_empty() {
            return;
        }
        if self.mode == Some(Mode::Html) {
            if self.state.in_htmltag {
                if !self.charset_fixed && CHARSET.is_match(text) {
                    // The output is Unicode now, whatever the original charset was.
                    self.charset_fixed = true;
                    self.out.push_str(&CHARSET.replace(text, "${1}UTF-8${3}"));
                    return;
                }
            } else if text.contains(['<', '>']) {
                self.out.push_str(&text.replace('<', "&lt;").replace('>', "&gt;"));
                return;
            }
        }
        self.out.push_str(text);
    }

    fn flush(&mut self) {
        if self.pending.is_empty() {
            return;
        }
        let bytes = std::mem::take(&mut self.pending);
        let text = codepage::decode(&bytes, Some(self.codepage()));
        self.push(&text);
    }

    fn run(mut self, rtf: &[u8]) -> Option<(Mode, String)> {
        let mut last: Option<Token> = None;
        let mut last_last: Option<Token> = None;
        let mut count = 0usize;

        for token in tokens(rtf) {
            count += 1;

            // Characters after \uN replace the Unicode character in older readers.
            let mut token = token;
            match token {
                Token::Open | Token::Close => self.skip = 0,
                Token::Word(..) | Token::Symbol(_) | Token::Hex(_) if self.skip > 0 => {
                    self.skip -= 1;
                    continue;
                }
                Token::Text(data) if self.skip > 0 => {
                    if self.skip >= data.len() {
                        self.skip -= data.len();
                        continue;
                    }
                    token = Token::Text(&data[self.skip..]);
                    self.skip = 0;
                }
                _ => {}
            }

            let previous = last;
            let before_previous = last_last;
            last_last = last;
            last = Some(token);

            if self.mode.is_none() && (matches!(token, Token::Text(_)) || count > 10) {
                return None;
            }
            // Outlook quirks mode: inside \htmlrtf only font changes and its end count,
            // not even group braces (Outlook does not balance them there).
            if self.state.htmlrtf && !matches!(token, Token::Word("f" | "htmlrtf", _)) {
                continue;
            }

            if !matches!(token, Token::Hex(_) | Token::Text(_)) {
                self.flush();
            }

            match token {
                Token::Open => {
                    self.stack.push(self.state.clone());
                }
                Token::Close => {
                    let closing_font_entry = self.state.in_fonttbl;
                    match self.stack.pop() {
                        Some(previous) => self.state = previous,
                        None => break,
                    }
                    if closing_font_entry {
                        self.font_entry = None;
                    }
                    if self.stack.is_empty() {
                        break;
                    }
                }
                Token::Text(data) => self.pending.extend_from_slice(data),
                Token::Hex(byte) => self.pending.push(byte),
                Token::Symbol(symbol) => match symbol {
                    b'{' | b'}' | b'\\' => self.push(&(symbol as char).to_string()),
                    b'~' => self.push("\u{00A0}"),
                    b'_' => self.push("\u{00AD}"),
                    b'\n' | b'\r' => self.push("\r\n"),
                    _ => {}
                },
                Token::Word(word, param) => {
                    let after_open = matches!(previous, Some(Token::Open));
                    let after_star = matches!(previous, Some(Token::Symbol(b'*'))) && matches!(before_previous, Some(Token::Open));
                    if after_star {
                        self.state.ignorable = true;
                        if word == "htmltag" {
                            self.state.in_htmltag = true;
                        }
                    } else if after_open && matches!(word, "fonttbl" | "colortbl" | "stylesheet" | "pntext") {
                        self.state.in_table = true;
                        self.state.in_fonttbl = word == "fonttbl";
                    }
                    self.word(word, param);
                }
            }
        }
        self.flush();
        self.mode.map(|mode| (mode, self.out))
    }

    fn word(&mut self, word: &str, param: Option<i32>) {
        match word {
            "fromhtml" if self.stack.len() == 1 && self.mode.is_none() => self.mode = Some(Mode::Html),
            "fromtext" if self.stack.len() == 1 && self.mode.is_none() => self.mode = Some(Mode::Text),
            "htmlrtf" => self.state.htmlrtf = param != Some(0),
            "ansicpg" => {
                if let Some(cp) = param.filter(|p| *p > 0) {
                    self.ansi_codepage = cp as u32;
                }
            }
            "deff" => self.default_font = param,
            "f" => {
                if self.state.in_fonttbl {
                    self.font_entry = param;
                } else {
                    self.state.font = param;
                }
            }
            "fcharset" | "cpg" if self.state.in_fonttbl => {
                let codepage =
                    if word == "fcharset" { param.and_then(charset_codepage) } else { param.filter(|p| *p > 0).map(|p| p as u32) };
                if let (Some(font), Some(cp)) = (self.font_entry, codepage) {
                    self.fonts.insert(font, cp);
                }
            }
            "uc" => self.state.uc = param.unwrap_or(0).max(0) as u32,
            "u" => {
                if let Some(value) = param {
                    let code = if value < 0 { value + 0x10000 } else { value } as u32;
                    if let Some(c) = char::from_u32(code) {
                        self.push(&c.to_string());
                    }
                    self.skip = self.state.uc as usize;
                }
            }
            "par" | "line" => self.push("\r\n"),
            "tab" => self.push("\t"),
            "lquote" => self.push("\u{2018}"),
            "rquote" => self.push("\u{2019}"),
            "ldblquote" => self.push("\u{201C}"),
            "rdblquote" => self.push("\u{201D}"),
            "bullet" => self.push("\u{2022}"),
            "endash" => self.push("\u{2013}"),
            "emdash" => self.push("\u{2014}"),
            _ => {}
        }
    }
}

fn deencapsulate(rtf: &[u8]) -> Option<(Mode, String)> {
    DeEncapsulator {
        mode: None,
        stack: Vec::new(),
        state: GroupState { uc: 1, ..GroupState::default() },
        ansi_codepage: 1252,
        default_font: None,
        fonts: HashMap::new(),
        font_entry: None,
        skip: 0,
        pending: Vec::new(),
        out: String::new(),
        charset_fixed: false,
    }
    .run(rtf)
}

// -----------------------------------------------------------------------------
// Plain text extraction

const SKIP_DESTINATIONS: [&str; 25] = [
    "fonttbl",
    "colortbl",
    "stylesheet",
    "info",
    "pict",
    "object",
    "themedata",
    "colorschememapping",
    "latentstyles",
    "datastore",
    "xmlnstbl",
    "listtable",
    "listoverridetable",
    "rsidtbl",
    "generator",
    "header",
    "footer",
    "headerl",
    "headerr",
    "footerl",
    "footerr",
    "filetbl",
    "revtbl",
    "mmathPr",
    "pgdsctbl",
];

/// Minimal RTF to text converter (paragraphs, tabs, hex and Unicode escapes).
pub(crate) fn rtf_to_text(rtf: &[u8]) -> String {
    let mut out = String::new();
    let mut codepage = 1252u32;
    let mut stack: Vec<(bool, u32)> = Vec::new();
    let mut skip = false;
    let mut uc = 1u32;
    let mut pending_skip = 0u32;
    let mut bytes: Vec<u8> = Vec::new();

    let flush = |bytes: &mut Vec<u8>, out: &mut String, skip: bool, codepage: u32| {
        if !bytes.is_empty() {
            if !skip {
                out.push_str(&codepage::decode(bytes, Some(codepage)));
            }
            bytes.clear();
        }
    };

    for token in tokens(rtf) {
        match token {
            Token::Open => {
                flush(&mut bytes, &mut out, skip, codepage);
                stack.push((skip, uc));
            }
            Token::Close => {
                flush(&mut bytes, &mut out, skip, codepage);
                if let Some((s, u)) = stack.pop() {
                    skip = s;
                    uc = u;
                }
            }
            Token::Hex(byte) => {
                if pending_skip > 0 {
                    pending_skip -= 1;
                } else {
                    bytes.push(byte);
                }
            }
            Token::Text(data) => {
                flush(&mut bytes, &mut out, skip, codepage);
                let mut data = data;
                let drop = (pending_skip as usize).min(data.len());
                data = &data[drop..];
                pending_skip -= drop as u32;
                if !skip {
                    out.push_str(&codepage::decode(data, Some(codepage)));
                }
            }
            Token::Symbol(symbol) => {
                flush(&mut bytes, &mut out, skip, codepage);
                match symbol {
                    b'\\' | b'{' | b'}' if !skip => out.push(symbol as char),
                    b'*' => skip = true,
                    b'~' if !skip => out.push(' '),
                    b'\n' | b'\r' if !skip => out.push('\n'),
                    _ => {}
                }
            }
            Token::Word(word, param) => {
                flush(&mut bytes, &mut out, skip, codepage);
                if SKIP_DESTINATIONS.contains(&word) {
                    skip = true;
                } else if word == "ansicpg" {
                    if let Some(p) = param.filter(|p| *p > 0) {
                        codepage = p as u32;
                    }
                } else if word == "uc" {
                    uc = param.unwrap_or(1).max(0) as u32;
                } else if word == "u" {
                    if let Some(value) = param {
                        if !skip {
                            let code = if value < 0 { value + 0x10000 } else { value } as u32;
                            if let Some(c) = char::from_u32(code) {
                                out.push(c);
                            }
                        }
                        pending_skip = uc;
                    }
                } else if !skip {
                    match word {
                        "par" | "line" | "sect" | "page" | "row" => out.push('\n'),
                        "tab" | "cell" => out.push('\t'),
                        "emdash" => out.push('—'),
                        "endash" => out.push('–'),
                        "bullet" => out.push('•'),
                        "lquote" => out.push('‘'),
                        "rquote" => out.push('’'),
                        "ldblquote" => out.push('“'),
                        "rdblquote" => out.push('”'),
                        _ => {}
                    }
                }
            }
        }
    }
    flush(&mut bytes, &mut out, skip, codepage);
    out
}

/// Turns a decompressed RTF body into HTML or text. Outlook usually stores
/// HTML or plain text encapsulated in RTF; genuine RTF documents fall back to
/// a simple text extraction.
pub(crate) fn convert_rtf(rtf: &[u8]) -> Option<RtfBody> {
    if !rtf.starts_with(b"{\\rtf") {
        return None;
    }
    let head = &rtf[..rtf.len().min(2048)];
    let encapsulated = head.windows(9).any(|w| w == b"\\fromhtml" || w == b"\\fromtext");
    if encapsulated {
        if let Some((mode, content)) = deencapsulate(rtf) {
            return Some(match mode {
                Mode::Html => RtfBody { html: Some(content), text: String::new() },
                Mode::Text => RtfBody { html: None, text: content },
            });
        }
    }
    Some(RtfBody { html: None, text: rtf_to_text(rtf) })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decompresses_spec_example() {
        // [MS-OXRTFCP] 3.1.1.1: "{\rtf1\ansi\ansicpg1252\pard hello world}\r\n"
        let data: [u8; 49] = [
            0x2d, 0x00, 0x00, 0x00, 0x2b, 0x00, 0x00, 0x00, 0x4c, 0x5a, 0x46, 0x75, 0xf1, 0xc5, 0xc7, 0xa7, 0x03, 0x00, 0x0a, 0x00, 0x72,
            0x63, 0x70, 0x67, 0x31, 0x32, 0x35, 0x42, 0x32, 0x0a, 0xf3, 0x20, 0x68, 0x65, 0x6c, 0x09, 0x00, 0x20, 0x62, 0x77, 0x05, 0xb0,
            0x6c, 0x64, 0x7d, 0x0a, 0x80, 0x0f, 0xa0,
        ];
        let rtf = decompress_rtf(&data).unwrap();
        assert_eq!(String::from_utf8(rtf).unwrap(), "{\\rtf1\\ansi\\ansicpg1252\\pard hello world}\r\n");
    }

    #[test]
    fn deencapsulates_html() {
        let rtf = br#"{\rtf1\ansi\ansicpg1252\fromhtml1 \deff0{\fonttbl{\f0\fswiss Arial;}{\f1\fcharset204 Arial Cyr;}}
{\*\htmltag19 <html>}{\*\htmltag34 <head><meta http-equiv="Content-Type" content="text/html; charset=windows-1252">}
{\*\htmltag64 <body>}\htmlrtf {\htmlrtf0 {\*\htmltag84 <p>}Gr\'fc\'dfe a<b \u8364?\htmlrtf\par }\htmlrtf0{\*\htmltag92 </p>}
{\f1 \'cf\'f0\'e8}{\*\htmltag72 </body>}{\*\htmltag8 </html>}}"#;
        let body = convert_rtf(rtf).unwrap();
        let html = body.html.unwrap();
        assert!(html.contains("charset=UTF-8\""), "{html}");
        assert!(html.contains("<p>Grüße a&lt;b €</p>"), "{html}");
        assert!(html.contains("При"), "{html}");
        assert!(!html.contains("Arial"));
    }

    #[test]
    fn extracts_text_from_rtf() {
        let rtf = br"{\rtf1\ansi\ansicpg1252{\fonttbl{\f0 Arial;}}\pard Hallo\par Gr\'fc\'dfe\tab \u8364? Ende}";
        let body = convert_rtf(rtf).unwrap();
        assert_eq!(body.html, None);
        assert_eq!(body.text, "Hallo\nGrüße\t€ Ende");
    }
}
