//! MAPI properties of Outlook items, shared by PST messages and .msg files:
//! property values, named properties and the fields derived from them
//! (port of `worker/pstFields.ts`, `worker/content.ts` and the item parts of
//! `worker/details.ts`).

use std::collections::HashMap;
use std::sync::LazyLock;

use regex::Regex;

use crate::codepage;
use crate::html::html_to_text;
use crate::model::{AppointmentInfo, ContactField, Mailbox, Recipient, RecipientKind, SpecialFolder, TaskInfo};
use crate::rtf::{convert_rtf, decompress_rtf};
use crate::text::{squash, tidy_text};
use crate::time::iso_string;

/// Property ids (`PidTag…`).
pub(crate) mod tag {
    pub const IMPORTANCE: u16 = 0x0017;
    pub const MESSAGE_CLASS: u16 = 0x001A;
    pub const SUBJECT: u16 = 0x0037;
    pub const CLIENT_SUBMIT_TIME: u16 = 0x0039;
    pub const SENT_REPRESENTING_NAME: u16 = 0x0042;
    pub const REPLY_RECIPIENT_NAMES: u16 = 0x0050;
    pub const SENT_REPRESENTING_EMAIL_ADDRESS: u16 = 0x0065;
    pub const TRANSPORT_MESSAGE_HEADERS: u16 = 0x007D;
    pub const SENDER_NAME: u16 = 0x0C1A;
    pub const SENDER_EMAIL_ADDRESS: u16 = 0x0C1F;
    pub const RECIPIENT_TYPE: u16 = 0x0C15;
    pub const DISPLAY_BCC: u16 = 0x0E02;
    pub const DISPLAY_CC: u16 = 0x0E03;
    pub const DISPLAY_TO: u16 = 0x0E04;
    pub const MESSAGE_DELIVERY_TIME: u16 = 0x0E06;
    pub const MESSAGE_FLAGS: u16 = 0x0E07;
    pub const MESSAGE_SIZE: u16 = 0x0E08;
    pub const ATTACH_SIZE: u16 = 0x0E20;
    pub const BODY: u16 = 0x1000;
    pub const RTF_COMPRESSED: u16 = 0x1009;
    pub const HTML: u16 = 0x1013;
    pub const INTERNET_MESSAGE_ID: u16 = 0x1035;
    pub const FLAG_STATUS: u16 = 0x1090;
    pub const DISPLAY_NAME: u16 = 0x3001;
    pub const EMAIL_ADDRESS: u16 = 0x3003;
    pub const CREATION_TIME: u16 = 0x3007;
    pub const LAST_MODIFICATION_TIME: u16 = 0x3008;
    pub const CONTAINER_CLASS: u16 = 0x3613;
    pub const ATTACH_DATA: u16 = 0x3701;
    pub const ATTACH_FILENAME: u16 = 0x3704;
    pub const ATTACH_METHOD: u16 = 0x3705;
    pub const ATTACH_LONG_FILENAME: u16 = 0x3707;
    pub const ATTACH_MIME_TAG: u16 = 0x370E;
    pub const ATTACH_CONTENT_ID: u16 = 0x3712;
    pub const ATTACH_FLAGS: u16 = 0x3714;
    pub const SMTP_ADDRESS: u16 = 0x39FE;
    pub const BUSINESS_TELEPHONE_NUMBER: u16 = 0x3A08;
    pub const HOME_TELEPHONE_NUMBER: u16 = 0x3A09;
    pub const COMPANY_NAME: u16 = 0x3A16;
    pub const TITLE: u16 = 0x3A17;
    pub const DEPARTMENT_NAME: u16 = 0x3A18;
    pub const MOBILE_TELEPHONE_NUMBER: u16 = 0x3A1C;
    pub const BUSINESS_FAX_NUMBER: u16 = 0x3A24;
    pub const WEDDING_ANNIVERSARY: u16 = 0x3A41;
    pub const BIRTHDAY: u16 = 0x3A42;
    pub const PERSONAL_HOME_PAGE: u16 = 0x3A50;
    pub const BUSINESS_HOME_PAGE: u16 = 0x3A51;
    pub const INTERNET_CODEPAGE: u16 = 0x3FDE;
    pub const MESSAGE_CODEPAGE: u16 = 0x3FFD;
    pub const SENDER_SMTP_ADDRESS: u16 = 0x5D01;
    pub const SENT_REPRESENTING_SMTP_ADDRESS: u16 = 0x5D02;
    pub const ATTACHMENT_HIDDEN: u16 = 0x7FFE;
}

pub(crate) const MSGFLAG_READ: i64 = 0x01;
pub(crate) const MSGFLAG_HASATTACH: i64 = 0x10;
pub(crate) const ATTACH_EMBEDDED_MSG: i64 = 5;
const ATT_MHTML_REF: i64 = 0x4;

/// A property value, decoded.
#[derive(Clone, Debug, PartialEq)]
pub(crate) enum Value {
    Int(i64),
    Bool(bool),
    Float(f64),
    /// Epoch milliseconds.
    Time(i64),
    Str(String),
    Bin(Vec<u8>),
    StrList(Vec<String>),
    /// A sub-object (attachment data of embedded messages) by node id.
    Object(u32),
    Other,
}

/// Properties of an item, an attachment or a recipient.
#[derive(Clone, Debug, Default)]
pub(crate) struct PropBag {
    pub props: HashMap<u16, Value>,
}

impl PropBag {
    pub fn get(&self, id: u16) -> Option<&Value> {
        self.props.get(&id)
    }

    pub fn str(&self, id: u16) -> Option<&str> {
        match self.props.get(&id) {
            Some(Value::Str(s)) => Some(s.as_str()),
            _ => None,
        }
    }

    /// The string value or "" (absent or of another type).
    pub fn string(&self, id: u16) -> String {
        self.str(id).unwrap_or_default().to_string()
    }

    pub fn int(&self, id: u16) -> Option<i64> {
        match self.props.get(&id) {
            Some(Value::Int(v)) => Some(*v),
            Some(Value::Bool(b)) => Some(i64::from(*b)),
            _ => None,
        }
    }

    pub fn bool(&self, id: u16) -> Option<bool> {
        match self.props.get(&id) {
            Some(Value::Bool(b)) => Some(*b),
            Some(Value::Int(v)) => Some(*v != 0),
            _ => None,
        }
    }

    pub fn time(&self, id: u16) -> Option<i64> {
        match self.props.get(&id) {
            Some(Value::Time(t)) => Some(*t),
            _ => None,
        }
    }

    pub fn bin(&self, id: u16) -> Option<&[u8]> {
        match self.props.get(&id) {
            Some(Value::Bin(b)) => Some(b.as_slice()),
            _ => None,
        }
    }

    pub fn str_list(&self, id: u16) -> Vec<String> {
        match self.props.get(&id) {
            Some(Value::StrList(list)) => list.clone(),
            Some(Value::Str(s)) => vec![s.clone()],
            _ => Vec::new(),
        }
    }

    /// Code page of the item's 8-bit strings and binary HTML.
    pub fn codepage(&self) -> Option<u32> {
        self.int(tag::INTERNET_CODEPAGE).or_else(|| self.int(tag::MESSAGE_CODEPAGE)).filter(|cp| *cp > 0).map(|cp| cp as u32)
    }
}

// -----------------------------------------------------------------------------
// Named properties

pub(crate) type Guid = [u8; 16];

/// A GUID in its binary (little-endian) MAPI layout.
pub(crate) const fn guid(d1: u32, d2: u16, d3: u16, d4: [u8; 8]) -> Guid {
    let a = d1.to_le_bytes();
    let b = d2.to_le_bytes();
    let c = d3.to_le_bytes();
    [a[0], a[1], a[2], a[3], b[0], b[1], c[0], c[1], d4[0], d4[1], d4[2], d4[3], d4[4], d4[5], d4[6], d4[7]]
}

const OLE_SUFFIX: [u8; 8] = [0xC0, 0, 0, 0, 0, 0, 0, 0x46];
pub(crate) const PS_MAPI: Guid = guid(0x0002_0328, 0, 0, OLE_SUFFIX);
pub(crate) const PS_PUBLIC_STRINGS: Guid = guid(0x0002_0329, 0, 0, OLE_SUFFIX);
pub(crate) const PSETID_APPOINTMENT: Guid = guid(0x0006_2002, 0, 0, OLE_SUFFIX);
pub(crate) const PSETID_TASK: Guid = guid(0x0006_2003, 0, 0, OLE_SUFFIX);
pub(crate) const PSETID_ADDRESS: Guid = guid(0x0006_2004, 0, 0, OLE_SUFFIX);
pub(crate) const PSETID_COMMON: Guid = guid(0x0006_2008, 0, 0, OLE_SUFFIX);

/// Maps named properties (GUID + id or name) to the property ids of a store or
/// .msg file. Built from the GUID, entry and string streams of the
/// name-to-id map ([MS-OXMSG] 2.2.3, [MS-PST] 2.4.7).
#[derive(Clone, Debug, Default)]
pub(crate) struct NamedMap {
    by_lid: HashMap<(Guid, u32), u16>,
    by_name: HashMap<(Guid, String), u16>,
}

impl NamedMap {
    pub fn parse(guids: &[u8], entries: &[u8], strings: &[u8]) -> Self {
        let mut map = NamedMap::default();
        for entry in entries.chunks_exact(8) {
            let id = u32::from_le_bytes([entry[0], entry[1], entry[2], entry[3]]);
            let kind = u16::from_le_bytes([entry[4], entry[5]]);
            let index = u16::from_le_bytes([entry[6], entry[7]]);
            let prop_id = 0x8000u16.wrapping_add(index);
            let guid = match kind >> 1 {
                1 => PS_MAPI,
                2 => PS_PUBLIC_STRINGS,
                n if n >= 3 => {
                    let start = usize::from(n - 3) * 16;
                    match guids.get(start..start + 16) {
                        Some(bytes) => bytes.try_into().unwrap_or([0; 16]),
                        None => continue,
                    }
                }
                _ => continue,
            };
            if kind & 1 == 0 {
                map.by_lid.insert((guid, id), prop_id);
            } else {
                let offset = id as usize;
                let Some(len) = strings.get(offset..offset + 4).map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]) as usize) else {
                    continue;
                };
                let Some(raw) = strings.get(offset + 4..offset + 4 + len) else { continue };
                let units: Vec<u16> = raw.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
                map.by_name.insert((guid, String::from_utf16_lossy(&units).to_lowercase()), prop_id);
            }
        }
        map
    }

    pub fn lid(&self, guid: &Guid, lid: u32) -> Option<u16> {
        self.by_lid.get(&(*guid, lid)).copied()
    }

    pub fn name(&self, guid: &Guid, name: &str) -> Option<u16> {
        self.by_name.get(&(*guid, name.to_lowercase())).copied()
    }
}

/// An Outlook item: its properties and the name-to-id map of its store.
pub(crate) struct MapiItem<'a> {
    pub props: &'a PropBag,
    pub named: &'a NamedMap,
}

impl MapiItem<'_> {
    fn named(&self, guid: &Guid, lid: u32) -> Option<&Value> {
        self.named.lid(guid, lid).and_then(|id| self.props.get(id))
    }

    fn named_str(&self, guid: &Guid, lid: u32) -> String {
        match self.named(guid, lid) {
            Some(Value::Str(s)) => s.trim().to_string(),
            _ => String::new(),
        }
    }

    fn named_time(&self, guid: &Guid, lid: u32) -> Option<i64> {
        match self.named(guid, lid) {
            Some(Value::Time(t)) => Some(*t),
            _ => None,
        }
    }

    fn named_bool(&self, guid: &Guid, lid: u32) -> bool {
        matches!(self.named(guid, lid), Some(Value::Bool(true)) | Some(Value::Int(1..)))
    }

    pub fn message_class(&self) -> String {
        let class = self.props.string(tag::MESSAGE_CLASS);
        if class.is_empty() { "IPM.Note".to_string() } else { class }
    }

    pub fn subject(&self) -> String {
        clean_subject(&self.props.string(tag::SUBJECT))
    }

    pub fn headers(&self) -> String {
        self.props.string(tag::TRANSPORT_MESSAGE_HEADERS)
    }

    /// The displayed sender, preferring SMTP addresses over Exchange DNs.
    pub fn sender(&self) -> Mailbox {
        let p = self.props;
        let name =
            [tag::SENT_REPRESENTING_NAME, tag::SENDER_NAME].iter().map(|t| p.string(*t)).find(|s| !s.trim().is_empty()).unwrap_or_default();
        let mut email = [
            tag::SENT_REPRESENTING_EMAIL_ADDRESS,
            tag::SENT_REPRESENTING_SMTP_ADDRESS,
            tag::SENDER_EMAIL_ADDRESS,
            tag::SENDER_SMTP_ADDRESS,
        ]
        .iter()
        .map(|t| p.string(*t))
        .find(|s| s.contains('@'))
        .unwrap_or_default();
        if email.is_empty() {
            email = from_header(&self.headers());
        }
        let email = email.trim().to_string();
        Mailbox { name: squash(if name.trim().is_empty() { &email } else { &name }), email }
    }

    /// The actual sender if the message was sent on behalf of someone else.
    pub fn actual_sender(&self) -> Option<Mailbox> {
        let p = self.props;
        let name = p.string(tag::SENDER_NAME);
        let email = [tag::SENDER_EMAIL_ADDRESS, tag::SENDER_SMTP_ADDRESS]
            .iter()
            .map(|t| p.string(*t))
            .find(|s| s.contains('@'))
            .unwrap_or_default();
        if name.is_empty() && email.is_empty() {
            return None;
        }
        let representing = self.sender();
        let same_email = !email.is_empty() && !representing.email.is_empty() && email.eq_ignore_ascii_case(&representing.email);
        let same_name = !name.is_empty() && !representing.name.is_empty() && name.to_lowercase() == representing.name.to_lowercase();
        if same_email || (email.is_empty() && same_name) {
            return None;
        }
        Some(Mailbox { name: squash(if name.is_empty() { &email } else { &name }), email })
    }

    pub fn importance(&self) -> i64 {
        self.props.int(tag::IMPORTANCE).unwrap_or(1)
    }

    pub fn is_read(&self) -> bool {
        self.props.int(tag::MESSAGE_FLAGS).is_none_or(|f| f & MSGFLAG_READ != 0)
    }

    pub fn flagged(&self) -> bool {
        self.props.int(tag::FLAG_STATUS) == Some(2)
    }

    pub fn size(&self) -> i64 {
        self.props.int(tag::MESSAGE_SIZE).unwrap_or(0)
    }

    pub fn sent_date(&self) -> Option<i64> {
        self.props.time(tag::CLIENT_SUBMIT_TIME)
    }

    pub fn received_date(&self) -> Option<i64> {
        self.props.time(tag::MESSAGE_DELIVERY_TIME)
    }

    pub fn categories(&self) -> Vec<String> {
        self.named
            .name(&PS_PUBLIC_STRINGS, "Keywords")
            .map(|id| self.props.str_list(id))
            .unwrap_or_default()
            .into_iter()
            .map(|c| c.trim().to_string())
            .filter(|c| !c.is_empty())
            .collect()
    }

    /// The date shown for the item: appointment start, sent date in sent
    /// folders, otherwise the received date.
    pub fn item_date(&self, kind: crate::model::ItemKind, special: Option<SpecialFolder>) -> i64 {
        let p = self.props;
        if kind == crate::model::ItemKind::Appointment {
            if let Some(start) = self.named_time(&PSETID_APPOINTMENT, 0x820D) {
                return start;
            }
        }
        let order: &[u16] = if matches!(special, Some(SpecialFolder::Sent | SpecialFolder::Drafts | SpecialFolder::Outbox)) {
            &[tag::CLIENT_SUBMIT_TIME, tag::LAST_MODIFICATION_TIME, tag::CREATION_TIME]
        } else {
            &[tag::MESSAGE_DELIVERY_TIME, tag::CLIENT_SUBMIT_TIME, tag::LAST_MODIFICATION_TIME, tag::CREATION_TIME]
        };
        order.iter().find_map(|t| p.time(*t)).unwrap_or(0)
    }

    pub fn appointment(&self) -> AppointmentInfo {
        let g = &PSETID_APPOINTMENT;
        AppointmentInfo {
            start: self.named_time(g, 0x820D),
            end: self.named_time(g, 0x820E),
            location: self.named_str(g, 0x8208),
            is_recurring: self.named_bool(g, 0x8223),
            recurrence: self.named_str(g, 0x8232),
            attendees: squash(&self.named_str(g, 0x8238)),
            is_all_day: self.named_bool(g, 0x8215),
        }
    }

    pub fn contact(&self) -> Vec<ContactField> {
        let p = self.props;
        let a = &PSETID_ADDRESS;
        let fields: [(&str, String); 16] = [
            ("company", p.string(tag::COMPANY_NAME)),
            ("jobTitle", p.string(tag::TITLE)),
            ("department", p.string(tag::DEPARTMENT_NAME)),
            ("email", self.named_str(a, 0x8083)),
            ("email2", self.named_str(a, 0x8093)),
            ("email3", self.named_str(a, 0x80A3)),
            ("businessPhone", p.string(tag::BUSINESS_TELEPHONE_NUMBER)),
            ("mobilePhone", p.string(tag::MOBILE_TELEPHONE_NUMBER)),
            ("homePhone", p.string(tag::HOME_TELEPHONE_NUMBER)),
            ("businessFax", p.string(tag::BUSINESS_FAX_NUMBER)),
            ("businessAddress", self.named_str(a, 0x801B)),
            ("homeAddress", self.named_str(a, 0x801A)),
            ("otherAddress", self.named_str(a, 0x801C)),
            ("website", p.string(tag::BUSINESS_HOME_PAGE)),
            ("personalWebsite", p.string(tag::PERSONAL_HOME_PAGE)),
            ("im", self.named_str(a, 0x8062)),
        ];
        let mut result: Vec<ContactField> = fields
            .into_iter()
            .filter(|(_, value)| !value.trim().is_empty())
            .map(|(key, value)| ContactField { key: key.to_string(), value: value.trim().to_string() })
            .collect();
        for (key, id) in [("birthday", tag::BIRTHDAY), ("anniversary", tag::WEDDING_ANNIVERSARY)] {
            if let Some(time) = p.time(id) {
                result.push(ContactField { key: key.to_string(), value: iso_string(time) });
            }
        }
        result
    }

    pub fn task(&self) -> TaskInfo {
        let t = &PSETID_TASK;
        let status = match self.named(t, 0x8101) {
            Some(Value::Int(v)) => *v as i32,
            _ => 0,
        };
        let percent = match self.named(t, 0x8102) {
            Some(Value::Float(v)) => *v,
            Some(Value::Int(v)) => *v as f64,
            _ => 0.0,
        };
        TaskInfo {
            status,
            percent_complete: percent,
            start_date: self.named_time(t, 0x8104).or_else(|| self.named_time(&PSETID_COMMON, 0x8516)),
            due_date: self.named_time(t, 0x8105).or_else(|| self.named_time(&PSETID_COMMON, 0x8517)),
            owner: self.named_str(t, 0x811F),
        }
    }

    /// HTML and text body. Outlook stores HTML, plain text or (compressed) RTF.
    pub fn body(&self) -> Body {
        let p = self.props;
        let mut html = match p.get(tag::HTML) {
            Some(Value::Str(s)) => Some(s.clone()),
            Some(Value::Bin(bytes)) => Some(codepage::decode(bytes, p.codepage().or(Some(65001)))),
            _ => None,
        }
        .filter(|h| !h.trim().is_empty());
        let mut text = p.string(tag::BODY);
        if html.is_none() && text.trim().is_empty() {
            if let Some(rtf) = p.bin(tag::RTF_COMPRESSED).and_then(decompress_rtf).and_then(|rtf| convert_rtf(&rtf)) {
                html = rtf.html;
                text = rtf.text;
            }
        }
        if text.trim().is_empty() {
            if let Some(html) = &html {
                return Body { text: html_to_text(html), html: Some(html.clone()), text_derived: true };
            }
        }
        Body { html, text: tidy_text(&text), text_derived: false }
    }
}

pub(crate) struct Body {
    pub html: Option<String>,
    pub text: String,
    /// True if the plain text was not stored but derived from the HTML.
    pub text_derived: bool,
}

/// Strips the "normalized subject" prefix marker that PST files may store.
pub(crate) fn clean_subject(subject: &str) -> String {
    let mut chars = subject.chars();
    if chars.next() == Some('\u{1}') {
        chars.next();
        return chars.as_str().to_string();
    }
    subject.to_string()
}

static FROM_HEADER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#"(?im)^from:[^\r\n]*?<?([^\s<>"]+@[^\s<>"]+)>?"#).unwrap());

fn from_header(headers: &str) -> String {
    FROM_HEADER.captures(headers).map(|c| c[1].to_string()).unwrap_or_default()
}

/// A recipient from the properties of a recipient row.
pub(crate) fn recipient_from(bag: &PropBag) -> Option<Recipient> {
    let email = [tag::SMTP_ADDRESS, tag::EMAIL_ADDRESS].iter().map(|t| bag.string(*t)).find(|e| e.contains('@')).unwrap_or_default();
    let name = squash(&bag.string(tag::DISPLAY_NAME));
    let name = if name.is_empty() { email.clone() } else { name };
    if name.is_empty() && email.is_empty() {
        return None;
    }
    let kind = match bag.int(tag::RECIPIENT_TYPE).unwrap_or(1) & 0x0F {
        2 => RecipientKind::Cc,
        3 => RecipientKind::Bcc,
        _ => RecipientKind::To,
    };
    Some(Recipient { name, email: email.trim().to_string(), kind })
}

/// Metadata of an attachment from its properties.
pub(crate) struct AttachmentMeta {
    pub name: String,
    pub mime_type: String,
    pub content_id: String,
    pub hidden: bool,
    pub method: i64,
    pub declared_size: i64,
}

impl AttachmentMeta {
    pub fn from_props(p: &PropBag) -> Self {
        let name = [tag::ATTACH_LONG_FILENAME, tag::ATTACH_FILENAME, tag::DISPLAY_NAME]
            .iter()
            .map(|t| p.string(*t))
            .find(|s| !s.trim().is_empty())
            .unwrap_or_default();
        let flags = p.int(tag::ATTACH_FLAGS).unwrap_or(0);
        Self {
            name,
            mime_type: p.string(tag::ATTACH_MIME_TAG).trim().to_lowercase(),
            content_id: crate::html::normalize_content_id(&p.string(tag::ATTACH_CONTENT_ID)),
            hidden: p.bool(tag::ATTACHMENT_HIDDEN).unwrap_or(false) || flags & ATT_MHTML_REF != 0,
            method: p.int(tag::ATTACH_METHOD).unwrap_or(1),
            declared_size: p.int(tag::ATTACH_SIZE).unwrap_or(0),
        }
    }

    pub fn is_embedded_message(&self) -> bool {
        self.method == ATTACH_EMBEDDED_MSG
    }

    /// A MIME message attached as file (.eml).
    pub fn is_mime_message(&self) -> bool {
        !self.is_embedded_message() && (self.mime_type == "message/rfc822" || self.name.to_lowercase().ends_with(".eml"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_named_property_map() {
        // GUID stream: one custom GUID (index 3).
        let guids = PSETID_APPOINTMENT.to_vec();
        let mut entries = Vec::new();
        // LID 0x820D of GUID index 3 -> property 0x8000.
        entries.extend_from_slice(&0x820Du32.to_le_bytes());
        entries.extend_from_slice(&(3u16 << 1).to_le_bytes());
        entries.extend_from_slice(&0u16.to_le_bytes());
        // "Keywords" of PS_PUBLIC_STRINGS -> property 0x8001.
        entries.extend_from_slice(&0u32.to_le_bytes());
        entries.extend_from_slice(&(2u16 << 1 | 1).to_le_bytes());
        entries.extend_from_slice(&1u16.to_le_bytes());
        let name: Vec<u8> = "Keywords".encode_utf16().flat_map(u16::to_le_bytes).collect();
        let mut strings = (name.len() as u32).to_le_bytes().to_vec();
        strings.extend_from_slice(&name);

        let map = NamedMap::parse(&guids, &entries, &strings);
        assert_eq!(map.lid(&PSETID_APPOINTMENT, 0x820D), Some(0x8000));
        assert_eq!(map.name(&PS_PUBLIC_STRINGS, "keywords"), Some(0x8001));
    }

    #[test]
    fn resolves_senders() {
        let mut bag = PropBag::default();
        bag.props.insert(tag::SENT_REPRESENTING_NAME, Value::Str("Anna Müller".into()));
        bag.props.insert(tag::SENT_REPRESENTING_EMAIL_ADDRESS, Value::Str("/O=EXCHANGE/CN=ANNA".into()));
        bag.props.insert(tag::SENDER_NAME, Value::Str("Assistenz".into()));
        bag.props.insert(tag::SENDER_SMTP_ADDRESS, Value::Str("assist@example.com".into()));
        bag.props.insert(tag::TRANSPORT_MESSAGE_HEADERS, Value::Str("Subject: x\r\nFrom: Anna <anna@example.com>\r\n".into()));
        let named = NamedMap::default();
        let item = MapiItem { props: &bag, named: &named };
        assert_eq!(item.sender(), Mailbox { name: "Anna Müller".into(), email: "assist@example.com".into() });
        assert_eq!(item.actual_sender(), None);
        assert_eq!(clean_subject("\u{1}\u{4}AW: Test"), "AW: Test");
    }
}
