//! End-to-end tests of the session API with EML, EMLX, MBOX, MSG files and
//! folders (mirrors `apps/desktop/tests/local.test.ts`).

mod common;

use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};

use common::*;
use pst_viewer_core::*;

const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, b'I', b'H', b'D', b'R'];

fn request(text: &str) -> SearchRequest {
    SearchRequest {
        text: text.to_string(),
        folder_id: None,
        include_subfolders: true,
        filters: default_filters(),
        sort: SortSpec { field: SortField::Date, dir: SortDir::Desc },
        now: 1_759_752_000_000,
        first_day_of_week: 1,
        page_size: 100,
    }
}

fn open(path: &Path) -> Arc<ArchiveSession> {
    let session = ArchiveSession::open(path.to_string_lossy().into_owned(), None, None).unwrap();
    wait_indexed(&session);
    session
}

fn wait_indexed(session: &ArchiveSession) {
    let started = Instant::now();
    while !session.info().unwrap().content_indexed {
        assert!(started.elapsed() < Duration::from_secs(20), "indexing did not finish");
        std::thread::sleep(Duration::from_millis(5));
    }
}

/// Folder tree as "  name [special] (count)" lines.
fn tree(info: &OpenResult) -> Vec<String> {
    info.folders
        .iter()
        .map(|f| {
            format!(
                "{}{}{} ({})",
                "  ".repeat(f.depth as usize),
                f.name,
                f.special.map(|s| format!(" [{s:?}]")).unwrap_or_default(),
                f.item_count
            )
        })
        .collect()
}

fn invoice_eml() -> Vec<u8> {
    build_eml(&Eml {
        from: ("Anna Müller", "anna@example.com"),
        to: ("Bob", "bob@example.com"),
        subject: "Rechnung März",
        html: Some("<p>Hallo Bob, anbei die Rechnung.</p><img src=\"cid:logo@example\">"),
        attachments: &[
            Attachment { filename: "rechnung.pdf", data: b"%PDF-1.4 test", content_type: "application/pdf", cid: None },
            Attachment { filename: "logo.png", data: PNG, content_type: "image/png", cid: Some("logo@example") },
        ],
        ..Eml::default()
    })
}

fn takeout_mbox() -> Vec<u8> {
    build_mbox(
        &[
            build_eml(&Eml {
                from: ("Anna Müller", "anna@example.com"),
                subject: "=?UTF-8?Q?Gr=C3=BC=C3=9Fe_aus_W=C3=BCrzburg?=",
                text: Some("From the start this line was escaped.\nViele Grüße"),
                headers: &[("X-Gmail-Labels", "Posteingang,Geöffnet")],
                ..Eml::default()
            }),
            build_eml(&Eml {
                from: ("Me", "me@example.com"),
                to: ("Carl", "carl@example.com"),
                subject: "Angebot",
                text: Some("Das Angebot im Anhang."),
                headers: &[("X-Gmail-Labels", "Gesendet")],
                date: 1_738_404_000,
                ..Eml::default()
            }),
            build_eml(&Eml {
                from: ("Dora", "dora@example.com"),
                subject: "Projektplan",
                text: Some("Der Projektplan für Alpha."),
                headers: &[("X-Gmail-Labels", "Projekte/Alpha,Posteingang,Ungelesen,Markiert")],
                date: 1_735_725_600,
                ..Eml::default()
            }),
        ],
        false,
    )
}

#[test]
fn eml_single_message() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("invoice.eml");
    let eml = invoice_eml();
    fs::write(&path, &eml).unwrap();

    let session = open(&path);
    let info = session.info().unwrap();
    assert_eq!(info.store.format, ArchiveFormat::Eml);
    assert_eq!(info.store.item_count, 1);
    assert_eq!(tree(&info), vec!["invoice (1)"]);

    let result = session.search(request("")).unwrap();
    let item = &result.items[0];
    assert_eq!(item.subject, "Rechnung März");
    assert_eq!(item.from_name, "Anna Müller");
    assert_eq!(item.attachment_count, 1);

    let detail = session.message(MessageRef { id: item.id, path: vec![] }).unwrap();
    assert!(detail.html.as_deref().unwrap().contains("anbei die Rechnung"));
    assert_eq!(detail.inline_images.keys().collect::<Vec<_>>(), vec!["logo@example"]);
    assert!(detail.inline_images["logo@example"].starts_with("data:image/png;base64,"));
    let visible: Vec<_> = detail.attachments.iter().filter(|a| !a.is_inline).map(|a| a.name.as_str()).collect();
    assert_eq!(visible, vec!["rechnung.pdf"]);

    // .eml exports keep the original message unchanged.
    assert_eq!(session.export_eml(MessageRef { id: item.id, path: vec![] }).unwrap(), eml);
    let pdf_index = detail.attachments.iter().find(|a| a.name == "rechnung.pdf").unwrap().index;
    let file = session.attachment(MessageRef { id: item.id, path: vec![] }, pdf_index).unwrap();
    assert_eq!(file.data, b"%PDF-1.4 test");
    assert_eq!(file.preview_kind, PreviewKind::Pdf);
    assert!(file.can_open);

    session.close();
    assert!(matches!(session.info(), Err(CoreError::Closed)));
}

#[test]
fn mbox_with_gmail_labels() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("takeout.mbox");
    fs::write(&path, takeout_mbox()).unwrap();

    let session = open(&path);
    let info = session.info().unwrap();
    assert_eq!(info.store.format, ArchiveFormat::Mbox);
    assert_eq!(info.store.item_count, 3);
    assert_eq!(tree(&info), vec!["Posteingang [Inbox] (2)", "Gesendet [Sent] (1)", "Projekte (0)", "  Alpha (1)"]);

    let inbox = info.folders.iter().find(|f| f.special == Some(SpecialFolder::Inbox)).unwrap();
    let in_inbox = session.search(SearchRequest { folder_id: Some(inbox.id), include_subfolders: false, ..request("") }).unwrap();
    assert_eq!(in_inbox.total, 2);

    let all = session.search(request("")).unwrap();
    let greeting = all.items.iter().find(|i| i.subject.starts_with("Grüße")).unwrap();
    assert_eq!(greeting.subject, "Grüße aus Würzburg");
    assert!(greeting.is_read);
    let plan = all.items.iter().find(|i| i.subject == "Projektplan").unwrap();
    assert!(!plan.is_read);
    assert!(plan.flagged);

    // mboxrd quoting is undone and bodies are searchable once indexed.
    let detail = session.message(MessageRef { id: greeting.id, path: vec![] }).unwrap();
    assert!(detail.text.contains("From the start this line was escaped."));
    let found = session.search(request("inhalt:projektplan alpha")).unwrap();
    assert_eq!(found.items.iter().map(|i| i.subject.as_str()).collect::<Vec<_>>(), vec!["Projektplan"]);
    assert!(found.items[0].preview.contains("Projektplan"));
    assert_eq!(found.highlight_terms, vec!["projektplan", "alpha"]);
    assert_eq!(session.search(request("ordner:alpha")).unwrap().total, 1);
    assert_eq!(session.search(request("von:dora ist:ungelesen")).unwrap().total, 1);
    assert_eq!(session.search(request("-angebot")).unwrap().total, 2);
}

#[test]
fn thunderbird_read_state_and_crlf() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("Inbox");
    let mbox = build_mbox(
        &[
            build_eml(&Eml { subject: "Gelesen", text: Some("a"), headers: &[("X-Mozilla-Status", "0001")], ..Eml::default() }),
            build_eml(&Eml { subject: "Neu", text: Some("b"), headers: &[("X-Mozilla-Status", "0000")], ..Eml::default() }),
        ],
        true,
    );
    fs::write(&path, mbox).unwrap();
    let session = open(&path);
    assert_eq!(session.info().unwrap().store.format, ArchiveFormat::Mbox);
    let all = session.search(SearchRequest { sort: SortSpec { field: SortField::Subject, dir: SortDir::Asc }, ..request("") }).unwrap();
    assert_eq!(all.items.iter().map(|i| (i.subject.as_str(), i.is_read)).collect::<Vec<_>>(), vec![("Gelesen", true), ("Neu", false)]);
}

fn memo_msg() -> Vec<u8> {
    let agenda = MsgItem {
        props: vec![
            text(0x001A, "IPM.Note"),
            text(0x0037, "Agenda"),
            text(0x0C1A, "Gina"),
            text(0x0C1F, "gina@example.com"),
            text(0x1000, "Punkte für Montag."),
            time(0x0039, 1_743_768_000_000),
        ],
        recipients: vec![vec![long(0x0C15, 1), text(0x3001, "Frank Fischer"), text(0x3003, "frank@example.com")]],
        attachments: vec![],
        messages: vec![],
    };
    let memo = MsgItem {
        props: vec![
            text(0x001A, "IPM.Note"),
            text(0x0037, "Protokoll Besprechung"),
            text(0x0C1A, "Frank Fischer"),
            text(0x0C1F, "frank@example.com"),
            text(0x5D01, "frank@example.com"),
            text(0x1000, "Ergebnisse der Besprechung vom Montag."),
            Prop { id: 0x1013, value: Value::Binary(b"<p>Ergebnisse der <b>Besprechung</b> vom Montag.</p>".to_vec()) },
            long(0x3FDE, 65001),
            time(0x0039, 1_744_014_600_000),
            time(0x0E06, 1_744_014_600_000),
            long(0x0E07, 1),
            Prop { id: 0x8000, value: Value::TextList(vec!["Projekt".into(), "Wichtig".into()]) },
        ],
        recipients: vec![
            vec![long(0x0C15, 1), text(0x3001, "Gina"), text(0x3003, "gina@example.com"), text(0x39FE, "gina@example.com")],
            vec![long(0x0C15, 2), text(0x3001, "Hans"), text(0x39FE, "hans@example.com")],
        ],
        attachments: vec![vec![
            long(0x3705, 1),
            text(0x3707, "notizen.txt"),
            text(0x3704, "notizen.txt"),
            text(0x370E, "text/plain"),
            Prop { id: 0x3701, value: Value::Binary(b"Notizen".to_vec()) },
        ]],
        messages: vec![(vec![long(0x3705, 5), text(0x3001, "Agenda")], agenda)],
    };
    build_msg(&memo, &[], &[Named::Name(2, "Keywords")])
}

#[test]
fn msg_outlook_item() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("memo.msg");
    fs::write(&path, memo_msg()).unwrap();

    let session = open(&path);
    let info = session.info().unwrap();
    assert_eq!(info.store.format, ArchiveFormat::Msg);
    let result = session.search(request("")).unwrap();
    let item = &result.items[0];
    assert_eq!(item.subject, "Protokoll Besprechung");
    assert_eq!(item.from_name, "Frank Fischer");
    assert_eq!(item.from_email, "frank@example.com");
    assert!(item.preview.contains("Ergebnisse der Besprechung"));
    assert_eq!(item.attachment_count, 2);

    let root = MessageRef { id: item.id, path: vec![] };
    let detail = session.message(root.clone()).unwrap();
    assert_eq!(
        detail.recipients,
        vec![
            Recipient { name: "Gina".into(), email: "gina@example.com".into(), kind: RecipientKind::To },
            Recipient { name: "Hans".into(), email: "hans@example.com".into(), kind: RecipientKind::Cc },
        ]
    );
    assert!(detail.html.as_deref().unwrap().contains("<b>Besprechung</b>"));
    assert_eq!(detail.categories, vec!["Projekt", "Wichtig"]);
    assert_eq!(
        detail.attachments.iter().map(|a| (a.name.as_str(), a.is_message, a.size)).collect::<Vec<_>>(),
        vec![("notizen.txt", false, 7), ("Agenda", true, 0)]
    );

    // Attached Outlook items open in place and are saved as .eml.
    let attached = session.message(MessageRef { id: item.id, path: vec![1] }).unwrap();
    assert_eq!(attached.subject, "Agenda");
    assert!(attached.text.contains("Punkte für Montag."));
    let agenda = session.attachment(root.clone(), 1).unwrap();
    assert_eq!(agenda.file_name, "Agenda.eml");
    assert_eq!(agenda.preview_kind, PreviewKind::Message);
    let parsed = mail_parser::MessageParser::default().parse(&agenda.data).unwrap();
    assert_eq!(parsed.subject(), Some("Agenda"));
    assert!(parsed.body_text(0).unwrap().contains("Punkte für Montag."));

    let notes = session.attachment(root.clone(), 0).unwrap();
    assert_eq!(notes.data, b"Notizen");
    assert_eq!(notes.preview_kind, PreviewKind::Text);

    // .eml export of an Outlook item.
    let eml = session.export_eml(root).unwrap();
    let parsed = mail_parser::MessageParser::default().parse(&eml).unwrap();
    assert_eq!(parsed.subject(), Some("Protokoll Besprechung"));
    assert_eq!(parsed.from().and_then(|f| f.first()).and_then(|a| a.address.as_deref()), Some("frank@example.com"));
    assert_eq!(parsed.cc().and_then(|c| c.first()).and_then(|a| a.address.as_deref()), Some("hans@example.com"));
    let names: Vec<_> =
        parsed.attachments().map(|a| mail_parser::MimeHeaders::attachment_name(a).unwrap_or_default().to_string()).collect();
    assert_eq!(names, vec!["notizen.txt", "Agenda.eml"]);
    let inner = parsed.attachments().nth(1).unwrap().message().expect("attached message is message/rfc822");
    assert_eq!(inner.subject(), Some("Agenda"));
}

#[test]
fn msg_appointment_with_named_properties() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("termin.msg");
    let item = MsgItem {
        props: vec![
            text(0x001A, "IPM.Appointment"),
            text(0x0037, "Jour fixe"),
            text(0x0C1A, "Anna"),
            time(0x8000, 1_744_020_000_000),
            time(0x8001, 1_744_023_600_000),
            text(0x8002, "Raum 4.12"),
        ],
        recipients: vec![],
        attachments: vec![],
        messages: vec![],
    };
    fs::write(&path, build_msg(&item, &[PSETID_APPOINTMENT], &[Named::Lid(3, 0x820D), Named::Lid(3, 0x820E), Named::Lid(3, 0x8208)]))
        .unwrap();

    let session = open(&path);
    let result = session.search(request("typ:termin")).unwrap();
    assert_eq!(result.total, 1);
    let detail = session.message(MessageRef { id: result.items[0].id, path: vec![] }).unwrap();
    assert_eq!(detail.kind, ItemKind::Appointment);
    let appointment = detail.appointment.unwrap();
    assert_eq!(appointment.start, Some(1_744_020_000_000));
    assert_eq!(appointment.end, Some(1_744_023_600_000));
    assert_eq!(appointment.location, "Raum 4.12");
}

#[test]
fn folders_of_mail_files() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().join("mails");
    fs::create_dir_all(root.join("Projekte")).unwrap();
    fs::create_dir_all(root.join("Export/Sent.mbox")).unwrap();
    fs::write(root.join("a.eml"), invoice_eml()).unwrap();
    fs::write(root.join("Projekte/b.eml"), build_eml(&Eml { subject: "B", text: Some("b"), ..Eml::default() })).unwrap();
    fs::write(root.join("Projekte/c.msg"), memo_msg()).unwrap();
    fs::write(root.join("Export/Sent.mbox/mbox"), takeout_mbox()).unwrap();
    fs::write(root.join("Export/Sent.mbox/table_of_contents"), [1u8, 2, 3]).unwrap();
    fs::write(root.join("notes.txt"), "not a mail").unwrap();

    let session = open(&root);
    let info = session.info().unwrap();
    assert_eq!(info.store.format, ArchiveFormat::Folder);
    assert_eq!(info.store.item_count, 6);
    assert_eq!(
        tree(&info),
        vec![
            "mails (1)",
            "  Export (0)",
            "    Posteingang [Inbox] (2)",
            "    Gesendet [Sent] (1)",
            "    Projekte (0)",
            "      Alpha (1)",
            "  Projekte (2)"
        ]
    );
    assert_eq!(session.search(request("anhang:notizen")).unwrap().total, 1);
}

#[test]
fn apple_mail_mailboxes() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().join("AppleMail");
    let inbox = root.join("INBOX.mbox/1A2B/Data/0/Messages");
    let projects = root.join("INBOX.mbox/Projekte.mbox/3C4D/Data/Messages");
    fs::create_dir_all(&inbox).unwrap();
    fs::create_dir_all(&projects).unwrap();
    fs::write(root.join("INBOX.mbox/Info.plist"), "<?xml version=\"1.0\"?><plist version=\"1.0\"><dict/></plist>").unwrap();
    let important =
        build_eml(&Eml { from: ("Hans", "hans@example.com"), subject: "Wichtig", text: Some("Bitte ansehen."), ..Eml::default() });
    fs::write(inbox.join("1.emlx"), build_emlx(&important, 0x10)).unwrap();
    fs::write(projects.join("2.partial.emlx"), build_emlx(&build_eml(&Eml { subject: "Plan", text: Some("p"), ..Eml::default() }), 0x01))
        .unwrap();

    let session = open(&root);
    let info = session.info().unwrap();
    assert_eq!(tree(&info), vec!["AppleMail (0)", "  INBOX [Inbox] (1)", "    Projekte (1)"]);
    let all = session.search(SearchRequest { sort: SortSpec { field: SortField::Subject, dir: SortDir::Asc }, ..request("") }).unwrap();
    assert_eq!(
        all.items.iter().map(|i| (i.subject.as_str(), i.is_read, i.flagged)).collect::<Vec<_>>(),
        vec![("Plan", true, false), ("Wichtig", false, true)]
    );
    let id = all.items[1].id;
    let detail = session.message(MessageRef { id, path: vec![] }).unwrap();
    assert!(detail.text.contains("Bitte ansehen.") && !detail.text.contains("plist"));
    // The .eml export is the message without the Apple Mail wrapper.
    assert_eq!(session.export_eml(MessageRef { id, path: vec![] }).unwrap(), important);
}

#[test]
fn rejects_unsupported_files() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("notes.txt");
    fs::write(&path, "not a mail").unwrap();
    let err = ArchiveSession::open(path.to_string_lossy().into_owned(), None, None).err().unwrap();
    assert!(matches!(err, CoreError::Unsupported { .. }), "{err:?}");
    let err = ArchiveSession::open(dir.path().join("missing.pst").to_string_lossy().into_owned(), None, None).err().unwrap();
    assert!(matches!(err, CoreError::NotFound { .. }), "{err:?}");
}

#[test]
fn cancels_opening() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("big.mbox");
    let message = build_eml(&Eml { subject: "x", text: Some("y"), ..Eml::default() });
    fs::write(&path, build_mbox(&vec![message; 200], false)).unwrap();
    let token = CancelToken::new();
    token.cancel();
    let err = ArchiveSession::open(path.to_string_lossy().into_owned(), None, Some(token)).err().unwrap();
    assert!(matches!(err, CoreError::Canceled), "{err:?}");
}

#[test]
fn snippets_and_highlights() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("long.eml");
    let body =
        format!("{} Der gesuchte Vertragsentwurf liegt bei. {}", "Lorem ipsum dolor sit amet. ".repeat(20), "Weitere Zeilen. ".repeat(20));
    fs::write(&path, build_eml(&Eml { subject: "Unterlagen", text: Some(&body), ..Eml::default() })).unwrap();
    let session = open(&path);
    let result = session.search(request("vertragsentwurf")).unwrap();
    assert_eq!(result.total, 1);
    let preview = &result.items[0].preview;
    assert!(preview.starts_with("… ") && preview.contains("Vertragsentwurf"), "{preview}");
    let ranges = find_matches(preview.clone(), result.highlight_terms.clone());
    assert_eq!(ranges.len(), 1);
}

#[test]
fn msg_written_by_sheetjs() {
    // SheetJS cfb leaves end-of-chain markers in the FAT beyond the end of the file.
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/sheetjs-besprechung.msg");
    let session = open(&path);
    let result = session.search(request("")).unwrap();
    assert_eq!(result.items[0].subject, "Protokoll Besprechung");
    let detail = session.message(MessageRef { id: result.items[0].id, path: vec![] }).unwrap();
    assert!(detail.html.as_deref().unwrap().contains("Budget freigegeben"));
}

#[test]
fn saves_attachments_and_messages_to_files() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("memo.msg");
    fs::write(&path, memo_msg()).unwrap();
    let session = open(&path);
    let id = session.search(request("")).unwrap().items[0].id;
    let root = MessageRef { id, path: vec![] };

    let detail = session.message(root.clone()).unwrap();
    assert_eq!(
        detail.attachments.iter().map(|a| (a.preview_kind, a.can_open)).collect::<Vec<_>>(),
        vec![(PreviewKind::Text, true), (PreviewKind::Message, true)]
    );
    assert_eq!(session.info().unwrap().store.unread_count, 0);

    let meta = session.attachment_meta(root.clone(), 1).unwrap();
    assert_eq!(meta.file_name, "Agenda.eml");
    let target = dir.path().join("agenda.eml");
    let saved = session.save_attachment(root.clone(), 1, target.to_string_lossy().into_owned()).unwrap();
    assert_eq!(saved.size as usize, fs::read(&target).unwrap().len());
    assert!(String::from_utf8_lossy(&fs::read(&target).unwrap()).contains("Subject: Agenda"));

    let eml = dir.path().join("memo.eml");
    let size = session.save_eml(root.clone(), eml.to_string_lossy().into_owned()).unwrap();
    assert_eq!(size as usize, fs::read(&eml).unwrap().len());

    // Android hands over descriptors of the documents the user created.
    #[cfg(unix)]
    {
        use std::os::fd::IntoRawFd;
        let target = dir.path().join("notes.txt");
        let fd = fs::File::create(&target).unwrap().into_raw_fd();
        let saved = session.save_attachment_fd(root.clone(), 0, fd).unwrap();
        assert_eq!(saved.size as usize, fs::read(&target).unwrap().len());
        let fd = fs::File::create(dir.path().join("missing")).unwrap().into_raw_fd();
        assert!(session.save_attachment_fd(root, 9, fd).is_err());
        assert!(session.save_eml_fd(MessageRef { id: 999, path: vec![] }, -1).is_err());
    }
}
