//! Minimal iCalendar (RFC 5545) and vCard (RFC 6350) parsing for attachment
//! previews (port of `renderer/src/lib/calendarCard.ts`). Only what is needed
//! to show an event or contact card.

use std::collections::HashMap;

use base64::Engine;
use chrono::{Local, NaiveDate, TimeZone, Utc};

#[derive(Clone, Debug)]
struct Property {
    name: String,
    params: HashMap<String, String>,
    value: String,
}

fn unfold(text: &str) -> Vec<String> {
    text.replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace("\n ", "")
        .replace("\n\t", "")
        .split('\n')
        .filter(|l| !l.trim().is_empty())
        .map(str::to_string)
        .collect()
}

fn parse_line(line: &str) -> Option<Property> {
    // NAME;PARAM=VALUE;PARAM="VALUE":value - colons inside quoted params are allowed.
    let mut quoted = false;
    let colon = line.char_indices().find(|(_, c)| {
        if *c == '"' {
            quoted = !quoted;
        }
        *c == ':' && !quoted
    })?;
    let (head, value) = (&line[..colon.0], &line[colon.0 + 1..]);
    let mut parts = head.split(';');
    let raw_name = parts.next()?;
    let mut params = HashMap::new();
    for p in parts {
        match p.split_once('=') {
            Some((key, value)) => {
                params.insert(key.to_uppercase(), value.trim_matches('"').to_string());
            }
            None => {
                let joined = match params.get("TYPE") {
                    Some(existing) => format!("{existing},{p}"),
                    None => p.to_string(),
                };
                params.insert("TYPE".to_string(), joined);
            }
        }
    }
    // Group prefixes ("item1.EMAIL") are not relevant for display.
    let name = raw_name.rsplit_once('.').map_or(raw_name, |(_, n)| n).to_uppercase();
    Some(Property { name, params, value: value.to_string() })
}

fn unescape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n' | 'N') => out.push('\n'),
                Some(other) => out.push(other),
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Splits a file into components (VEVENT, VCARD, …) with their properties.
fn components(text: &str, kind: &str) -> Vec<Vec<Property>> {
    let mut result = Vec::new();
    let mut current: Option<Vec<Property>> = None;
    let mut depth = 0;
    for line in unfold(text) {
        let Some(prop) = parse_line(&line) else { continue };
        let value = prop.value.to_uppercase();
        if prop.name == "BEGIN" && value == kind {
            current = Some(Vec::new());
            depth = 0;
            continue;
        }
        let Some(props) = current.as_mut() else { continue };
        if prop.name == "BEGIN" {
            depth += 1;
        } else if prop.name == "END" && value == kind && depth == 0 {
            result.push(current.take().unwrap_or_default());
        } else if prop.name == "END" {
            depth -= 1;
        } else if depth == 0 {
            props.push(prop);
        }
    }
    result
}

fn get<'a>(props: &'a [Property], name: &str) -> Option<&'a Property> {
    props.iter().find(|p| p.name == name)
}

fn all<'a>(props: &'a [Property], name: &'a str) -> impl Iterator<Item = &'a Property> + 'a {
    props.iter().filter(move |p| p.name == name)
}

fn decode(data: &[u8]) -> String {
    String::from_utf8_lossy(data).into_owned()
}

// -----------------------------------------------------------------------------
// iCalendar

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct CalendarTime {
    pub time: i64,
    pub all_day: bool,
    /// Time zone name if the time is given in a named zone.
    pub zone: Option<String>,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct CalendarPerson {
    pub name: String,
    pub email: String,
    pub status: Option<String>,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct CalendarEvent {
    pub summary: String,
    pub location: String,
    pub description: String,
    pub start: Option<CalendarTime>,
    pub end: Option<CalendarTime>,
    pub organizer: Option<CalendarPerson>,
    pub attendees: Vec<CalendarPerson>,
    pub recurring: bool,
    pub url: String,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct CalendarInfo {
    /// REQUEST, CANCEL, REPLY, … (upper case) or "".
    pub method: String,
    pub events: Vec<CalendarEvent>,
}

fn parse_time(prop: Option<&Property>) -> Option<CalendarTime> {
    let prop = prop?;
    let v = prop.value.trim();
    let digits = |s: &str| s.parse::<u32>().ok();
    if v.len() < 8 || !v[..8].bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let (y, m, d) = (v[..4].parse::<i32>().ok()?, digits(&v[4..6])?, digits(&v[6..8])?);
    let date = NaiveDate::from_ymd_opt(y, m, d)?;
    if v.len() == 8 {
        let midnight = Local.from_local_datetime(&date.and_hms_opt(0, 0, 0)?).earliest()?;
        return Some(CalendarTime { time: midnight.timestamp_millis(), all_day: true, zone: None });
    }
    let rest = v[8..].strip_prefix('T')?;
    let utc = rest.ends_with('Z');
    let rest = rest.trim_end_matches('Z');
    if rest.len() < 4 || !rest.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let (h, mi) = (digits(&rest[..2])?, digits(&rest[2..4])?);
    let s = if rest.len() >= 6 { digits(&rest[4..6])? } else { 0 };
    let naive = date.and_hms_opt(h, mi, s)?;
    if utc {
        return Some(CalendarTime { time: Utc.from_utc_datetime(&naive).timestamp_millis(), all_day: false, zone: None });
    }
    // Times in a named zone are shown as local times of that zone.
    let local = Local.from_local_datetime(&naive).earliest()?;
    Some(CalendarTime { time: local.timestamp_millis(), all_day: false, zone: prop.params.get("TZID").cloned() })
}

fn person(prop: &Property) -> CalendarPerson {
    let email = prop.value.trim();
    let email = if email.len() >= 7 && email[..7].eq_ignore_ascii_case("mailto:") { &email[7..] } else { email };
    CalendarPerson {
        name: prop.params.get("CN").cloned().unwrap_or_default(),
        email: email.to_string(),
        status: prop.params.get("PARTSTAT").cloned(),
    }
}

pub fn parse_calendar(data: Vec<u8>) -> CalendarInfo {
    let text = decode(&data);
    let calendar = components(&text, "VCALENDAR").into_iter().next().unwrap_or_default();
    let events = components(&text, "VEVENT")
        .iter()
        .map(|props| CalendarEvent {
            summary: unescape(&get(props, "SUMMARY").map(|p| p.value.clone()).unwrap_or_default()),
            location: unescape(&get(props, "LOCATION").map(|p| p.value.clone()).unwrap_or_default()),
            description: unescape(&get(props, "DESCRIPTION").map(|p| p.value.clone()).unwrap_or_default()),
            start: parse_time(get(props, "DTSTART")),
            end: parse_time(get(props, "DTEND")),
            organizer: get(props, "ORGANIZER").map(person),
            attendees: all(props, "ATTENDEE").map(person).collect(),
            recurring: get(props, "RRULE").is_some(),
            url: get(props, "URL").map(|p| p.value.clone()).unwrap_or_default(),
        })
        .collect();
    CalendarInfo { method: get(&calendar, "METHOD").map(|p| p.value.to_uppercase()).unwrap_or_default(), events }
}

// -----------------------------------------------------------------------------
// vCard

#[derive(uniffi::Enum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContactFieldKind {
    Email,
    Phone,
    Address,
    Url,
    Birthday,
    Note,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct ContactCardField {
    pub kind: ContactFieldKind,
    /// "work", "home, cell", … (lower case) or "".
    pub label: String,
    pub value: String,
}

#[derive(uniffi::Record, Clone, Debug, PartialEq)]
pub struct ContactCard {
    pub name: String,
    pub organization: String,
    pub title: String,
    /// Embedded photo as data URL; remote photos are never loaded.
    pub photo: Option<String>,
    pub fields: Vec<ContactCardField>,
}

fn type_label(prop: &Property) -> String {
    prop.params
        .get("TYPE")
        .map(|t| {
            t.split(',')
                .map(|s| s.trim().to_lowercase())
                .filter(|s| !s.is_empty() && !["internet", "pref", "voice", "x400"].contains(&s.as_str()))
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default()
}

pub fn parse_contacts(data: Vec<u8>) -> Vec<ContactCard> {
    let text = decode(&data);
    components(&text, "VCARD")
        .iter()
        .map(|props| {
            let n: Vec<String> = get(props, "N").map(|p| p.value.split(';').map(unescape).collect()).unwrap_or_default();
            let part = |i: usize| n.get(i).cloned().unwrap_or_default();
            let full = unescape(&get(props, "FN").map(|p| p.value.clone()).unwrap_or_default());
            let name = if full.trim().is_empty() {
                [part(3), part(1), part(2), part(0), part(4)].into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" ")
            } else {
                full
            };
            let mut fields = Vec::new();
            for p in all(props, "EMAIL") {
                fields.push(ContactCardField { kind: ContactFieldKind::Email, label: type_label(p), value: p.value.clone() });
            }
            for p in all(props, "TEL") {
                let value = p.value.trim();
                let value = if value.len() >= 4 && value[..4].eq_ignore_ascii_case("tel:") { &value[4..] } else { value };
                fields.push(ContactCardField { kind: ContactFieldKind::Phone, label: type_label(p), value: value.to_string() });
            }
            for p in all(props, "ADR") {
                let parts: Vec<String> = p.value.split(';').map(unescape).collect();
                let get_part = |i: usize| parts.get(i).cloned().unwrap_or_default();
                let city_line = [get_part(5), get_part(3)].into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" ");
                let value =
                    [get_part(2), city_line, get_part(4), get_part(6)].into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join("\n");
                fields.push(ContactCardField { kind: ContactFieldKind::Address, label: type_label(p), value });
            }
            for p in all(props, "URL") {
                fields.push(ContactCardField { kind: ContactFieldKind::Url, label: type_label(p), value: p.value.clone() });
            }
            for p in all(props, "BDAY") {
                fields.push(ContactCardField { kind: ContactFieldKind::Birthday, label: String::new(), value: p.value.clone() });
            }
            for p in all(props, "NOTE") {
                fields.push(ContactCardField { kind: ContactFieldKind::Note, label: String::new(), value: unescape(&p.value) });
            }
            fields.retain(|f| !f.value.trim().is_empty());

            let photo = get(props, "PHOTO").and_then(|p| {
                let encoding = p.params.get("ENCODING").map(|e| e.to_lowercase()).unwrap_or_default();
                let kind = p
                    .params
                    .get("TYPE")
                    .map(|t| t.to_lowercase().trim_start_matches("image/").to_string())
                    .unwrap_or_else(|| "jpeg".into());
                if p.value.starts_with("data:image/") {
                    Some(p.value.clone())
                } else if encoding == "b" || encoding == "base64" {
                    let data: String = p.value.chars().filter(|c| !c.is_whitespace()).collect();
                    base64::engine::general_purpose::STANDARD.decode(&data).ok().map(|_| format!("data:image/{kind};base64,{data}"))
                } else {
                    None
                }
            });
            ContactCard {
                name,
                organization: unescape(
                    &get(props, "ORG")
                        .map(|p| p.value.split(';').filter(|s| !s.is_empty()).collect::<Vec<_>>().join(", "))
                        .unwrap_or_default(),
                ),
                title: unescape(&get(props, "TITLE").map(|p| p.value.clone()).unwrap_or_default()),
                photo,
                fields,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_events() {
        let ics = "BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nSUMMARY:Jour fixe\\, Q3\r\nLOCATION:Raum 1\r\nDTSTART:20250301T100000Z\r\nDTEND;TZID=Europe/Berlin:20250301T120000\r\nORGANIZER;CN=\"Anna: M\":mailto:anna@example.com\r\nATTENDEE;CN=Bob;PARTSTAT=ACCEPTED:mailto:bob@example.com\r\nRRULE:FREQ=WEEKLY\r\nDESCRIPTION:Zeile 1\\nZei\r\n le 2\r\nBEGIN:VALARM\r\nSUMMARY:x\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        let cal = parse_calendar(ics.as_bytes().to_vec());
        assert_eq!(cal.method, "REQUEST");
        let e = &cal.events[0];
        assert_eq!(e.summary, "Jour fixe, Q3");
        assert_eq!(e.description, "Zeile 1\nZeile 2");
        assert_eq!(e.start, Some(CalendarTime { time: 1_740_823_200_000, all_day: false, zone: None }));
        assert_eq!(e.end.as_ref().unwrap().zone.as_deref(), Some("Europe/Berlin"));
        assert_eq!(e.organizer.as_ref().unwrap().name, "Anna: M");
        assert_eq!(e.attendees[0].status.as_deref(), Some("ACCEPTED"));
        assert!(e.recurring);
    }

    #[test]
    fn parses_contacts() {
        let vcf = "BEGIN:VCARD\nVERSION:3.0\nN:Müller;Anna;;Dr.;\nORG:Example GmbH;Vertrieb\nitem1.EMAIL;TYPE=INTERNET,WORK:anna@example.com\nTEL;TYPE=CELL:+49 170 1234567\nADR;TYPE=WORK:;;Hauptstr. 1;Bonn;;53111;Deutschland\nEND:VCARD\n";
        let cards = parse_contacts(vcf.as_bytes().to_vec());
        assert_eq!(cards[0].name, "Dr. Anna Müller");
        assert_eq!(cards[0].organization, "Example GmbH, Vertrieb");
        assert_eq!(
            cards[0].fields[0],
            ContactCardField { kind: ContactFieldKind::Email, label: "work".into(), value: "anna@example.com".into() }
        );
        assert_eq!(cards[0].fields[2].value, "Hauptstr. 1\n53111 Bonn\nDeutschland");
    }
}
