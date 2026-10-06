//! Test fixtures: EML, MBOX, EMLX and MSG files built in memory.

#![allow(dead_code)]

use std::io::{Cursor, Write};

use mail_builder::MessageBuilder;
use mail_builder::headers::address::Address;
use mail_builder::headers::date::Date;
use mail_builder::headers::raw::Raw;

pub struct Attachment<'a> {
    pub filename: &'a str,
    pub data: &'a [u8],
    pub content_type: &'a str,
    pub cid: Option<&'a str>,
}

pub struct Eml<'a> {
    pub from: (&'a str, &'a str),
    pub to: (&'a str, &'a str),
    pub subject: &'a str,
    pub text: Option<&'a str>,
    pub html: Option<&'a str>,
    /// Epoch seconds.
    pub date: i64,
    pub headers: &'a [(&'a str, &'a str)],
    pub attachments: &'a [Attachment<'a>],
}

impl Default for Eml<'_> {
    fn default() -> Self {
        Eml {
            from: ("", "x@example.com"),
            to: ("", "me@example.com"),
            subject: "",
            text: None,
            html: None,
            date: 1_740_823_200,
            headers: &[],
            attachments: &[],
        }
    }
}

pub fn build_eml(e: &Eml) -> Vec<u8> {
    let address = |(name, email): (&str, &str)| Address::new_address((!name.is_empty()).then(|| name.to_string()), email.to_string());
    let mut b = MessageBuilder::new()
        .from(address(e.from))
        .to(address(e.to))
        .subject(e.subject.to_string())
        .date(Date::new(e.date))
        .message_id(format!("{}@example.com", e.date));
    for (key, value) in e.headers {
        b = b.header(key.to_string(), Raw::new(value.to_string()));
    }
    if let Some(text) = e.text {
        b = b.text_body(text.to_string());
    }
    if let Some(html) = e.html {
        b = b.html_body(html.to_string());
    }
    for a in e.attachments {
        b = match a.cid {
            Some(cid) => b.inline(a.content_type.to_string(), cid.to_string(), a.data.to_vec()),
            None => b.attachment(a.content_type.to_string(), a.filename.to_string(), a.data.to_vec()),
        };
    }
    b.write_to_vec().unwrap()
}

/// Joins messages into an MBOX file (mboxrd quoting, envelope lines).
pub fn build_mbox(messages: &[Vec<u8>], crlf: bool) -> Vec<u8> {
    let nl = if crlf { "\r\n" } else { "\n" };
    let mut out = String::new();
    for message in messages {
        let body = String::from_utf8_lossy(message).replace("\r\n", "\n");
        let quoted: Vec<String> = body
            .split('\n')
            .map(|line| if line.trim_start_matches('>').starts_with("From ") { format!(">{line}") } else { line.to_string() })
            .collect();
        out.push_str(&format!("From sender@example.com Sat Mar 01 10:00:00 2025{nl}{}{nl}{nl}", quoted.join(nl)));
    }
    out.into_bytes()
}

/// Wraps a message like Apple Mail's .emlx files: length line, message, property list.
pub fn build_emlx(message: &[u8], flags: u32) -> Vec<u8> {
    let mut out = format!("{:<10}\n", message.len()).into_bytes();
    out.extend_from_slice(message);
    out.extend_from_slice(
        format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<plist version=\"1.0\">\n<dict>\n\t<key>flags</key>\n\t<integer>{flags}</integer>\n</dict>\n</plist>\n"
        )
        .as_bytes(),
    );
    out
}

// -----------------------------------------------------------------------------
// MSG ([MS-OXMSG]): just enough for the reader.

pub const PT_LONG: u16 = 0x0003;
pub const PT_UNICODE: u16 = 0x001F;
pub const PT_SYSTIME: u16 = 0x0040;
pub const PT_BINARY: u16 = 0x0102;
pub const PT_MV_UNICODE: u16 = 0x101F;

pub enum Value {
    Long(i32),
    Text(String),
    Time(i64),
    Binary(Vec<u8>),
    TextList(Vec<String>),
}

pub struct Prop {
    pub id: u16,
    pub value: Value,
}

pub fn text(id: u16, value: &str) -> Prop {
    Prop { id, value: Value::Text(value.to_string()) }
}

pub fn long(id: u16, value: i32) -> Prop {
    Prop { id, value: Value::Long(value) }
}

/// Epoch milliseconds.
pub fn time(id: u16, ms: i64) -> Prop {
    Prop { id, value: Value::Time(ms) }
}

pub struct MsgItem {
    pub props: Vec<Prop>,
    pub recipients: Vec<Vec<Prop>>,
    pub attachments: Vec<Vec<Prop>>,
    /// Attached items: attachment properties and the item.
    pub messages: Vec<(Vec<Prop>, MsgItem)>,
}

fn utf16(text: &str) -> Vec<u8> {
    text.encode_utf16().chain([0]).flat_map(u16::to_le_bytes).collect()
}

fn write_stream(cfb: &mut cfb::CompoundFile<Cursor<Vec<u8>>>, path: &str, data: &[u8]) {
    let mut stream = cfb.create_stream(path).unwrap();
    stream.write_all(data).unwrap();
}

fn write_props(cfb: &mut cfb::CompoundFile<Cursor<Vec<u8>>>, storage: &str, props: &[Prop], header: Vec<u8>) {
    let mut entries = header;
    for p in props {
        let kind = match p.value {
            Value::Long(_) => PT_LONG,
            Value::Text(_) => PT_UNICODE,
            Value::Time(_) => PT_SYSTIME,
            Value::Binary(_) => PT_BINARY,
            Value::TextList(_) => PT_MV_UNICODE,
        };
        let tag = (u32::from(p.id) << 16) | u32::from(kind);
        entries.extend_from_slice(&tag.to_le_bytes());
        entries.extend_from_slice(&6u32.to_le_bytes());
        let stream = format!("{storage}__substg1.0_{tag:08X}");
        match &p.value {
            Value::Long(v) => entries.extend_from_slice(&i64::from(*v).to_le_bytes()),
            Value::Time(ms) => entries.extend_from_slice(&((ms + 11_644_473_600_000) * 10_000).to_le_bytes()),
            Value::Text(t) => {
                let data = utf16(t);
                entries.extend_from_slice(&(data.len() as u64).to_le_bytes());
                write_stream(cfb, &stream, &data);
            }
            Value::Binary(b) => {
                entries.extend_from_slice(&(b.len() as u64).to_le_bytes());
                write_stream(cfb, &stream, b);
            }
            Value::TextList(list) => {
                entries.extend_from_slice(&((list.len() * 4) as u64).to_le_bytes());
                let lengths: Vec<u8> = list.iter().flat_map(|t| (utf16(t).len() as u32).to_le_bytes()).collect();
                write_stream(cfb, &stream, &lengths);
                for (i, t) in list.iter().enumerate() {
                    write_stream(cfb, &format!("{stream}-{i:08X}"), &utf16(t));
                }
            }
        }
    }
    write_stream(cfb, &format!("{storage}__properties_version1.0"), &entries);
}

fn write_item(cfb: &mut cfb::CompoundFile<Cursor<Vec<u8>>>, storage: &str, item: &MsgItem, embedded: bool) {
    let attachment_count = (item.attachments.len() + item.messages.len()) as u32;
    let mut header = vec![0u8; if embedded { 24 } else { 32 }];
    header[8..12].copy_from_slice(&(item.recipients.len() as u32).to_le_bytes());
    header[12..16].copy_from_slice(&attachment_count.to_le_bytes());
    header[16..20].copy_from_slice(&(item.recipients.len() as u32).to_le_bytes());
    header[20..24].copy_from_slice(&attachment_count.to_le_bytes());
    write_props(cfb, storage, &item.props, header);
    for (i, recipient) in item.recipients.iter().enumerate() {
        let path = format!("{storage}__recip_version1.0_#{i:08X}");
        cfb.create_storage(&path).unwrap();
        write_props(cfb, &format!("{path}/"), recipient, vec![0; 8]);
    }
    for (i, attachment) in item.attachments.iter().enumerate() {
        let path = format!("{storage}__attach_version1.0_#{i:08X}");
        cfb.create_storage(&path).unwrap();
        write_props(cfb, &format!("{path}/"), attachment, vec![0; 8]);
    }
    for (i, (attachment, inner)) in item.messages.iter().enumerate() {
        let path = format!("{storage}__attach_version1.0_#{:08X}", item.attachments.len() + i);
        cfb.create_storage(&path).unwrap();
        write_props(cfb, &format!("{path}/"), attachment, vec![0; 8]);
        let inner_path = format!("{path}/__substg1.0_3701000D");
        cfb.create_storage(&inner_path).unwrap();
        write_item(cfb, &format!("{inner_path}/"), inner, true);
    }
}

/// Named properties: (GUID index (2 = PS_PUBLIC_STRINGS, 3+ = custom GUIDs), LID or name).
pub enum Named<'a> {
    Lid(u16, u32),
    Name(u16, &'a str),
}

pub fn build_msg(item: &MsgItem, guids: &[[u8; 16]], named: &[Named]) -> Vec<u8> {
    let mut cfb = cfb::CompoundFile::create(Cursor::new(Vec::new())).unwrap();
    cfb.create_storage("/__nameid_version1.0").unwrap();
    let mut entries = Vec::new();
    let mut strings = Vec::new();
    for (index, entry) in named.iter().enumerate() {
        let (id, kind) = match entry {
            Named::Lid(guid, lid) => (*lid, guid << 1),
            Named::Name(guid, name) => {
                let offset = strings.len() as u32;
                let data: Vec<u8> = name.encode_utf16().flat_map(u16::to_le_bytes).collect();
                strings.extend_from_slice(&(data.len() as u32).to_le_bytes());
                strings.extend_from_slice(&data);
                while strings.len() % 4 != 0 {
                    strings.push(0);
                }
                (offset, (guid << 1) | 1)
            }
        };
        entries.extend_from_slice(&id.to_le_bytes());
        entries.extend_from_slice(&kind.to_le_bytes());
        entries.extend_from_slice(&(index as u16).to_le_bytes());
    }
    write_stream(&mut cfb, "/__nameid_version1.0/__substg1.0_00020102", &guids.concat());
    write_stream(&mut cfb, "/__nameid_version1.0/__substg1.0_00030102", &entries);
    write_stream(&mut cfb, "/__nameid_version1.0/__substg1.0_00040102", &strings);
    write_item(&mut cfb, "/", item, false);
    cfb.flush().unwrap();
    cfb.into_inner().into_inner()
}

/// A GUID in its binary (little-endian) MAPI layout.
pub const fn guid(d1: u32, d2: u16, d3: u16, d4: [u8; 8]) -> [u8; 16] {
    let a = d1.to_le_bytes();
    let b = d2.to_le_bytes();
    let c = d3.to_le_bytes();
    [a[0], a[1], a[2], a[3], b[0], b[1], c[0], c[1], d4[0], d4[1], d4[2], d4[3], d4[4], d4[5], d4[6], d4[7]]
}

pub const PSETID_APPOINTMENT: [u8; 16] = guid(0x0006_2002, 0, 0, [0xC0, 0, 0, 0, 0, 0, 0, 0x46]);
