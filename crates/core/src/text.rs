//! Text normalisation used for searching and highlighting (port of
//! `shared/text.ts`).
//!
//! "Folding" lower-cases text and strips diacritics so that a search for
//! "muller" also finds "Müller". Both the index and the query are folded with
//! the same function.

use unicode_normalization::UnicodeNormalization;
use unicode_normalization::char::is_combining_mark;

use crate::model::MatchRange;

pub fn fold(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.to_lowercase().nfd() {
        if is_combining_mark(c) {
            continue;
        }
        if c == 'ß' {
            out.push_str("ss");
        } else {
            out.push(c);
        }
    }
    out
}

/// Folds text and collapses all whitespace runs to a single space.
pub fn fold_for_index(text: &str) -> String {
    squash(&fold(text))
}

/// Collapses whitespace for single-line display.
pub fn squash(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut space = false;
    for c in text.chars() {
        if c.is_whitespace() {
            space = !out.is_empty();
        } else {
            if space {
                out.push(' ');
                space = false;
            }
            out.push(c);
        }
    }
    out
}

/// Normalises whitespace while keeping paragraph structure: unifies line
/// breaks, removes zero-width characters, collapses spaces and limits empty
/// lines to one.
pub fn tidy_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut pending_space = false;
    let mut newlines = 0usize;
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        let c = match c {
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                '\n'
            }
            '\u{00A0}' | '\u{2007}' | '\u{202F}' => ' ',
            '\u{200B}' | '\u{200C}' | '\u{200D}' | '\u{FEFF}' => continue,
            c => c,
        };
        match c {
            ' ' | '\t' | '\x0B' | '\x0C' => pending_space = true,
            '\n' => {
                pending_space = false;
                newlines += 1;
            }
            _ => {
                if newlines > 0 {
                    if !out.is_empty() {
                        out.push_str(if newlines >= 2 { "\n\n" } else { "\n" });
                    }
                    newlines = 0;
                } else if pending_space && !out.is_empty() {
                    out.push(' ');
                }
                pending_space = false;
                out.push(c);
            }
        }
    }
    out
}

/// Byte ranges in `text` that match any of the folded `terms`. Ranges never
/// overlap and are sorted.
pub(crate) fn find_match_bytes(text: &str, terms: &[String]) -> Vec<(usize, usize)> {
    if text.is_empty() || terms.iter().all(|t| t.is_empty()) {
        return Vec::new();
    }
    // Fold character by character and keep a map back to the source.
    let mut folded = String::with_capacity(text.len());
    let mut map: Vec<(usize, usize)> = Vec::with_capacity(text.len());
    let mut buf = [0u8; 4];
    for (start, c) in text.char_indices() {
        let end = start + c.len_utf8();
        let before = folded.len();
        if c.is_ascii() {
            folded.push(c.to_ascii_lowercase());
        } else {
            folded.push_str(&fold(c.encode_utf8(&mut buf)));
        }
        for _ in before..folded.len() {
            map.push((start, end));
        }
    }

    let mut ranges: Vec<(usize, usize)> = Vec::new();
    for term in terms {
        if term.is_empty() {
            continue;
        }
        for (idx, _) in folded.match_indices(term.as_str()) {
            let start = map[idx].0;
            let end = map[idx + term.len() - 1].1;
            ranges.push((start, end));
        }
    }
    merge_ranges(ranges)
}

fn merge_ranges(mut ranges: Vec<(usize, usize)>) -> Vec<(usize, usize)> {
    if ranges.len() <= 1 {
        return ranges;
    }
    ranges.sort_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)));
    let mut merged: Vec<(usize, usize)> = Vec::with_capacity(ranges.len());
    for range in ranges {
        match merged.last_mut() {
            Some(last) if range.0 <= last.1 => last.1 = last.1.max(range.1),
            _ => merged.push(range),
        }
    }
    merged
}

/// Ranges of `text` matching any of the folded `terms`, in UTF-16 code units.
pub fn find_matches(text: &str, terms: &[String]) -> Vec<MatchRange> {
    let ranges = find_match_bytes(text, terms);
    if ranges.is_empty() {
        return Vec::new();
    }
    // Convert byte offsets to UTF-16 offsets in one pass.
    let mut offsets = Vec::with_capacity(ranges.len() * 2);
    for (start, end) in &ranges {
        offsets.push(*start);
        offsets.push(*end);
    }
    let mut converted = Vec::with_capacity(offsets.len());
    let mut next = 0;
    let mut utf16 = 0u32;
    for (byte, c) in text.char_indices() {
        while next < offsets.len() && offsets[next] <= byte {
            converted.push(utf16);
            next += 1;
        }
        utf16 += c.len_utf16() as u32;
    }
    while next < offsets.len() {
        converted.push(utf16);
        next += 1;
    }
    converted.chunks(2).map(|pair| MatchRange { start: pair[0], end: pair[1] }).collect()
}

fn back_chars(text: &str, pos: usize, count: usize) -> usize {
    text[..pos].char_indices().rev().nth(count.saturating_sub(1)).map_or(0, |(i, _)| i)
}

fn forward_chars(text: &str, pos: usize, count: usize) -> usize {
    text[pos..].char_indices().nth(count).map_or(text.len(), |(i, _)| pos + i)
}

/// A short excerpt of `text` around the first match of any term, or None if
/// no term matches.
pub fn make_snippet(text: &str, terms: &[String], radius: usize) -> Option<String> {
    let matches = find_match_bytes(text, terms);
    let (first_start, first_end) = *matches.first()?;
    let mut start = if radius == 0 { first_start } else { back_chars(text, first_start, radius) };
    let mut end = forward_chars(text, first_end, radius * 2);
    // Snap to word boundaries so that the excerpt does not start mid-word.
    if start > 0 {
        if let Some(space) = text[start..].find(' ') {
            if start + space < first_start {
                start += space + 1;
            }
        }
    }
    if end < text.len() {
        if let Some(space) = text[..end].rfind(' ') {
            if space > first_end {
                end = space;
            }
        }
    }
    let mut snippet = String::new();
    if start > 0 {
        snippet.push_str("… ");
    }
    snippet.push_str(text[start..end].trim());
    if end < text.len() {
        snippet.push_str(" …");
    }
    Some(snippet)
}

/// Shortens `text` to at most `max` characters.
pub(crate) fn truncate_chars(text: &str, max: usize) -> &str {
    match text.char_indices().nth(max) {
        Some((i, _)) => &text[..i],
        None => text,
    }
}

/// Shortens `text` to at most `max` bytes without splitting a character.
pub(crate) fn truncate_bytes(text: &str, max: usize) -> &str {
    if text.len() <= max {
        return text;
    }
    let mut end = max;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn terms(list: &[&str]) -> Vec<String> {
        list.iter().map(|t| fold_for_index(t)).collect()
    }

    #[test]
    fn folds_case_and_diacritics() {
        assert_eq!(fold("Müller Straße ÉTÉ"), "muller strasse ete");
        assert_eq!(fold_for_index("  Grüße\n aus\tWürzburg "), "grusse aus wurzburg");
    }

    #[test]
    fn finds_matches_in_utf16_units() {
        let text = "Grüße von 😀 Müller";
        let ranges = find_matches(text, &terms(&["muller", "grusse"]));
        let utf16: Vec<u16> = text.encode_utf16().collect();
        let found: Vec<String> = ranges.iter().map(|r| String::from_utf16(&utf16[r.start as usize..r.end as usize]).unwrap()).collect();
        assert_eq!(found, vec!["Grüße", "Müller"]);
    }

    #[test]
    fn merges_overlapping_matches() {
        assert_eq!(find_match_bytes("abcdef", &terms(&["abc", "bcd"])), vec![(0, 4)]);
    }

    #[test]
    fn builds_snippets() {
        let text = "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum.";
        let snippet = make_snippet(text, &terms(&["voluptua"]), 30).unwrap();
        assert!(snippet.starts_with("… "));
        assert!(snippet.contains("voluptua"));
        assert!(make_snippet(text, &terms(&["xyz"]), 30).is_none());
    }

    #[test]
    fn tidies_text() {
        assert_eq!(tidy_text("  Hallo\u{00A0}Welt \r\n\r\n\r\n\n Zeile\u{200B}2  "), "Hallo Welt\n\nZeile2");
        assert_eq!(squash(" a \n b\t c "), "a b c");
    }
}
