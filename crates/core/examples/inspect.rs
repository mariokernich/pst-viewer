//! Prints the folder tree, date groups and items of an archive.
//!
//!     cargo run -p pst-viewer-core --example inspect -- <file or folder> [query]
//!
//! Development aid: it prints subjects and senders, so use it with test data.

use std::time::{Duration, Instant};

use pst_viewer_core::*;

fn main() {
    let mut args = std::env::args().skip(1);
    let path = args.next().expect("usage: inspect <file or folder> [query]");
    let query = args.next().unwrap_or_default();
    let started = Instant::now();
    let session = ArchiveSession::open(path, None, None).expect("open");
    while !session.info().unwrap().content_indexed {
        std::thread::sleep(Duration::from_millis(10));
    }
    let info = session.info().unwrap();
    println!(
        "{:?}: {} items, {} folders, indexed in {:?}",
        info.store.format,
        info.store.item_count,
        info.store.folder_count,
        started.elapsed()
    );
    for f in &info.folders {
        println!("{}{} {:?} ({} items, {} unread)", "  ".repeat(f.depth as usize), f.name, f.special, f.item_count, f.unread_count);
    }
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let result = session
        .search(SearchRequest {
            text: query,
            folder_id: None,
            include_subfolders: true,
            filters: default_filters(),
            sort: SortSpec { field: SortField::Date, dir: SortDir::Desc },
            now,
            first_day_of_week: 1,
            page_size: 1000,
        })
        .unwrap();
    println!("\n{} results, highlight {:?}", result.total, result.highlight_terms);
    for group in &result.groups {
        println!("\n{:?}", group.group);
        for item in &result.items[group.start as usize..(group.start + group.count) as usize] {
            let marks = format!(
                "{}{}{}",
                if item.is_read { " " } else { "●" },
                if item.flagged { "⚑" } else { " " },
                if item.attachment_count > 0 { "📎" } else { "  " }
            );
            println!("  {marks} {:<24} {:<50} {}", item.from_name, item.subject, item.preview.chars().take(50).collect::<String>());
        }
    }
}
