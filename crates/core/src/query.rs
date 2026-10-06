//! Search query language (port of `shared/query.ts`).
//!
//! Free text is split into terms that must all match (AND). Supported syntax:
//!
//! ```text
//! rechnung 2024          all terms must match
//! "exact phrase"         phrase match
//! -newsletter            exclude a term
//! angebot OR offer       either term (also: ODER)
//! from:anna  von:anna    sender name or address
//! to:bob  an:bob  cc:x   recipients
//! subject:x  betreff:x   subject only
//! body:x  inhalt:x       message body only
//! attachment:pdf  anhang:vertrag   attachment file names
//! folder:archiv  ordner:archiv     folder name
//! has:attachment  hat:anhang
//! is:unread / ist:ungelesen, is:read, is:important, is:flagged, is:signed
//! after:2024-01-01  nach:1.1.2024  before:2024  vor:2024-06  bis:2024-06
//! date:2024-05  datum:12.05.2024   year:2023  jahr:2023
//! larger:5mb  größer:500kb  smaller:1mb  kleiner:1mb
//! type:termin  typ:mail  (mail, meeting, appointment, contact, task, note)
//! ```
//!
//! Field names are accepted in English and German.

use std::sync::LazyLock;

use regex::Regex;

use crate::model::{ItemKind, SearchField, SecurityKind};
use crate::text::{fold, fold_for_index};
use crate::time::{exact_local_date, local_date, local_parts};

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct QueryClause {
    /// Field to match, or None for all enabled fields.
    pub field: Option<SearchField>,
    /// Folded alternatives; at least one has to match.
    pub terms: Vec<String>,
    pub negate: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum QueryReadState {
    Read,
    Unread,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct ParsedQuery {
    pub clauses: Vec<QueryClause>,
    pub folder_names: Vec<String>,
    pub has_attachments: Option<bool>,
    pub read_state: Option<QueryReadState>,
    pub important: Option<bool>,
    pub flagged: Option<bool>,
    pub security: Option<SecurityKind>,
    /// Inclusive lower bound (epoch ms).
    pub date_from: Option<i64>,
    /// Exclusive upper bound (epoch ms).
    pub date_to: Option<i64>,
    pub min_size: Option<i64>,
    pub max_size: Option<i64>,
    pub kinds: Option<Vec<ItemKind>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FieldKey {
    Text(SearchField),
    Folder,
    Has,
    Is,
    Before,
    Until,
    After,
    Date,
    Larger,
    Smaller,
    Type,
}

fn field_key(name: &str) -> Option<FieldKey> {
    use FieldKey::*;
    use SearchField as F;
    // Aliases are matched folded, so "größer" and "groesser" both work.
    Some(match fold(name).as_str() {
        "from" | "von" | "absender" | "sender" => Text(F::From),
        "to" | "an" | "cc" | "bcc" | "empfanger" | "empfaenger" | "recipient" => Text(F::To),
        "subject" | "betreff" => Text(F::Subject),
        "body" | "text" | "inhalt" | "nachricht" => Text(F::Body),
        "attachment" | "attachments" | "anhang" | "anhange" | "datei" | "file" | "filename" => Text(F::Attachments),
        "folder" | "ordner" | "in" => Folder,
        "has" | "hat" => Has,
        "is" | "ist" => Is,
        "before" | "vor" => Before,
        "bis" | "until" => Until,
        "after" | "nach" | "ab" | "since" | "seit" => After,
        "date" | "datum" | "year" | "jahr" | "on" | "am" => Date,
        "larger" | "grosser" | "groesser" | "size" | "grosse" | "groesse" | "min" => Larger,
        "smaller" | "kleiner" | "max" => Smaller,
        "type" | "typ" | "art" | "kind" => Type,
        _ => return None,
    })
}

fn kind_alias(value: &str) -> Option<&'static [ItemKind]> {
    use ItemKind::*;
    Some(match value {
        "mail" | "email" | "e-mail" | "nachricht" | "message" => &[Mail, Meeting],
        "meeting" | "besprechung" | "einladung" | "invitation" => &[Meeting],
        "appointment" | "termin" | "calendar" | "kalender" | "event" => &[Appointment],
        "contact" | "kontakt" => &[Contact],
        "task" | "aufgabe" | "todo" => &[Task],
        "note" | "notiz" => &[Note],
        "journal" => &[Journal],
        _ => return None,
    })
}

#[derive(Debug)]
struct RawToken {
    text: String,
    quoted: bool,
    negate: bool,
    field: Option<String>,
}

/// Splits the query into tokens, keeping quoted strings together.
fn tokenize(input: &str) -> Vec<RawToken> {
    let chars: Vec<char> = input.chars().collect();
    let n = chars.len();
    let mut tokens = Vec::new();
    let mut i = 0;
    while i < n {
        while i < n && chars[i].is_whitespace() {
            i += 1;
        }
        if i >= n {
            break;
        }

        let mut negate = false;
        if chars[i] == '-' && i + 1 < n && !chars[i + 1].is_whitespace() {
            negate = true;
            i += 1;
        }

        // field:value or field:"quoted value"
        let mut field = None;
        let mut j = i;
        while j < n && (chars[j].is_alphabetic() || chars[j] == '-') {
            j += 1;
        }
        if j > i && j + 1 < n && chars[j] == ':' && !chars[j + 1].is_whitespace() {
            field = Some(chars[i..j].iter().collect::<String>());
            i = j + 1;
        }

        if matches!(chars[i], '"' | '“' | '„') {
            let straight = chars[i] == '"';
            let mut end = i + 1;
            while end < n && !(if straight { chars[end] == '"' } else { matches!(chars[end], '”' | '“' | '"') }) {
                end += 1;
            }
            tokens.push(RawToken { text: chars[i + 1..end.min(n)].iter().collect(), quoted: true, negate, field });
            i = end + 1;
            continue;
        }

        let mut j = i;
        while j < n && !chars[j].is_whitespace() {
            j += 1;
        }
        tokens.push(RawToken { text: chars[i..j].iter().collect(), quoted: false, negate, field });
        i = j;
    }
    tokens
}

pub(crate) fn parse_query(input: &str, now: i64) -> ParsedQuery {
    let mut result = ParsedQuery::default();
    let mut pending_or = false;

    for token in tokenize(input) {
        if !token.quoted && token.field.is_none() && !token.negate && matches!(token.text.as_str(), "OR" | "ODER" | "|") {
            pending_or = !result.clauses.is_empty();
            continue;
        }

        let key = token.field.as_deref().and_then(field_key);
        if let (Some(field), None) = (&token.field, key) {
            // Unknown prefix such as "Re:" or "10:30" - treat the token as text.
            let raw = if token.quoted { format!("{field}:\"{}\"", token.text) } else { format!("{field}:{}", token.text) };
            push_text_clause(&mut result, None, &raw, token.negate, pending_or);
            pending_or = false;
            continue;
        }

        match key {
            None => {
                push_text_clause(&mut result, None, &token.text, token.negate, pending_or);
                pending_or = false;
            }
            Some(FieldKey::Text(field)) => {
                push_text_clause(&mut result, Some(field), &token.text, token.negate, pending_or);
                pending_or = false;
            }
            Some(key) => {
                pending_or = false;
                if !apply_operator(&mut result, key, &token.text, token.negate, now) {
                    // Not understood (e.g. "is:banana") - fall back to plain text search.
                    let raw = format!("{}:{}", token.field.as_deref().unwrap_or_default(), token.text);
                    push_text_clause(&mut result, None, &raw, token.negate, false);
                }
            }
        }
    }
    result
}

fn push_text_clause(result: &mut ParsedQuery, field: Option<SearchField>, text: &str, negate: bool, or_with_previous: bool) {
    let term = fold_for_index(text);
    if term.is_empty() {
        return;
    }
    if or_with_previous {
        if let Some(last) = result.clauses.last_mut() {
            if !last.negate && !negate && last.field == field {
                last.terms.push(term);
                return;
            }
        }
    }
    result.clauses.push(QueryClause { field, terms: vec![term], negate });
}

static HAS_ATTACHMENT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(attachments?|anh(a|ä)nge?|anhaenge|files?|dateien?)$").unwrap());
static HAS_FLAG: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(flags?|markierung|fahne)$").unwrap());

fn apply_operator(result: &mut ParsedQuery, key: FieldKey, raw_value: &str, negate: bool, now: i64) -> bool {
    let value = fold(raw_value.trim());
    match key {
        FieldKey::Folder => {
            if value.is_empty() {
                return false;
            }
            result.folder_names.push(fold_for_index(raw_value));
            true
        }
        FieldKey::Has => {
            if HAS_ATTACHMENT.is_match(&value) {
                result.has_attachments = Some(!negate);
                true
            } else if HAS_FLAG.is_match(&value) {
                result.flagged = Some(!negate);
                true
            } else {
                false
            }
        }
        FieldKey::Is => match value.as_str() {
            "unread" | "ungelesen" | "neu" | "new" => {
                result.read_state = Some(if negate { QueryReadState::Read } else { QueryReadState::Unread });
                true
            }
            "read" | "gelesen" => {
                result.read_state = Some(if negate { QueryReadState::Unread } else { QueryReadState::Read });
                true
            }
            "important" | "wichtig" | "high" | "hoch" => {
                result.important = Some(!negate);
                true
            }
            "flagged" | "markiert" | "starred" => {
                result.flagged = Some(!negate);
                true
            }
            "signed" | "signiert" => {
                result.security = Some(SecurityKind::Signed);
                true
            }
            "encrypted" | "verschlusselt" | "verschluesselt" => {
                result.security = Some(SecurityKind::Encrypted);
                true
            }
            _ => false,
        },
        FieldKey::Before => parse_date_range(&value, now).is_some_and(|range| {
            result.date_to = Some(result.date_to.map_or(range.0, |to| to.min(range.0)));
            true
        }),
        FieldKey::Until => parse_date_range(&value, now).is_some_and(|range| {
            // Unlike "before", "until" includes the named period.
            result.date_to = Some(result.date_to.map_or(range.1, |to| to.min(range.1)));
            true
        }),
        FieldKey::After => parse_date_range(&value, now).is_some_and(|range| {
            result.date_from = Some(result.date_from.map_or(range.0, |from| from.max(range.0)));
            true
        }),
        FieldKey::Date => parse_date_range(&value, now).is_some_and(|range| {
            result.date_from = Some(result.date_from.map_or(range.0, |from| from.max(range.0)));
            result.date_to = Some(result.date_to.map_or(range.1, |to| to.min(range.1)));
            true
        }),
        FieldKey::Larger => parse_size(&value).is_some_and(|size| {
            result.min_size = Some(size);
            true
        }),
        FieldKey::Smaller => parse_size(&value).is_some_and(|size| {
            result.max_size = Some(size);
            true
        }),
        FieldKey::Type => match kind_alias(&value) {
            Some(kinds) => {
                let list = result.kinds.get_or_insert_with(Vec::new);
                for kind in kinds {
                    if !list.contains(kind) {
                        list.push(*kind);
                    }
                }
                true
            }
            None => false,
        },
        FieldKey::Text(_) => false,
    }
}

static YEAR: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})$").unwrap());
static YEAR_MONTH: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})[-/.](\d{1,2})$").unwrap());
static MONTH_YEAR: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{1,2})[./](\d{4})$").unwrap());
static ISO_DAY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$").unwrap());
static GERMAN_DAY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$").unwrap());

/// Parses a (local time) date expression into a half-open range `(start, end)`.
/// Accepts YYYY, YYYY-MM, YYYY-MM-DD, YYYY/MM/DD, DD.MM.YYYY, MM.YYYY,
/// DD.MM.YY, "today"/"heute" and "yesterday"/"gestern".
pub(crate) fn parse_date_range(value: &str, now: i64) -> Option<(i64, i64)> {
    let v = value.trim().to_lowercase();
    let day = |y: i32, m: u32, d: u32| -> Option<(i64, i64)> {
        let start = exact_local_date(y, m, d)?;
        Some((start, local_date(y, m as i32 - 1, d as i32 + 1)))
    };
    let month = |y: i32, m: u32| -> Option<(i64, i64)> {
        if !(1..=12).contains(&m) {
            return None;
        }
        Some((local_date(y, m as i32 - 1, 1), local_date(y, m as i32, 1)))
    };
    let num = |s: &str| s.parse::<u32>().ok();

    if v == "today" || v == "heute" {
        let p = local_parts(now);
        return day(p.year, p.month0 as u32 + 1, p.day as u32);
    }
    if v == "yesterday" || v == "gestern" {
        let p = local_parts(now);
        let y = local_parts(local_date(p.year, p.month0, p.day - 1));
        return day(y.year, y.month0 as u32 + 1, y.day as u32);
    }
    if let Some(m) = YEAR.captures(&v) {
        let y: i32 = m[1].parse().ok()?;
        return Some((local_date(y, 0, 1), local_date(y + 1, 0, 1)));
    }
    if let Some(m) = YEAR_MONTH.captures(&v) {
        return month(m[1].parse().ok()?, num(&m[2])?);
    }
    if let Some(m) = MONTH_YEAR.captures(&v) {
        return month(m[2].parse().ok()?, num(&m[1])?);
    }
    if let Some(m) = ISO_DAY.captures(&v) {
        return day(m[1].parse().ok()?, num(&m[2])?, num(&m[3])?);
    }
    if let Some(m) = GERMAN_DAY.captures(&v) {
        let mut y: i32 = m[3].parse().ok()?;
        if y < 100 {
            y += if y >= 70 { 1900 } else { 2000 };
        }
        return day(y, num(&m[2])?, num(&m[1])?);
    }
    None
}

static SIZE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^>?=?\s*(\d+(?:[.,]\d+)?)\s*(b|k|kb|kib|m|mb|mib|g|gb|gib)?$").unwrap());

/// Parses sizes such as "500kb", "1.5 MB", "2m" or "1024" (bytes).
pub fn parse_size(value: &str) -> Option<i64> {
    let m = SIZE.captures(value.trim())?;
    let n: f64 = m[1].replace(',', ".").parse().ok()?;
    let unit = m.get(2).map_or("b".to_string(), |u| u.as_str().to_lowercase());
    let factor = match unit.chars().next() {
        Some('g') => 1024f64.powi(3),
        Some('m') => 1024f64.powi(2),
        Some('k') => 1024.0,
        _ => 1.0,
    };
    Some((n * factor).round() as i64)
}

/// Positive terms of a parsed query, longest first (for highlighting).
pub(crate) fn highlight_terms(query: &ParsedQuery) -> Vec<String> {
    let mut terms: Vec<String> = Vec::new();
    for clause in query.clauses.iter().filter(|c| !c.negate) {
        for term in &clause.terms {
            if !terms.contains(term) {
                terms.push(term.clone());
            }
        }
    }
    // Longer terms first so that overlapping highlights prefer the longest match.
    terms.sort_by_key(|t| std::cmp::Reverse(t.chars().count()));
    terms
}

/// True if the query restricts the result beyond folder browsing.
pub(crate) fn is_empty_query(q: &ParsedQuery) -> bool {
    q.clauses.is_empty()
        && q.folder_names.is_empty()
        && q.has_attachments.is_none()
        && q.read_state.is_none()
        && q.important.is_none()
        && q.flagged.is_none()
        && q.security.is_none()
        && q.date_from.is_none()
        && q.date_to.is_none()
        && q.min_size.is_none()
        && q.max_size.is_none()
        && q.kinds.is_none()
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_759_752_000_000; // 2025-10-06 12:00 UTC

    fn clause(field: Option<SearchField>, terms: &[&str], negate: bool) -> QueryClause {
        QueryClause { field, terms: terms.iter().map(|t| t.to_string()).collect(), negate }
    }

    #[test]
    fn parses_terms_phrases_and_negation() {
        let q = parse_query(r#"Rechnung "Viele Grüße" -newsletter angebot OR offer"#, NOW);
        assert_eq!(
            q.clauses,
            vec![
                clause(None, &["rechnung"], false),
                clause(None, &["viele grusse"], false),
                clause(None, &["newsletter"], true),
                clause(None, &["angebot", "offer"], false),
            ]
        );
    }

    #[test]
    fn parses_fields_in_both_languages() {
        let q = parse_query("von:anna betreff:\"Q3 Bericht\" anhang:pdf to:bob inhalt:alpha", NOW);
        assert_eq!(
            q.clauses,
            vec![
                clause(Some(SearchField::From), &["anna"], false),
                clause(Some(SearchField::Subject), &["q3 bericht"], false),
                clause(Some(SearchField::Attachments), &["pdf"], false),
                clause(Some(SearchField::To), &["bob"], false),
                clause(Some(SearchField::Body), &["alpha"], false),
            ]
        );
    }

    #[test]
    fn parses_operators() {
        let q = parse_query("hat:anhang ist:ungelesen is:important größer:1,5mb kleiner:2mb typ:termin ordner:Archiv is:signed", NOW);
        assert_eq!(q.has_attachments, Some(true));
        assert_eq!(q.read_state, Some(QueryReadState::Unread));
        assert_eq!(q.important, Some(true));
        assert_eq!(q.min_size, Some(1_572_864));
        assert_eq!(q.max_size, Some(2_097_152));
        assert_eq!(q.kinds, Some(vec![ItemKind::Appointment]));
        assert_eq!(q.folder_names, vec!["archiv".to_string()]);
        assert_eq!(q.security, Some(SecurityKind::Signed));
        assert!(q.clauses.is_empty());
    }

    #[test]
    fn keeps_unknown_prefixes_as_text() {
        let q = parse_query("Re:Angebot is:banana 10:30", NOW);
        let terms: Vec<_> = q.clauses.iter().map(|c| c.terms[0].as_str()).collect();
        assert_eq!(terms, vec!["re:angebot", "is:banana", "10:30"]);
    }

    #[test]
    fn parses_dates() {
        let q = parse_query("nach:1.3.2024 vor:2024-06", NOW);
        assert_eq!(q.date_from, Some(local_date(2024, 2, 1)));
        assert_eq!(q.date_to, Some(local_date(2024, 5, 1)));
        let q = parse_query("bis:2024-06 datum:2024", NOW);
        assert_eq!(q.date_from, Some(local_date(2024, 0, 1)));
        assert_eq!(q.date_to, Some(local_date(2024, 6, 1)));
        assert_eq!(parse_date_range("31.02.2024", NOW), None);
        assert_eq!(parse_date_range("heute", NOW).map(|r| r.1 - r.0 > 0), Some(true));
    }

    #[test]
    fn sizes() {
        assert_eq!(parse_size("500kb"), Some(512_000));
        assert_eq!(parse_size("1024"), Some(1024));
        assert_eq!(parse_size("2 GB"), Some(2_147_483_648));
        assert_eq!(parse_size("x"), None);
    }

    #[test]
    fn highlight_terms_are_longest_first() {
        let q = parse_query("ab abcd -xyz abc", NOW);
        assert_eq!(highlight_terms(&q), vec!["abcd", "abc", "ab"]);
    }
}
