//! Folder tree handling (port of `worker/folders.ts`).

use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use regex::Regex;

use crate::model::{FolderInfo, SpecialFolder};

/// A folder while the archive is built; flattened to `FolderInfo` for the apps.
#[derive(Clone, Debug)]
pub(crate) struct FolderNode {
    pub id: u32,
    pub name: String,
    pub special: Option<SpecialFolder>,
    pub container_class: String,
    pub item_count: u32,
    pub unread_count: u32,
    pub total_count: u32,
    pub children: Vec<FolderNode>,
}

impl FolderNode {
    pub fn new(id: u32, name: String, special: Option<SpecialFolder>, container_class: String) -> Self {
        Self { id, name, special, container_class, item_count: 0, unread_count: 0, total_count: 0, children: Vec::new() }
    }
}

static NAME_PATTERNS: LazyLock<Vec<(SpecialFolder, Regex)>> = LazyLock::new(|| {
    use SpecialFolder::*;
    [
        (Inbox, r"^(inbox|posteingang|boîte de réception|bandeja de entrada|posta in arrivo|postvak in)$"),
        (Drafts, r"^(drafts|entwürfe|entwuerfe|brouillons|borradores|bozze|concepten)$"),
        (
            Sent,
            r"^(sent items|sent|sent mail|sent messages|gesendete elemente|gesendet|gesendete objekte|gesendete nachrichten|éléments envoyés|elementos enviados|posta inviata|verzonden items)$",
        ),
        (
            Deleted,
            r"^(deleted items|deleted|deleted messages|trash|bin|gelöschte elemente|geloeschte elemente|gelöschte nachrichten|papierkorb|éléments supprimés|elementos eliminados|posta eliminata|verwijderde items)$",
        ),
        (Archive, r"^(archive|archived|archiv|archiviert|archives|archivo|archivio|archief|all mail|alle nachrichten)$"),
        (
            Junk,
            r"^(junk e-?mail|junk-e-mail|junk|spam|junk-e-mail-ordner|courrier indésirable|correo no deseado|posta indesiderata|ongewenste e-mail)$",
        ),
        (Outbox, r"^(outbox|postausgang|boîte d'envoi|bandeja de salida|posta in uscita|postvak uit)$"),
        (SyncIssues, r"^(sync issues|synchronisierungsprobleme|problèmes de synchronisation)$"),
        (Rss, r"^(rss[- ]feeds?|rss[- ]abonnements|rss subscriptions)$"),
    ]
    .into_iter()
    .map(|(special, pattern)| (special, Regex::new(&format!("(?i){pattern}")).unwrap()))
    .collect()
});

static CLASS_PATTERNS: LazyLock<Vec<(SpecialFolder, Regex)>> = LazyLock::new(|| {
    use SpecialFolder::*;
    [
        (Calendar, r"^IPF\.Appointment"),
        (Contacts, r"^IPF\.Contact"),
        (Tasks, r"^IPF\.Task"),
        (Notes, r"^IPF\.StickyNote"),
        (Journal, r"^IPF\.Journal"),
    ]
    .into_iter()
    .map(|(special, pattern)| (special, Regex::new(&format!("(?i){pattern}")).unwrap()))
    .collect()
});

/// Well-known folders are only detected at the top level (`depth == 0`).
pub(crate) fn detect_special_folder(name: &str, container_class: &str, depth: usize) -> Option<SpecialFolder> {
    for (special, pattern) in CLASS_PATTERNS.iter() {
        if pattern.is_match(container_class) {
            return (depth == 0).then_some(*special);
        }
    }
    if depth != 0 {
        return None;
    }
    let name = name.trim();
    NAME_PATTERNS.iter().find(|(_, pattern)| pattern.is_match(name)).map(|(special, _)| *special)
}

const USER_FOLDER_RANK: u32 = 10;

fn rank(folder: &FolderNode) -> u32 {
    use SpecialFolder::*;
    match folder.special {
        None => USER_FOLDER_RANK,
        Some(Inbox) => 0,
        Some(Drafts) => 1,
        Some(Sent) => 2,
        Some(Deleted) => 3,
        Some(Archive) => 4,
        Some(Junk) => 5,
        Some(Outbox) => 6,
        Some(Calendar) => 20,
        Some(Contacts) => 21,
        Some(Tasks) => 22,
        Some(Notes) => 23,
        Some(Journal) => 24,
        Some(Rss) => 30,
        Some(SyncIssues) => 31,
    }
}

/// Natural, case- and accent-insensitive name comparison ("Ordner 2" < "Ordner 10").
pub(crate) fn compare_names(a: &str, b: &str) -> Ordering {
    let key = |s: &str| crate::text::fold(s);
    let (a, b) = (key(a), key(b));
    let mut ai = a.chars().peekable();
    let mut bi = b.chars().peekable();
    loop {
        match (ai.peek().copied(), bi.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) if x.is_ascii_digit() && y.is_ascii_digit() => {
                let mut na = String::new();
                while let Some(c) = ai.peek().copied().filter(char::is_ascii_digit) {
                    na.push(c);
                    ai.next();
                }
                let mut nb = String::new();
                while let Some(c) = bi.peek().copied().filter(char::is_ascii_digit) {
                    nb.push(c);
                    bi.next();
                }
                let (ta, tb) = (na.trim_start_matches('0'), nb.trim_start_matches('0'));
                let ord = ta.len().cmp(&tb.len()).then_with(|| ta.cmp(tb));
                if ord != Ordering::Equal {
                    return ord;
                }
            }
            (Some(x), Some(y)) => {
                if x != y {
                    return x.cmp(&y);
                }
                ai.next();
                bi.next();
            }
        }
    }
}

/// Orders folders like Outlook does: well-known folders first, then by name.
pub(crate) fn sort_folders(folders: &mut [FolderNode]) {
    folders.sort_by(|a, b| {
        rank(a).cmp(&rank(b)).then_with(|| {
            // Prefer the folder that actually holds items when names collide
            // (e.g. "Deleted Items" and "Gelöschte Elemente").
            if a.special.is_some() && a.special == b.special { b.total_count.cmp(&a.total_count) } else { compare_names(&a.name, &b.name) }
        })
    });
    for folder in folders.iter_mut() {
        sort_folders(&mut folder.children);
    }
}

/// Sums up the item counts of each subtree.
pub(crate) fn compute_totals(folder: &mut FolderNode) -> u32 {
    let mut total = folder.item_count;
    for child in folder.children.iter_mut() {
        total += compute_totals(child);
    }
    folder.total_count = total;
    total
}

/// All folder ids of a subtree, including the root.
pub(crate) fn collect_folder_ids(folder: &FolderNode, into: &mut HashSet<u32>) {
    into.insert(folder.id);
    for child in &folder.children {
        collect_folder_ids(child, into);
    }
}

/// Removes folders without items and without non-empty children.
pub(crate) fn prune_empty(folders: &mut Vec<FolderNode>) {
    for folder in folders.iter_mut() {
        prune_empty(&mut folder.children);
    }
    folders.retain(|f| f.item_count > 0 || !f.children.is_empty());
}

/// Folder lookup tables derived from the finished tree.
#[derive(Default)]
pub(crate) struct FolderIndex {
    /// Depth-first list in display order.
    pub list: Vec<FolderInfo>,
    /// Folder id to the ids of the folder and all of its descendants.
    pub subtree_ids: HashMap<u32, HashSet<u32>>,
    pub names: HashMap<u32, String>,
    pub special: HashMap<u32, SpecialFolder>,
}

impl FolderIndex {
    pub fn build(roots: &[FolderNode]) -> Self {
        let mut index = FolderIndex::default();
        fn walk(index: &mut FolderIndex, nodes: &[FolderNode], parent: Option<u32>, depth: u32) {
            for node in nodes {
                index.list.push(FolderInfo {
                    id: node.id,
                    parent_id: parent,
                    depth,
                    name: node.name.clone(),
                    special: node.special,
                    container_class: node.container_class.clone(),
                    item_count: node.item_count,
                    unread_count: node.unread_count,
                    total_count: node.total_count,
                    child_count: node.children.len() as u32,
                });
                let mut ids = HashSet::new();
                collect_folder_ids(node, &mut ids);
                index.subtree_ids.insert(node.id, ids);
                index.names.insert(node.id, node.name.clone());
                if let Some(special) = node.special {
                    index.special.insert(node.id, special);
                }
                walk(index, &node.children, Some(node.id), depth + 1);
            }
        }
        walk(&mut index, roots, None, 0);
        index
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_special_folders() {
        assert_eq!(detect_special_folder("Posteingang", "", 0), Some(SpecialFolder::Inbox));
        assert_eq!(detect_special_folder("Gesendete Elemente", "IPF.Note", 0), Some(SpecialFolder::Sent));
        assert_eq!(detect_special_folder("Kalender", "IPF.Appointment", 0), Some(SpecialFolder::Calendar));
        assert_eq!(detect_special_folder("Inbox", "", 1), None);
        assert_eq!(detect_special_folder("Projekte", "", 0), None);
    }

    #[test]
    fn sorts_like_outlook() {
        let node = |id, name: &str, special| FolderNode::new(id, name.into(), special, String::new());
        let mut folders = vec![
            node(1, "Ordner 10", None),
            node(2, "Gesendet", Some(SpecialFolder::Sent)),
            node(3, "Ordner 2", None),
            node(4, "Posteingang", Some(SpecialFolder::Inbox)),
            node(5, "ärger", None),
        ];
        sort_folders(&mut folders);
        let names: Vec<_> = folders.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, vec!["Posteingang", "Gesendet", "ärger", "Ordner 2", "Ordner 10"]);
    }
}
