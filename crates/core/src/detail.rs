//! The reading pane's view of a message (port of `getMessageDetail`,
//! `msgDetail` and `mimeDetail` in `worker/details.ts`).

use std::collections::{HashMap, HashSet};

use base64::Engine;

use crate::content::{ContentAttachment, MessageContent, Resolved};
use crate::html::referenced_content_ids;
use crate::index::{IndexedItem, importance_from_value, kind_of};
use crate::mapi::tag;
use crate::model::{AttachmentInfo, BodyFormat, ItemKind, MessageDetail, MessageRef};
use crate::text::squash;

const MAX_INLINE_IMAGE_BYTES: i64 = 15 * 1024 * 1024;
const MAX_INLINE_TOTAL_BYTES: i64 = 60 * 1024 * 1024;

/// `indexed` is the list entry of a top-level item (None for attached messages).
pub(crate) fn message_detail(message: &Resolved, message_ref: MessageRef, indexed: Option<&IndexedItem>) -> MessageDetail {
    let (body_format, html, text, attachments, inline_images) = body_and_attachments(message.content());
    match message {
        Resolved::Mapi(m) => {
            let item = m.item();
            let class = item.message_class();
            let kind = kind_of(&class);
            let sent = item.sent_date();
            let received = item.received_date();
            MessageDetail {
                message_ref,
                folder_id: indexed.map(|i| i.folder_id),
                kind,
                message_class: class,
                subject: item.subject(),
                from: item.sender(),
                sender: item.actual_sender(),
                reply_to: squash(&m.props.string(tag::REPLY_RECIPIENT_NAMES)),
                recipients: m.recipients.clone(),
                date: indexed.map(|i| i.date).filter(|d| *d > 0).or(received).or(sent).unwrap_or(0),
                sent_date: sent,
                received_date: received,
                size: item.size(),
                importance: importance_from_value(item.importance()),
                is_read: item.is_read(),
                flagged: item.flagged(),
                categories: item.categories(),
                body_format,
                html,
                text,
                attachments,
                inline_images,
                headers: item.headers(),
                security: m.content.security,
                appointment: matches!(kind, ItemKind::Appointment | ItemKind::Meeting).then(|| item.appointment()),
                contact: (kind == ItemKind::Contact).then(|| item.contact()),
                task: (kind == ItemKind::Task).then(|| item.task()),
            }
        }
        Resolved::Mime(m) => MessageDetail {
            message_ref,
            folder_id: indexed.map(|i| i.folder_id),
            kind: ItemKind::Mail,
            message_class: "IPM.Note".into(),
            subject: m.subject.clone(),
            from: m.from.clone(),
            sender: m.sender.clone(),
            reply_to: m
                .reply_to
                .iter()
                .map(|r| if r.email.is_empty() { r.name.as_str() } else { r.email.as_str() })
                .collect::<Vec<_>>()
                .join("; "),
            recipients: m.recipients.clone(),
            date: m.date,
            sent_date: (m.date > 0).then_some(m.date),
            received_date: None,
            size: m.raw.len() as i64,
            importance: importance_from_value(m.importance),
            // Read and flag state of MBOX entries come from the list.
            is_read: indexed.is_none_or(|i| i.is_read),
            flagged: indexed.is_some_and(|i| i.flagged),
            categories: Vec::new(),
            body_format,
            html,
            text,
            attachments,
            inline_images,
            headers: m.headers.clone(),
            security: m.content.security,
            appointment: None,
            contact: None,
            task: None,
        },
    }
}

type BodyParts = (BodyFormat, Option<String>, String, Vec<AttachmentInfo>, HashMap<String, String>);

fn body_and_attachments(content: &MessageContent) -> BodyParts {
    let cids = referenced_content_ids(content.html.as_deref());
    let attachments = content
        .attachments
        .iter()
        .enumerate()
        .map(|(i, a)| AttachmentInfo {
            index: i as u32,
            name: a.name.clone(),
            size: a.size,
            mime_type: a.mime_type.clone(),
            is_inline: a.hidden || (!a.content_id.is_empty() && cids.contains(&a.content_id)),
            is_message: a.is_message,
        })
        .collect();
    let format = if content.html.is_some() {
        BodyFormat::Html
    } else if !content.text.is_empty() {
        BodyFormat::Text
    } else {
        BodyFormat::None
    };
    (format, content.html.clone(), content.text.clone(), attachments, inline_images(&content.attachments, &cids))
}

pub(crate) fn sniff_image_type(data: &[u8]) -> Option<&'static str> {
    if data.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png")
    } else if data.starts_with(&[0xFF, 0xD8]) {
        Some("image/jpeg")
    } else if data.starts_with(b"GIF") {
        Some("image/gif")
    } else if data.starts_with(b"BM") {
        Some("image/bmp")
    } else if data.len() >= 12 && &data[..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

/// Resolves `cid:` references of the HTML body to data URLs.
fn inline_images(attachments: &[ContentAttachment], cids: &HashSet<String>) -> HashMap<String, String> {
    let mut result = HashMap::new();
    let mut budget = MAX_INLINE_TOTAL_BYTES;
    for cid in cids {
        let found = attachments.iter().find(|a| &a.content_id == cid).or_else(|| {
            // Some mailers reference images by file name instead of Content-ID.
            attachments.iter().find(|a| {
                let name = a.name.to_lowercase();
                &name == cid || cid.starts_with(&format!("{name}@"))
            })
        });
        let Some(att) = found else { continue };
        if att.is_message || att.size > MAX_INLINE_IMAGE_BYTES || att.size > budget {
            continue;
        }
        let Ok(data) = att.read() else { continue };
        if data.is_empty() || data.len() as i64 > budget {
            continue;
        }
        let declared = att.mime_type.starts_with("image/").then_some(att.mime_type.as_str());
        let Some(mime) = sniff_image_type(&data).or(declared) else { continue };
        if mime == "image/svg+xml" {
            continue;
        }
        budget -= data.len() as i64;
        result.insert(cid.clone(), format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(&data)));
    }
    result
}
