//! Integration test against a real PST file, given by `PST_TEST_FILE`.
//! Skipped without it. Only counts and timings are printed, never content.

use std::time::{Duration, Instant};

use pst_viewer_core::*;

fn request(text: &str) -> SearchRequest {
    SearchRequest {
        text: text.to_string(),
        folder_id: None,
        include_subfolders: true,
        filters: default_filters(),
        sort: SortSpec { field: SortField::Date, dir: SortDir::Desc },
        now: 1_759_752_000_000,
        first_day_of_week: 1,
        page_size: 1000,
    }
}

#[test]
fn reads_a_real_pst_file() {
    let Ok(path) = std::env::var("PST_TEST_FILE") else {
        eprintln!("PST_TEST_FILE not set, skipped");
        return;
    };
    let started = Instant::now();
    let session = ArchiveSession::open(path, None, None).expect("open");
    let opened = started.elapsed();
    let info = session.info().unwrap();
    assert!(matches!(info.store.format, ArchiveFormat::Unicode | ArchiveFormat::Ansi));
    assert!(info.store.item_count > 0);
    assert!(!info.folders.is_empty());

    while !session.info().unwrap().content_indexed {
        assert!(started.elapsed() < Duration::from_secs(300), "indexing did not finish");
        std::thread::sleep(Duration::from_millis(20));
    }
    let indexed = started.elapsed();
    let info = session.info().unwrap();

    let all = session.search(request("")).unwrap();
    assert_eq!(all.total, info.store.item_count);
    let mut items = all.items.clone();
    let mut offset = items.len() as u32;
    while offset < all.total {
        let page = session.page(all.token, offset, 1000).unwrap().unwrap();
        offset += page.len() as u32;
        items.extend(page);
    }

    let (
        mut details,
        mut detail_errors,
        mut html,
        mut text_only,
        mut attachments,
        mut attachment_errors,
        mut nested,
        mut emls,
        mut eml_errors,
    ) = (0, 0, 0, 0, 0, 0, 0, 0, 0);
    let mut kinds = std::collections::BTreeMap::new();
    for item in &items {
        *kinds.entry(format!("{:?}", item.kind)).or_insert(0) += 1;
        let message_ref = MessageRef { id: item.id, path: vec![] };
        match session.message(message_ref.clone()) {
            Ok(detail) => {
                details += 1;
                match detail.body_format {
                    BodyFormat::Html => html += 1,
                    BodyFormat::Text => text_only += 1,
                    BodyFormat::None => {}
                }
                for attachment in &detail.attachments {
                    match session.attachment(message_ref.clone(), attachment.index) {
                        Ok(_) => attachments += 1,
                        Err(e) => {
                            attachment_errors += 1;
                            eprintln!("attachment error: {e}");
                        }
                    }
                    if attachment.is_message {
                        let path = vec![attachment.index];
                        if session.message(MessageRef { id: item.id, path }).is_ok() {
                            nested += 1;
                        }
                    }
                }
            }
            Err(e) => {
                detail_errors += 1;
                eprintln!("detail error: {e}");
            }
        }
        match session.export_eml(message_ref) {
            Ok(data) if mail_parser::MessageParser::default().parse(&data).is_some() => emls += 1,
            _ => eml_errors += 1,
        }
    }

    // Searching works on the indexed bodies.
    let searched = Instant::now();
    let body_hits = session.search(request("inhalt:e")).unwrap().total;
    let search_ms = searched.elapsed().as_millis();

    eprintln!(
        "format {:?}, {} folders, {} items ({} skipped), list after {:?}, indexed after {:?}\nkinds {:?}\n{} details ({} html, {} text), {} errors; {} attachments, {} errors, {} attached messages; {} eml exports, {} errors\nbody search: {} hits in {} ms",
        info.store.format,
        info.folders.len(),
        info.store.item_count,
        info.store.skipped_items,
        opened,
        indexed,
        kinds,
        details,
        html,
        text_only,
        detail_errors,
        attachments,
        attachment_errors,
        nested,
        emls,
        eml_errors,
        body_hits,
        search_ms
    );
    assert_eq!(detail_errors, 0);
    assert_eq!(attachment_errors, 0);
    assert_eq!(eml_errors, 0);
}
