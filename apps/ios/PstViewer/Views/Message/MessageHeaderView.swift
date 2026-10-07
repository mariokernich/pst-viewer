import PstViewerCore
import SwiftUI

/// Badges, subject, sender, recipients and date of a message.
struct MessageHeaderView: View {
    let detail: MessageDetail
    let terms: [String]

    @Environment(MailboxModel.self) private var mailbox
    @ScaledMetric(relativeTo: .body) private var avatarSize: CGFloat = 42

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            badges
            Group {
                if detail.subject.isEmpty {
                    Text("(No subject)").italic().foregroundStyle(.secondary)
                } else {
                    Text(AttributedString(detail.subject, highlighting: terms))
                }
            }
            .font(.title2.bold())
            .textSelection(.enabled)
            .accessibilityAddTraits(.isHeader)

            if detail.kind != .appointment && detail.kind != .contact {
                HStack(alignment: .top, spacing: 12) {
                    AvatarView(name: detail.from.name, email: detail.from.email, size: avatarSize)
                    VStack(alignment: .leading, spacing: 5) {
                        sender
                        RecipientLine(label: String(localized: "To"), people: detail.recipients(.to), terms: terms)
                        RecipientLine(label: String(localized: "Cc"), people: detail.recipients(.cc), terms: terms)
                        RecipientLine(label: String(localized: "Bcc"), people: detail.recipients(.bcc), terms: terms)
                        if !detail.replyTo.isEmpty, detail.replyTo != detail.from.name {
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text("Reply to").foregroundStyle(.secondary)
                                Text(verbatim: detail.replyTo).textSelection(.enabled)
                            }
                            .font(.subheadline)
                        }
                        Text(verbatim: dateLine)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .padding(.top, 2)
                    }
                }
            }
        }
    }

    private var sender: some View {
        VStack(alignment: .leading, spacing: 2) {
            PersonMenu(name: detail.from.name, email: detail.from.email, terms: terms, isSender: true)
            if !detail.from.email.isEmpty, detail.from.email != detail.from.name, !detail.from.name.isEmpty {
                Text(AttributedString(detail.from.email, highlighting: terms))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .textSelection(.enabled)
            }
            if let sender = detail.sender {
                Text(verbatim: detail.onBehalfOfText(sender: sender))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var dateLine: String {
        var parts = [Formatting.fullDate(detail.date)]
        if detail.size > 0 { parts.append(Formatting.size(detail.size)) }
        return parts.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    @ViewBuilder private var badges: some View {
        let folder = mailbox.folderName(of: detail)
        let isAttached = !detail.messageRef.path.isEmpty
        if isAttached || detail.kind != .mail || folder != nil || detail.importance == .high || detail.flagged || detail.security != nil || !detail.categories.isEmpty {
            FlowLayout(spacing: 6, lineSpacing: 6) {
                if isAttached {
                    Badge(text: String(localized: "Attached message"), symbol: "paperclip")
                }
                if detail.kind != .mail {
                    Badge(text: detail.kind.label)
                }
                if let folder {
                    Badge(text: folder, symbol: "folder")
                }
                if detail.importance == .high {
                    Badge(text: String(localized: "Important"), symbol: "exclamationmark.triangle.fill", tint: .red)
                }
                if detail.flagged {
                    Badge(text: String(localized: "Flagged"), symbol: "flag.fill", tint: .orange)
                }
                switch detail.security {
                case .signed: Badge(text: String(localized: "Digitally signed"), symbol: "checkmark.seal.fill", tint: .green)
                case .encrypted: Badge(text: String(localized: "Encrypted"), symbol: "lock.fill")
                case nil: EmptyView()
                }
                ForEach(detail.categories, id: \.self) { category in
                    Badge(text: category, tint: .accentColor)
                }
            }
        }
    }
}

/// A small coloured label in the message header.
struct Badge: View {
    let text: String
    var symbol: String?
    var tint: Color?

    var body: some View {
        HStack(spacing: 4) {
            if let symbol {
                Image(systemName: symbol).imageScale(.small)
            }
            Text(verbatim: text).lineLimit(1)
        }
        .font(.caption.weight(.medium))
        .foregroundStyle(tint ?? .secondary)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background((tint ?? Color(.secondaryLabel)).opacity(0.13), in: .rect(cornerRadius: 6, style: .continuous))
    }
}

/// A person with shortcuts to search for their messages and to copy the address.
struct PersonMenu: View {
    let name: String
    let email: String
    let terms: [String]
    var isSender = false

    @Environment(MailboxModel.self) private var mailbox
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var label: String {
        name.isEmpty ? email : name
    }

    var body: some View {
        Menu {
            Section(People.displayAddress(name: name, email: email)) {
                Button("From \(label)", systemImage: "magnifyingglass") { search(from: true) }
                Button("To: \(label)", systemImage: "at") { search(from: false) }
            }
            if !email.isEmpty {
                Button("Copy", systemImage: "doc.on.doc") {
                    UIPasteboard.general.string = email
                    mailbox.toasts.show(String(localized: "Copied"))
                }
            }
        } label: {
            Group {
                if label.isEmpty {
                    Text("(Unknown sender)").italic()
                } else {
                    Text(AttributedString(label, highlighting: terms))
                }
            }
            .font(isSender ? .headline : .subheadline)
            .multilineTextAlignment(.leading)
        }
        .tint(.primary)
        .accessibilityHint(Text("Shows options to search for this person"))
    }

    /// Searches all folders for messages from or to this person.
    private func search(from: Bool) {
        let key = email.isEmpty ? name : email
        mailbox.query = ""
        mailbox.scope = .all
        mailbox.filters.from = from ? key : ""
        mailbox.filters.to = from ? "" : key
        // On the iPhone the results are one step back.
        if sizeClass == .compact { mailbox.selectedMessageID = nil }
    }
}

/// "To", "Cc" or "Bcc" with the first recipients and a button for the rest.
private struct RecipientLine: View {
    let label: String
    let people: [Recipient]
    let terms: [String]
    @State private var expanded = false

    private static let collapsedCount = 4

    var body: some View {
        if !people.isEmpty {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(verbatim: label)
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 26, alignment: .leading)
                FlowLayout(spacing: 4, lineSpacing: 2) {
                    let shown = expanded ? people : Array(people.prefix(Self.collapsedCount))
                    ForEach(Array(shown.enumerated()), id: \.offset) { index, person in
                        HStack(spacing: 0) {
                            PersonMenu(name: person.name, email: person.email, terms: terms)
                            if index < shown.count - 1 {
                                Text(verbatim: ",").foregroundStyle(.secondary)
                            }
                        }
                    }
                    if !expanded, people.count > Self.collapsedCount {
                        Button("+\(people.count - Self.collapsedCount) more") { expanded = true }
                            .fontWeight(.medium)
                    }
                    if expanded, people.count > Self.collapsedCount {
                        Button("Less") { expanded = false }
                            .fontWeight(.medium)
                    }
                }
            }
            .font(.subheadline)
        }
    }
}
