//! Searching, sorting and date grouping of the item list (port of
//! `worker/search.ts`).

use std::collections::HashSet;
use std::sync::LazyLock;

use regex::Regex;

use crate::archive::ArchiveIndex;
use crate::filters::has_active_filters;
use crate::index::{IndexedItem, attachment_type_bit};
use crate::model::{
    DateGroup, DatePreset, Importance, ReadState, ResultGroup, SearchField, SearchFilters, SearchRequest, SortDir, SortField,
};
use crate::query::{ParsedQuery, QueryClause, QueryReadState, highlight_terms, is_empty_query, parse_query};
use crate::text::fold_for_index;
use crate::time::{add_days, exact_local_date, local_date, local_parts, start_of_day};

pub(crate) struct SearchOutcome {
    /// Positions in `ArchiveIndex::items`, in display order.
    pub order: Vec<usize>,
    pub groups: Vec<ResultGroup>,
    pub highlight_terms: Vec<String>,
    /// Terms that may have matched in the body (used for snippets).
    pub body_terms: Vec<String>,
    pub is_search: bool,
}

const ALL_FIELDS: [SearchField; 5] =
    [SearchField::Subject, SearchField::From, SearchField::To, SearchField::Body, SearchField::Attachments];

fn effective_fields(filters: &SearchFilters) -> Vec<SearchField> {
    if filters.fields.is_empty() { ALL_FIELDS.to_vec() } else { filters.fields.clone() }
}

pub(crate) fn run_search(index: &ArchiveIndex, req: &SearchRequest) -> SearchOutcome {
    let parsed = parse_query(&req.text, req.now);
    let predicate = Predicate::new(index, req, &parsed);

    let mut order: Vec<usize> = index.items.iter().enumerate().filter(|(_, item)| predicate.matches(item)).map(|(i, _)| i).collect();
    sort_matches(&index.items, &mut order, req);
    let groups =
        if req.sort.field == SortField::Date { group_by_date(&index.items, &order, req.now, req.first_day_of_week) } else { Vec::new() };
    let fields = effective_fields(&req.filters);
    let body_terms = parsed
        .clauses
        .iter()
        .filter(|c| !c.negate && (c.field == Some(SearchField::Body) || (c.field.is_none() && fields.contains(&SearchField::Body))))
        .flat_map(|c| c.terms.iter().cloned())
        .collect();

    SearchOutcome {
        order,
        groups,
        highlight_terms: highlight_terms(&parsed),
        body_terms,
        is_search: !is_empty_query(&parsed) || has_active_filters(&req.filters) || req.folder_id.is_none(),
    }
}

struct TextClause {
    fields: Vec<SearchField>,
    terms: Vec<String>,
    negate: bool,
}

impl TextClause {
    fn new(clause: &QueryClause, enabled: &[SearchField]) -> Self {
        Self { fields: clause.field.map_or_else(|| enabled.to_vec(), |f| vec![f]), terms: clause.terms.clone(), negate: clause.negate }
    }

    fn matches(&self, item: &IndexedItem) -> bool {
        let found = self.fields.iter().any(|field| {
            let value = field_value(item, *field);
            self.terms.iter().any(|term| value.contains(term.as_str()))
        });
        found != self.negate
    }
}

fn field_value(item: &IndexedItem, field: SearchField) -> &str {
    match field {
        SearchField::Subject => &item.s_subject,
        SearchField::From => &item.s_from,
        SearchField::To => &item.s_to,
        SearchField::Body => &item.s_body,
        SearchField::Attachments => &item.s_attach,
    }
}

/// All checks of a request; cheap checks come first, text clauses last.
struct Predicate {
    folders: Option<HashSet<u32>>,
    date_from: Option<i64>,
    date_to: Option<i64>,
    kinds: Option<Vec<crate::model::ItemKind>>,
    has_attachments: Option<bool>,
    attachment_bit: Option<u8>,
    read_state: Option<QueryReadState>,
    important: Option<bool>,
    flagged: Option<bool>,
    security: Option<crate::model::SecurityKind>,
    min_size: i64,
    max_size: Option<i64>,
    from_filter: String,
    to_filter: String,
    clauses: Vec<TextClause>,
}

impl Predicate {
    fn new(index: &ArchiveIndex, req: &SearchRequest, q: &ParsedQuery) -> Self {
        let f = &req.filters;

        // Folder scope
        let mut folders: Option<HashSet<u32>> = req.folder_id.map(|id| {
            if req.include_subfolders {
                index.folders.subtree_ids.get(&id).cloned().unwrap_or_else(|| HashSet::from([id]))
            } else {
                HashSet::from([id])
            }
        });
        if !q.folder_names.is_empty() {
            let mut named = HashSet::new();
            for (id, name) in &index.folders.names {
                let name = fold_for_index(name);
                if q.folder_names.iter().any(|n| name.contains(n.as_str())) {
                    named.extend(index.folders.subtree_ids.get(id).into_iter().flatten().copied());
                    named.insert(*id);
                }
            }
            folders = Some(match folders {
                Some(allowed) => allowed.intersection(&named).copied().collect(),
                None => named,
            });
        }

        // Date range
        let mut date_from = q.date_from;
        let mut date_to = q.date_to;
        if let Some((from, to)) = preset_range(f, req.now) {
            if let Some(from) = from {
                date_from = Some(date_from.map_or(from, |d| d.max(from)));
            }
            if let Some(to) = to {
                date_to = Some(date_to.map_or(to, |d| d.min(to)));
            }
        }

        // Kinds
        let mut kinds = (!f.kinds.is_empty()).then(|| f.kinds.clone());
        if let Some(query_kinds) = &q.kinds {
            kinds = Some(match kinds {
                Some(list) => query_kinds.iter().filter(|k| list.contains(k)).copied().collect(),
                None => query_kinds.clone(),
            });
        }

        let has_attachments = if f.has_attachments || q.has_attachments == Some(true) { Some(true) } else { q.has_attachments };
        let read_state = q.read_state.or(match f.read_state {
            ReadState::Any => None,
            ReadState::Unread => Some(QueryReadState::Unread),
            ReadState::Read => Some(QueryReadState::Read),
        });
        let important = if f.important || q.important == Some(true) { Some(true) } else { q.important };
        let flagged = if f.flagged || q.flagged == Some(true) { Some(true) } else { q.flagged };
        let fields = effective_fields(f);

        Self {
            folders,
            date_from,
            date_to,
            kinds,
            has_attachments,
            attachment_bit: f.attachment_type.map(attachment_type_bit),
            read_state,
            important,
            flagged,
            security: q.security,
            min_size: f.min_size.unwrap_or(0).max(q.min_size.unwrap_or(0)),
            max_size: q.max_size,
            from_filter: fold_for_index(&f.from),
            to_filter: fold_for_index(&f.to),
            clauses: q.clauses.iter().map(|c| TextClause::new(c, &fields)).collect(),
        }
    }

    fn matches(&self, item: &IndexedItem) -> bool {
        if let Some(allowed) = &self.folders {
            if !allowed.contains(&item.folder_id) && !item.extra_folder_ids.iter().any(|id| allowed.contains(id)) {
                return false;
            }
        }
        if self.date_from.is_some_and(|from| item.date < from) || self.date_to.is_some_and(|to| item.date >= to) {
            return false;
        }
        if let Some(kinds) = &self.kinds {
            if !kinds.contains(&item.kind) {
                return false;
            }
        }
        match self.has_attachments {
            Some(true) if item.attachment_count == 0 => return false,
            Some(false) if item.attachment_count > 0 => return false,
            _ => {}
        }
        if let Some(bit) = self.attachment_bit {
            if item.attachment_kinds & bit == 0 {
                return false;
            }
        }
        match self.read_state {
            Some(QueryReadState::Unread) if item.is_read => return false,
            Some(QueryReadState::Read) if !item.is_read => return false,
            _ => {}
        }
        if let Some(important) = self.important {
            if (item.importance == Importance::High) != important {
                return false;
            }
        }
        if let Some(flagged) = self.flagged {
            if item.flagged != flagged {
                return false;
            }
        }
        if let Some(security) = self.security {
            if item.security != Some(security) {
                return false;
            }
        }
        if self.min_size > 0 && item.size < self.min_size {
            return false;
        }
        if self.max_size.is_some_and(|max| item.size > max) {
            return false;
        }
        if !self.from_filter.is_empty() && !item.s_from.contains(self.from_filter.as_str()) {
            return false;
        }
        if !self.to_filter.is_empty() && !item.s_to.contains(self.to_filter.as_str()) {
            return false;
        }
        self.clauses.iter().all(|clause| clause.matches(item))
    }
}

/// Date range of the filter panel's preset: (inclusive start, exclusive end).
fn preset_range(f: &SearchFilters, now: i64) -> Option<(Option<i64>, Option<i64>)> {
    let p = local_parts(now);
    match f.date_preset {
        DatePreset::Any => None,
        DatePreset::Today => Some((Some(start_of_day(now)), Some(local_date(p.year, p.month0, p.day + 1)))),
        DatePreset::Week => Some((Some(local_date(p.year, p.month0, p.day - 6)), None)),
        DatePreset::Month => Some((Some(local_date(p.year, p.month0 - 1, p.day)), None)),
        DatePreset::Year => Some((Some(local_date(p.year - 1, p.month0, p.day)), None)),
        DatePreset::Custom => {
            let from = f.date_from.as_deref().and_then(parse_iso_date);
            let to = f.date_to.as_deref().and_then(parse_iso_date);
            if from.is_none() && to.is_none() {
                return None;
            }
            Some((from, to.map(|t| add_days(t, 1))))
        }
    }
}

fn parse_iso_date(value: &str) -> Option<i64> {
    let mut parts = value.split('-');
    let (y, m, d) = (parts.next()?, parts.next()?, parts.next()?);
    if parts.next().is_some() || y.len() != 4 || m.len() != 2 || d.len() != 2 {
        return None;
    }
    exact_local_date(y.parse().ok()?, m.parse().ok()?, d.parse().ok()?)
}

static SUBJECT_PREFIX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)^((re|aw|wg|fw|fwd|antw|wtr|tr|sv|vs|rif|r|ref)\s*(\[\d+\])?\s*:\s*)+").unwrap());

fn subject_sort_key(item: &IndexedItem) -> String {
    SUBJECT_PREFIX.replace(&item.s_subject, "").into_owned()
}

fn sort_matches(items: &[IndexedItem], order: &mut [usize], req: &SearchRequest) {
    let asc = req.sort.dir == SortDir::Asc;
    let directed = |ord: std::cmp::Ordering| if asc { ord } else { ord.reverse() };
    let by_date = |a: usize, b: usize| items[a].date.cmp(&items[b].date).then(a.cmp(&b));
    match req.sort.field {
        SortField::Date => order.sort_by(|&a, &b| directed(by_date(a, b))),
        SortField::Size => order.sort_by(|&a, &b| directed(items[a].size.cmp(&items[b].size)).then_with(|| by_date(a, b).reverse())),
        SortField::From | SortField::Subject => {
            let keys: std::collections::HashMap<usize, String> = order
                .iter()
                .map(|&i| {
                    let key = if req.sort.field == SortField::From {
                        fold_for_index(if items[i].from_name.is_empty() { &items[i].from_email } else { &items[i].from_name })
                    } else {
                        subject_sort_key(&items[i])
                    };
                    (i, key)
                })
                .collect();
            order.sort_by(|&a, &b| directed(keys[&a].cmp(&keys[&b])).then_with(|| by_date(a, b).reverse()));
        }
    }
}

fn group_by_date(items: &[IndexedItem], order: &[usize], now: i64, first_day_of_week: u8) -> Vec<ResultGroup> {
    let p = local_parts(now);
    let today = local_date(p.year, p.month0, p.day);
    let tomorrow = local_date(p.year, p.month0, p.day + 1);
    let yesterday = local_date(p.year, p.month0, p.day - 1);
    let days_since_week_start = (p.weekday as i32 - i32::from(first_day_of_week)).rem_euclid(7);
    let week_start = local_date(p.year, p.month0, p.day - days_since_week_start);
    let last_week_start = local_date(p.year, p.month0, p.day - days_since_week_start - 7);
    let month_start = local_date(p.year, p.month0, 1);

    let classify = |t: i64| -> DateGroup {
        if t == 0 {
            DateGroup::Unknown
        } else if t >= today && t < tomorrow {
            DateGroup::Today
        } else if t >= yesterday && t < today {
            DateGroup::Yesterday
        } else if t >= week_start && t < yesterday {
            DateGroup::ThisWeek
        } else if t >= last_week_start && t < week_start && t < yesterday {
            DateGroup::LastWeek
        } else if t >= month_start && t < tomorrow {
            DateGroup::ThisMonth
        } else {
            let d = local_parts(t);
            DateGroup::Month { year: d.year, month: d.month0 as u32 + 1 }
        }
    };

    let mut groups: Vec<ResultGroup> = Vec::new();
    for (i, &position) in order.iter().enumerate() {
        let group = classify(items[position].date);
        match groups.last_mut() {
            Some(last) if last.group == group => last.count += 1,
            _ => groups.push(ResultGroup { group, start: i as u32, count: 1 }),
        }
    }
    groups
}
