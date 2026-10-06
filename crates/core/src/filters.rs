//! Filter helpers (port of `shared/filters.ts`).

use crate::model::{DatePreset, ReadState, SearchFilters};

/// Number of filters that differ from the defaults (for badges).
pub fn count_active_filters(f: &SearchFilters) -> u32 {
    [
        !f.fields.is_empty(),
        f.date_preset != DatePreset::Any,
        !f.from.trim().is_empty(),
        !f.to.trim().is_empty(),
        f.has_attachments,
        f.attachment_type.is_some(),
        f.read_state != ReadState::Any,
        f.important,
        f.flagged,
        f.min_size.is_some(),
        !f.kinds.is_empty(),
    ]
    .into_iter()
    .filter(|active| *active)
    .count() as u32
}

/// True if any filter restricts the result (search fields alone do not).
pub fn has_active_filters(f: &SearchFilters) -> bool {
    count_active_filters(f) - u32::from(!f.fields.is_empty()) > 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::SearchField;

    #[test]
    fn counts_filters() {
        let mut f = SearchFilters::default();
        assert_eq!(count_active_filters(&f), 0);
        f.fields = vec![SearchField::Subject];
        assert_eq!(count_active_filters(&f), 1);
        assert!(!has_active_filters(&f));
        f.flagged = true;
        assert!(has_active_filters(&f));
    }
}
