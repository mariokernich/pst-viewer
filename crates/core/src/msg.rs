//! Outlook item files (.msg, [MS-OXMSG]): compound files with property
//! streams, recipient and attachment storages and attached items.

use std::cell::RefCell;
use std::io::{Cursor, Read};
use std::rc::Rc;

use crate::codepage;
use crate::content::{AttachmentBody, ContentAttachment, MapiMessage, MessageContent, mapi_content, name_or, with_extension};
use crate::error::{CoreError, Result};
use crate::mapi::{AttachmentMeta, NamedMap, PropBag, Value, recipient_from, tag};
use crate::time::filetime_to_ms;

const PT_I2: u16 = 0x0002;
const PT_LONG: u16 = 0x0003;
const PT_R4: u16 = 0x0004;
const PT_DOUBLE: u16 = 0x0005;
const PT_CURRENCY: u16 = 0x0006;
const PT_APPTIME: u16 = 0x0007;
const PT_BOOLEAN: u16 = 0x000B;
const PT_I8: u16 = 0x0014;
const PT_STRING8: u16 = 0x001E;
const PT_UNICODE: u16 = 0x001F;
const PT_SYSTIME: u16 = 0x0040;
const PT_BINARY: u16 = 0x0102;
const PT_MV_STRING8: u16 = 0x101E;
const PT_MV_UNICODE: u16 = 0x101F;

/// OLE compound file signature, used by .msg files.
pub(crate) fn looks_like_msg(start: &[u8]) -> bool {
    start.starts_with(&[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
}

pub(crate) struct MsgFile {
    cfb: RefCell<cfb::CompoundFile<Cursor<Vec<u8>>>>,
    named: Rc<NamedMap>,
}

impl MsgFile {
    pub fn open(data: Vec<u8>) -> Result<Rc<MsgFile>> {
        let cfb =
            cfb::CompoundFile::open(Cursor::new(data)).map_err(|e| CoreError::unsupported(format!("Not an Outlook item file: {e}")))?;
        let file = MsgFile { cfb: RefCell::new(cfb), named: Rc::new(NamedMap::default()) };
        let stream = |name: &str| file.read_stream(&format!("/__nameid_version1.0/__substg1.0_{name}")).unwrap_or_default();
        let named = NamedMap::parse(&stream("00020102"), &stream("00030102"), &stream("00040102"));
        Ok(Rc::new(MsgFile { named: Rc::new(named), ..file }))
    }

    pub fn read_stream(&self, path: &str) -> Result<Vec<u8>> {
        let mut cfb = self.cfb.borrow_mut();
        let mut stream = cfb.open_stream(path).map_err(|_| CoreError::not_found(format!("Stream {path} not found")))?;
        let mut data = Vec::new();
        stream.read_to_end(&mut data)?;
        Ok(data)
    }

    fn stream_len(&self, path: &str) -> Option<u64> {
        self.cfb.borrow().entry(path).ok().filter(|e| e.is_stream()).map(|e| e.len())
    }

    fn is_storage(&self, path: &str) -> bool {
        self.cfb.borrow().is_storage(path)
    }

    /// Names of the direct children of a storage: (name, is_storage).
    fn children(&self, storage: &str) -> Vec<(String, bool)> {
        let cfb = self.cfb.borrow();
        match cfb.read_storage(storage) {
            Ok(entries) => entries.map(|e| (e.name().to_string(), e.is_storage())).collect(),
            Err(_) => Vec::new(),
        }
    }

    /// Properties of a storage: fixed-size values from the property stream,
    /// variable-size values from their `__substg1.0_` streams.
    fn props(&self, storage: &str, header_len: usize) -> PropBag {
        let mut bag = PropBag::default();
        let stream = self.read_stream(&join(storage, "__properties_version1.0")).unwrap_or_default();
        let mut eight_bit: Vec<(u16, Vec<u8>)> = Vec::new();
        let mut eight_bit_lists: Vec<(u16, Vec<Vec<u8>>)> = Vec::new();
        for entry in stream.get(header_len..).unwrap_or_default().chunks_exact(16) {
            let ptag = u32::from_le_bytes([entry[0], entry[1], entry[2], entry[3]]);
            let (id, kind) = ((ptag >> 16) as u16, (ptag & 0xFFFF) as u16);
            let value = &entry[8..16];
            let int = |n: usize| -> i64 {
                let mut bytes = [0u8; 8];
                bytes[..n].copy_from_slice(&value[..n]);
                i64::from_le_bytes(bytes)
            };
            let parsed = match kind {
                PT_I2 => Value::Int(i64::from(i16::from_le_bytes([value[0], value[1]]))),
                PT_LONG => Value::Int(i64::from(i32::from_le_bytes([value[0], value[1], value[2], value[3]]))),
                PT_R4 => Value::Float(f64::from(f32::from_le_bytes([value[0], value[1], value[2], value[3]]))),
                PT_DOUBLE => Value::Float(f64::from_le_bytes(value.try_into().unwrap_or_default())),
                PT_APPTIME => Value::Time(((f64::from_le_bytes(value.try_into().unwrap_or_default()) - 25_569.0) * 86_400_000.0) as i64),
                PT_CURRENCY | PT_I8 => Value::Int(int(8)),
                PT_BOOLEAN => Value::Bool(value[0] != 0),
                PT_SYSTIME => filetime_to_ms(int(8)).map_or(Value::Other, Value::Time),
                _ => Value::Other,
            };
            if parsed != Value::Other {
                bag.props.insert(id, parsed);
            }
        }

        for (name, is_storage) in self.children(storage) {
            let Some(hex) = name.strip_prefix("__substg1.0_") else { continue };
            if is_storage || hex.len() != 8 {
                // Attached items (PT_OBJECT storages) are handled separately; "-0000000N" are list values.
                if is_storage && hex.len() == 8 && hex.ends_with("000D") {
                    if let Ok(ptag) = u32::from_str_radix(hex, 16) {
                        bag.props.insert((ptag >> 16) as u16, Value::Object(0));
                    }
                }
                continue;
            }
            let Ok(ptag) = u32::from_str_radix(hex, 16) else { continue };
            let (id, kind) = ((ptag >> 16) as u16, (ptag & 0xFFFF) as u16);
            let path = join(storage, &name);
            match kind {
                PT_UNICODE => {
                    let data = self.read_stream(&path).unwrap_or_default();
                    bag.props.insert(id, Value::Str(utf16(&data)));
                }
                PT_STRING8 => eight_bit.push((id, self.read_stream(&path).unwrap_or_default())),
                PT_BINARY => {
                    // Attachment data is read on demand.
                    if id != tag::ATTACH_DATA {
                        bag.props.insert(id, Value::Bin(self.read_stream(&path).unwrap_or_default()));
                    }
                }
                PT_MV_UNICODE | PT_MV_STRING8 => {
                    let lengths = self.read_stream(&path).unwrap_or_default();
                    let count = lengths.len() / 4;
                    let values: Vec<Vec<u8>> =
                        (0..count.min(1024)).filter_map(|i| self.read_stream(&format!("{path}-{i:08X}")).ok()).collect();
                    if kind == PT_MV_UNICODE {
                        bag.props.insert(id, Value::StrList(values.iter().map(|v| utf16(v)).collect()));
                    } else {
                        eight_bit_lists.push((id, values));
                    }
                }
                _ => {}
            }
        }

        let cp = bag.codepage();
        for (id, bytes) in eight_bit {
            bag.props.insert(id, Value::Str(string8(&bytes, cp)));
        }
        for (id, list) in eight_bit_lists {
            bag.props.insert(id, Value::StrList(list.iter().map(|b| string8(b, cp)).collect()));
        }
        bag
    }
}

fn join(storage: &str, name: &str) -> String {
    if storage.ends_with('/') { format!("{storage}{name}") } else { format!("{storage}/{name}") }
}

fn utf16(data: &[u8]) -> String {
    let units: Vec<u16> = data.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
    let end = units.iter().rposition(|u| *u != 0).map_or(0, |i| i + 1);
    String::from_utf16_lossy(&units[..end])
}

fn string8(bytes: &[u8], codepage: Option<u32>) -> String {
    let end = bytes.iter().rposition(|b| *b != 0).map_or(0, |i| i + 1);
    codepage::decode(&bytes[..end], codepage)
}

/// Loads the item stored in `storage` ("/" for the file itself).
pub(crate) fn load_message(file: &Rc<MsgFile>, storage: &str, embedded: bool) -> Result<MapiMessage> {
    let props = file.props(storage, if embedded { 24 } else { 32 });
    if props.props.is_empty() {
        return Err(CoreError::read_failed("The Outlook item has no properties"));
    }
    let mut children = file.children(storage);
    children.sort();

    let recipients = children
        .iter()
        .filter(|(name, is_storage)| *is_storage && name.starts_with("__recip_version1.0_"))
        .filter_map(|(name, _)| recipient_from(&file.props(&join(storage, name), 8)))
        .collect();

    let mut attachments = Vec::new();
    for (i, (name, _)) in children.iter().filter(|(name, is_storage)| *is_storage && name.starts_with("__attach_version1.0_")).enumerate() {
        let path = join(storage, name);
        let props = file.props(&path, 8);
        let meta = AttachmentMeta::from_props(&props);
        let embedded_storage = join(&path, "__substg1.0_3701000D");
        if meta.is_embedded_message() || file.is_storage(&embedded_storage) {
            let mut title = meta.name.clone();
            if title.trim().is_empty() {
                title = file.props(&embedded_storage, 24).string(tag::SUBJECT);
            }
            attachments.push(ContentAttachment {
                name: with_extension(&name_or(&title, || format!("attachment-{}", i + 1)), "message/rfc822", true),
                size: meta.declared_size,
                mime_type: "message/rfc822".into(),
                content_id: meta.content_id,
                hidden: meta.hidden,
                is_message: true,
                body: AttachmentBody::MsgEmbedded(Rc::clone(file), embedded_storage),
            });
            continue;
        }
        let data_stream = join(&path, "__substg1.0_37010102");
        let size = file.stream_len(&data_stream);
        let is_message = meta.is_mime_message();
        let mime_type = if !meta.mime_type.is_empty() {
            meta.mime_type.clone()
        } else if is_message {
            "message/rfc822".to_string()
        } else {
            "application/octet-stream".to_string()
        };
        attachments.push(ContentAttachment {
            name: with_extension(&name_or(&meta.name, || format!("attachment-{}", i + 1)), &mime_type, is_message),
            size: size.map_or(meta.declared_size, |s| s as i64),
            mime_type,
            content_id: meta.content_id,
            hidden: meta.hidden,
            is_message,
            body: if size.is_some() { AttachmentBody::MsgData(Rc::clone(file), data_stream) } else { AttachmentBody::Missing },
        });
    }

    let message = MapiMessage {
        props,
        named: Rc::clone(&file.named),
        recipients,
        content: MessageContent { html: None, text: String::new(), text_derived: false, attachments, security: None },
    };
    let content = mapi_content(&message);
    Ok(MapiMessage { content, ..message })
}

/// Opens a .msg file.
pub(crate) fn open_msg(data: Vec<u8>) -> Result<MapiMessage> {
    let file = MsgFile::open(data)?;
    load_message(&file, "/", false)
}
