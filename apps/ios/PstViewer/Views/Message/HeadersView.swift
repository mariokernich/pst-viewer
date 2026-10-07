import SwiftUI

/// The internet headers of a message, selectable and copyable.
struct HeadersView: View {
    let headers: MessageHeaders
    @Environment(\.dismiss) private var dismiss
    @State private var copied = false

    var body: some View {
        NavigationStack {
            Group {
                if headers.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    ContentUnavailableView("No internet headers are stored for this message.", systemImage: "chevron.left.forwardslash.chevron.right")
                } else {
                    ScrollView([.vertical]) {
                        Text(verbatim: headers.text)
                            .font(.footnote.monospaced())
                            .textSelection(.enabled)
                            // Raw headers must not be hyphenated like German prose.
                            .environment(\.locale, Locale(identifier: "en_US_POSIX"))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(20)
                    }
                }
            }
            .navigationTitle("Internet Headers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                }
                if !headers.text.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button(copied ? LocalizedStringKey("Copied") : LocalizedStringKey("Copy"), systemImage: copied ? "checkmark" : "doc.on.doc") {
                            UIPasteboard.general.string = headers.text
                            copied = true
                        }
                    }
                }
            }
            .task(id: copied) {
                guard copied else { return }
                try? await Task.sleep(for: .seconds(1.5))
                copied = false
            }
        }
    }
}
