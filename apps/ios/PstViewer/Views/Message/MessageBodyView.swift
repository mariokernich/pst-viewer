import PstViewerCore
import SwiftUI
import WebKit

/// How a message with both an HTML and a text body is shown.
enum BodyMode: Hashable {
    case html
    case text
}

/// The body of a message: sanitised HTML on paper, plain text, or a note
/// that the message is empty. Remote images stay blocked until allowed.
struct MessageBodyView: View {
    let detail: MessageDetail
    let mode: BodyMode
    let terms: [String]

    @Environment(MailboxModel.self) private var mailbox
    @State private var document: MailDocument?
    @State private var blocker: WKContentRuleList?
    @State private var height: CGFloat = 1

    private struct DocumentKey: Hashable {
        let ref: MessageRef
        let showsHTML: Bool
        let allowsRemote: Bool
    }

    var body: some View {
        Group {
            if showsHTML || hasText {
                VStack(alignment: .leading, spacing: 12) {
                    if let document, document.hasRemote, !allowsRemote {
                        RemoteImagesBanner {
                            mailbox.allowRemoteImages(for: detail.messageRef)
                        }
                    }
                    if let document, allowsRemote || blocker != nil {
                        MailWebView(
                            html: document.html,
                            blocker: allowsRemote ? nil : blocker,
                            terms: terms,
                            isTransparent: !showsHTML,
                            contentHeight: $height
                        )
                        .frame(height: max(height, 1))
                        .modifier(PaperStyle(isPaper: showsHTML))
                        .accessibilityLabel(showsHTML ? Text("Message content") : Text("Message text"))
                    } else {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 120)
                    }
                }
            } else if detail.kind == .mail || detail.kind == .meeting {
                Text("This message has no content.")
                    .italic()
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
            }
        }
        .task {
            blocker = try? await WebContent.networkBlocker()
        }
        .task(id: DocumentKey(ref: detail.messageRef, showsHTML: showsHTML, allowsRemote: allowsRemote)) {
            document = await prepare()
        }
    }

    private var allowsRemote: Bool {
        mailbox.remoteAllowed.contains(detail.messageRef)
    }

    private var showsHTML: Bool {
        detail.hasHTMLContent && mode == .html
    }

    private var hasText: Bool {
        !detail.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Sanitising large mails takes a moment, so it runs off the main thread.
    private func prepare() async -> MailDocument {
        let html = showsHTML ? detail.html : nil
        let text = detail.text
        let images = detail.inlineImages
        let remote = allowsRemote
        return await Task.detached(priority: .userInitiated) {
            if let html {
                return prepareMailDocument(html: html, inlineImages: images, allowRemote: remote, extraCss: MailStyle.css(forText: false))
            }
            return prepareTextDocument(text: text, extraCss: MailStyle.css(forText: true))
        }.value
    }
}

/// HTML mails are shown on white paper, also in dark mode (as on the desktop).
private struct PaperStyle: ViewModifier {
    let isPaper: Bool

    func body(content: Content) -> some View {
        if isPaper {
            content
                .clipShape(.rect(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(.separator).opacity(0.6), lineWidth: 0.5))
                .padding(.horizontal, 12)
        } else {
            content
        }
    }
}

/// Offers to load the remote images of this message.
private struct RemoteImagesBanner: View {
    let allow: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "photo.badge.exclamationmark")
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text("Remote images were blocked to protect your privacy.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("Load Images", action: allow)
                .buttonStyle(.bordered)
                .controlSize(.small)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12, style: .continuous))
        .padding(.horizontal, 12)
    }
}
