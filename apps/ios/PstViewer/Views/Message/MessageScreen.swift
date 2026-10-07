import PstViewerCore
import SwiftUI

/// A message with header, cards, attachments and body, plus its toolbar.
struct MessageScreen: View {
    let ref: MessageRef
    let terms: [String]

    @Environment(MailboxModel.self) private var mailbox
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var phase: Phase
    @State private var bodyMode = BodyMode.html

    private enum Phase {
        case loading
        case loaded(MessageDetail)
        case failed
    }

    init(ref: MessageRef, terms: [String], cached: MessageDetail?) {
        self.ref = ref
        self.terms = terms
        _phase = State(initialValue: cached.map(Phase.loaded) ?? .loading)
    }

    var body: some View {
        Group {
            switch phase {
            case .loading:
                DelayedProgressView(label: String(localized: "Loading message…"))
            case .failed:
                ContentUnavailableView {
                    Label("The message could not be loaded.", systemImage: "exclamationmark.circle")
                } actions: {
                    Button("Try Again") {
                        phase = .loading
                        Task { await load() }
                    }
                }
            case let .loaded(detail):
                content(detail)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if ref.path.isEmpty {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Previous message", systemImage: "chevron.up") { mailbox.moveSelection(by: -1) }
                        .disabled(!mailbox.canSelectPrevious)
                    Button("Next message", systemImage: "chevron.down") { mailbox.moveSelection(by: 1) }
                        .disabled(!mailbox.canSelectNext)
                }
            }
            if case let .loaded(detail) = phase {
                ToolbarItemGroup(placement: sizeClass == .compact ? .bottomBar : .topBarTrailing) {
                    if detail.hasHTMLContent, !detail.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Picker("View", selection: $bodyMode) {
                            Text("HTML").tag(BodyMode.html)
                            Text("Text").tag(BodyMode.text)
                        }
                        .pickerStyle(.segmented)
                        .fixedSize()
                    }
                    if sizeClass == .compact { Spacer() }
                    Button("Headers", systemImage: "chevron.left.forwardslash.chevron.right") {
                        mailbox.presentedHeaders = MessageHeaders(id: detail.messageRef, text: detail.headers)
                    }
                    ExportMenu(detail: detail)
                }
            }
        }
        .task(id: ref) {
            await load()
        }
        #if DEBUG
        .onAppear { if DemoDriver.showsTextBody { bodyMode = .text } }
        .onChange(of: mailbox.demoAttachment) {
            guard let index = mailbox.demoAttachment, case let .loaded(detail) = phase else { return }
            let files = detail.fileAttachments.filter { !$0.isMessage }
            if index < files.count { open(files[index], of: detail) }
        }
        #endif
    }

    private func content(_ detail: MessageDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                MessageHeaderView(detail: detail, terms: terms)
                    .padding(.horizontal, 20)
                MessageCards(detail: detail)
                    .padding(.horizontal, 16)
                AttachmentStrip(detail: detail, open: { open($0, of: detail) })
                MessageBodyView(detail: detail, mode: bodyMode, terms: terms)
            }
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .onAppear { mailbox.displayedDetail = detail }
    }

    private func load() async {
        if case let .loaded(detail) = phase, detail.messageRef == ref {
            mailbox.displayedDetail = detail
            return
        }
        do {
            let detail = try await mailbox.detail(for: ref)
            phase = .loaded(detail)
            mailbox.displayedDetail = detail
        } catch is CancellationError {
            return
        } catch {
            phase = .failed
        }
    }

    /// Attached messages open in a nested reading view, files in the preview.
    private func open(_ attachment: AttachmentInfo, of detail: MessageDetail) {
        if attachment.isMessage {
            mailbox.readerPath.append(MessageRef(id: ref.id, path: ref.path + [attachment.index]))
            return
        }
        let files = detail.fileAttachments.filter { !$0.isMessage }
        mailbox.attachmentPreview = AttachmentPreviewModel(
            connection: mailbox.connection,
            ref: ref,
            attachments: files,
            position: files.firstIndex(of: attachment) ?? 0
        )
    }
}

/// Export and print actions for a message.
struct ExportMenu: View {
    let detail: MessageDetail
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        Menu {
            exportLink(.pdf, String(localized: "Export as PDF…"), symbol: "doc.richtext")
            exportLink(.eml, String(localized: "Export as Email File (.eml)…"), symbol: "envelope")
            exportLink(.text, String(localized: "Export as Text…"), symbol: "doc.plaintext")
            Divider()
            Button("Print…", systemImage: "printer") { mailbox.print(detail) }
        } label: {
            Label("Export", systemImage: "square.and.arrow.up")
        }
    }

    private func exportLink(_ format: MessageTransfer.Format, _ title: String, symbol: String) -> some View {
        let transfer = mailbox.transfer(detail, as: format)
        return ShareLink(item: transfer, preview: SharePreview(transfer.fileName, image: Image(systemName: symbol))) {
            Label(title, systemImage: symbol)
        }
    }
}

/// A spinner that only appears if loading takes a moment, to avoid flicker.
struct DelayedProgressView: View {
    let label: String
    @State private var visible = false

    var body: some View {
        ProgressView(label)
            .opacity(visible ? 1 : 0)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .task {
                try? await Task.sleep(for: .milliseconds(150))
                visible = true
            }
    }
}
