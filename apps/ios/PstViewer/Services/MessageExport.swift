import Foundation
import PstViewerCore

/// The documents for exporting and printing a single message. Labels and
/// values are localised here; the core builds the sanitised documents
/// (port of `lib/exportDocument.ts`).
struct MessageExport {
    let detail: MessageDetail
    let folderName: String?
    let allowRemote: Bool

    var subject: String {
        detail.subject.isEmpty ? String(localized: "(No subject)") : detail.subject
    }

    /// Suggested file name without extension, e.g. "2026-01-26 Quarterly report".
    var baseName: String {
        exportBaseName(subject: detail.subject, date: detail.date, noSubject: String(localized: "(No subject)"))
    }

    /// A self-contained HTML document for PDF export and printing.
    var printDocument: String {
        buildPrintDocument(input: PrintInput(
            lang: Self.language,
            subject: subject,
            rows: headerRows,
            html: detail.html,
            text: detail.text,
            inlineImages: detail.inlineImages,
            allowRemote: allowRemote
        ))
    }

    var text: String {
        buildExportText(subjectLabel: String(localized: "Subject"), subject: subject, rows: headerRows, text: detail.text)
    }

    /// The language of the UI, used for the exported documents.
    static var language: String {
        Bundle.main.preferredLocalizations.first.map { $0.hasPrefix("de") ? "de" : "en" } ?? "en"
    }

    var headerRows: [HeaderRow] {
        var rows: [HeaderRow] = []
        func add(_ label: String, _ value: String?) {
            guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return }
            rows.append(HeaderRow(label: label, value: value))
        }
        if detail.kind == .contact {
            for field in detail.contact ?? [] {
                add(field.label, field.displayValue)
            }
            return rows
        }
        if let appointment = detail.appointment {
            if appointment.start != nil {
                add(String(localized: "When"), Formatting.range(start: appointment.start, end: appointment.end, allDay: appointment.isAllDay))
            }
            add(String(localized: "Where"), appointment.location)
            if appointment.isRecurring {
                add(String(localized: "Recurring"), appointment.recurrence.isEmpty ? "—" : appointment.recurrence)
            }
            add(String(localized: "Attendees"), appointment.attendees)
        }
        if detail.kind != .appointment {
            add(String(localized: "From"), People.displayAddress(name: detail.from.name, email: detail.from.email))
            if let sender = detail.sender {
                add("", detail.onBehalfOfText(sender: sender))
            }
            add(String(localized: "To"), detail.recipientList(.to))
            add(String(localized: "Cc"), detail.recipientList(.cc))
            add(String(localized: "Bcc"), detail.recipientList(.bcc))
            add(String(localized: "Reply to"), detail.replyTo)
            add(String(localized: "Date"), Formatting.fullDate(detail.date))
        }
        if let task = detail.task {
            add(String(localized: "Status"), task.statusLabel)
            add(String(localized: "Due"), Formatting.date(task.dueDate))
        }
        if detail.kind != .mail {
            add(String(localized: "Type"), detail.kind.label)
        }
        add(String(localized: "Folder"), folderName)
        let files = detail.attachments.filter { !$0.isInline }
        add(String(localized: "Attachments"), files.map { $0.isMessage ? $0.name : "\($0.name) (\(Formatting.size($0.size)))" }.joined(separator: ", "))
        return rows
    }
}

extension MessageDetail {
    func recipients(_ kind: RecipientKind) -> [Recipient] {
        recipients.filter { $0.kind == kind }
    }

    func recipientList(_ kind: RecipientKind) -> String {
        recipients(kind).map { People.displayAddress(name: $0.name, email: $0.email) }.joined(separator: ", ")
    }

    func onBehalfOfText(sender: Mailbox) -> String {
        let senderName = sender.name.isEmpty ? sender.email : sender.name
        let fromName = from.name.isEmpty ? from.email : from.name
        return String(localized: "\(senderName) on behalf of \(fromName)")
    }

    /// Calendar items and drafts often carry an empty HTML skeleton.
    var hasHTMLContent: Bool {
        guard let html else { return false }
        return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || html.range(of: "<img", options: .caseInsensitive) != nil
    }

    /// Visible attachments (not inline images).
    var fileAttachments: [AttachmentInfo] {
        attachments.filter { !$0.isInline }
    }
}
