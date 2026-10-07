import PstViewerCore
import SwiftUI

/// The detail column: the selected message, attached messages pushed on top.
struct ReaderView: View {
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        @Bindable var mailbox = mailbox
        NavigationStack(path: $mailbox.readerPath) {
            Group {
                if let id = mailbox.selectedMessageID {
                    let ref = MessageRef(id: id, path: [])
                    MessageScreen(ref: ref, terms: mailbox.highlightTerms, cached: mailbox.cachedDetail(for: ref))
                        .id(id)
                } else {
                    NoSelectionView()
                }
            }
            .navigationDestination(for: MessageRef.self) { ref in
                MessageScreen(ref: ref, terms: [], cached: mailbox.cachedDetail(for: ref))
            }
        }
    }
}

/// Shown in the reading column while no message is selected.
private struct NoSelectionView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        ContentUnavailableView {
            Label("No message selected", systemImage: "envelope.open")
        } description: {
            Text("Select a message from the list to read it here.")
        } actions: {
            if sizeClass == .regular {
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                    shortcut("↑ ↓", String(localized: "Previous message") + " / " + String(localized: "Next message"))
                    shortcut("⌘ F", String(localized: "Search"))
                    shortcut("⌥ ⌘ F", String(localized: "Filters"))
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
        }
    }

    private func shortcut(_ keys: String, _ action: String) -> some View {
        GridRow {
            Text(verbatim: keys)
                .font(.footnote.monospaced())
                .gridColumnAlignment(.trailing)
            Text(verbatim: action)
        }
    }
}
