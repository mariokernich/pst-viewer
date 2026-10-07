import SwiftUI

/// The query language with German and English operators (see the desktop README).
struct SearchSyntaxView: View {
    @Environment(MailboxModel.self) private var mailbox
    @Environment(\.dismiss) private var dismiss
    @Environment(\.isPresented) private var isPresented

    private struct Example: Identifiable {
        let english: String
        let german: String
        let meaning: String

        var id: String { english }
    }

    private static let examples = [
        Example(english: "invoice 2024", german: "rechnung 2024", meaning: String(localized: "All terms must match")),
        Example(english: "\"kind regards\"", german: "\"sehr geehrte\"", meaning: String(localized: "Exact phrase")),
        Example(english: "offer OR quote", german: "angebot ODER offerte", meaning: String(localized: "Either term")),
        Example(english: "-newsletter", german: "-newsletter", meaning: String(localized: "Exclude a term")),
        Example(english: "from:anna", german: "von:anna", meaning: String(localized: "Sender (name or address)")),
        Example(english: "to:bob", german: "an:bob", meaning: String(localized: "Recipients (To, Cc, Bcc)")),
        Example(english: "subject:vacation", german: "betreff:urlaub", meaning: String(localized: "Subject only")),
        Example(english: "body:contract", german: "inhalt:vertrag", meaning: String(localized: "Message body only")),
        Example(english: "attachment:pdf", german: "anhang:pdf", meaning: String(localized: "Attachment name contains “pdf”")),
        Example(english: "has:attachment", german: "hat:anhang", meaning: String(localized: "Only messages with attachments")),
        Example(english: "is:unread", german: "ist:ungelesen", meaning: String(localized: "Unread (also: is:read, is:important, is:flagged, is:signed)")),
        Example(english: "after:2024-03-01 before:2024-06", german: "nach:1.3.2024 vor:2024-06", meaning: String(localized: "Date range (also: date:2023, until:2024-12-31)")),
        Example(english: "larger:5mb", german: "größer:5mb", meaning: String(localized: "Minimum size (also: smaller:100kb)")),
        Example(english: "type:appointment", german: "typ:termin", meaning: String(localized: "Item type: mail, appointment, contact, task, note")),
        Example(english: "folder:archive", german: "ordner:archiv", meaning: String(localized: "Only in folders with this name")),
    ]

    var body: some View {
        if isRoot {
            NavigationStack {
                list.toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                            .keyboardShortcut(.cancelAction)
                    }
                }
            }
        } else {
            list
        }
    }

    /// Presented on its own (from the menu) rather than pushed from the filters.
    private var isRoot: Bool {
        mailbox.showsSearchSyntax
    }

    private var list: some View {
        List {
            Section {
                Text("Combine search terms and operators freely. All terms must match. Case and accents are ignored.")
                Text("Tap an example to try it.")
                    .foregroundStyle(.secondary)
            }
            Section {
                ForEach(Self.examples) { example in
                    Button {
                        run(example)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(verbatim: primary(example))
                                .font(.body.monospaced())
                                .foregroundStyle(Color.accentColor)
                            if alias(example) != primary(example) {
                                Text(verbatim: alias(example))
                                    .font(.footnote.monospaced())
                                    .foregroundStyle(Color.secondary)
                            }
                            Text(verbatim: example.meaning)
                                .font(.subheadline)
                                .foregroundStyle(Color.primary)
                        }
                        .padding(.vertical, 2)
                    }
                    .accessibilityHint(Text("Searches with this example"))
                }
            } footer: {
                if MessageExport.language == "de" {
                    Text("English operators such as from:, to:, subject:, has:attachment, is:unread, before:, after: work as well.")
                } else {
                    Text("German operators such as von:, an:, betreff:, hat:anhang, ist:ungelesen, vor:, nach: work as well.")
                }
            }
        }
        .navigationTitle("Search Syntax")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func primary(_ example: Example) -> String {
        MessageExport.language == "de" ? example.german : example.english
    }

    private func alias(_ example: Example) -> String {
        MessageExport.language == "de" ? example.english : example.german
    }

    private func run(_ example: Example) {
        mailbox.query = primary(example)
        mailbox.commitQuery()
        mailbox.runSearch()
        mailbox.showsSearchSyntax = false
        mailbox.showsFilters = false
    }
}
