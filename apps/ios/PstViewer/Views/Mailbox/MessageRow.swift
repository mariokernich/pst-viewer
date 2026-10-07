import PstViewerCore
import SwiftUI

/// A message in the list: sender with avatar, date, subject, preview and status icons.
struct MessageRow: View {
    let summary: MessageSummary
    let terms: [String]
    /// The folder of the message, shown while searching.
    var folderName: String?
    /// Sent mail shows the recipients instead of the sender.
    var showsRecipients = false

    @ScaledMetric(relativeTo: .body) private var avatarSize: CGFloat = 38

    private var isUnread: Bool {
        !summary.isRead && (summary.kind == .mail || summary.kind == .meeting)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Circle()
                .fill(isUnread ? AnyShapeStyle(.tint) : AnyShapeStyle(.clear))
                .frame(width: 9, height: 9)
                .padding(.top, avatarSize / 2 - 4.5)
                .accessibilityLabel(Text("Unread"))
                .accessibilityHidden(!isUnread)
            if showsRecipients, !summary.toLine.isEmpty {
                AvatarView(name: summary.toLine, email: "", size: avatarSize)
            } else {
                AvatarView(name: summary.fromName, email: summary.fromEmail, size: avatarSize)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    person
                        .font(.body.weight(isUnread ? .bold : .semibold))
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(verbatim: Formatting.listDate(summary.date))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
                HStack(spacing: 4) {
                    if let symbol = summary.kind.symbolName {
                        Image(systemName: symbol)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .accessibilityLabel(Text(verbatim: summary.kind.label))
                    }
                    subject
                        .font(.subheadline.weight(isUnread ? .semibold : .regular))
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    if let folderName {
                        Text(verbatim: folderName)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 4))
                            .frame(maxWidth: 110, alignment: .trailing)
                    }
                    StatusIcons(summary: summary)
                }
                Text(AttributedString(summary.preview, highlighting: terms))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var person: some View {
        if showsRecipients, !summary.toLine.isEmpty {
            Text("To:").foregroundStyle(.secondary) + Text(verbatim: " ") + Text(AttributedString(summary.toLine, highlighting: terms))
        } else if summary.fromName.isEmpty && summary.fromEmail.isEmpty {
            Text("(Unknown sender)").italic().foregroundStyle(.secondary)
        } else {
            Text(AttributedString(summary.fromName.isEmpty ? summary.fromEmail : summary.fromName, highlighting: terms))
        }
    }

    @ViewBuilder private var subject: some View {
        if summary.subject.isEmpty {
            Text("(No subject)").italic().foregroundStyle(.secondary)
        } else {
            Text(AttributedString(summary.subject, highlighting: terms))
        }
    }

    /// A row shown while its page is loading.
    static var placeholder: some View {
        MessageRow(
            summary: MessageSummary(
                id: 0, folderId: 0, kind: .mail, messageClass: "", subject: "Loading the subject of the message",
                fromName: "Sender Name", fromEmail: "", toLine: "", date: 0, size: 0, attachmentCount: 0,
                isRead: true, importance: .normal, flagged: false, security: nil,
                preview: "Loading the first lines of the message body to show a preview in the list"
            ),
            terms: []
        )
        .redacted(reason: .placeholder)
        .accessibilityHidden(true)
    }
}

/// Importance, flag, signature and attachment icons.
private struct StatusIcons: View {
    let summary: MessageSummary

    var body: some View {
        HStack(spacing: 3) {
            if summary.importance == .high {
                icon("exclamationmark.triangle.fill", .red, String(localized: "Important"))
            }
            if summary.flagged {
                icon("flag.fill", .orange, String(localized: "Flagged"))
            }
            switch summary.security {
            case .signed: icon("checkmark.seal", .secondary, String(localized: "Digitally signed"))
            case .encrypted: icon("lock", .secondary, String(localized: "Encrypted"))
            case nil: EmptyView()
            }
            if summary.attachmentCount > 0 {
                icon("paperclip", .secondary, String(localized: "\(Int(summary.attachmentCount)) attachments"))
            }
        }
        .font(.caption)
    }

    private func icon(_ name: String, _ style: some ShapeStyle, _ label: String) -> some View {
        Image(systemName: name)
            .foregroundStyle(style)
            .accessibilityLabel(Text(verbatim: label))
    }
}
