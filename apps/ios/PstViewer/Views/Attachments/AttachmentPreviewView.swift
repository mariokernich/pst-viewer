import PstViewerCore
import QuickLook
import SwiftUI

/// Quick Look for documents, images and media; cards for calendars and
/// contacts; tables for CSV; sanitised HTML. File types that can run code
/// are only offered for saving.
struct AttachmentPreviewView: View {
    let model: AttachmentPreviewModel

    @Environment(MailboxModel.self) private var mailbox
    @Environment(\.dismiss) private var dismiss
    @State private var saving: [AttachmentTransfer] = []

    var body: some View {
        NavigationStack {
            content
                // Every attachment gets fresh views (and their state).
                .id(model.position)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.secondarySystemBackground))
                .navigationTitle(Text(verbatim: model.current.name))
                .navigationBarTitleDisplayMode(.inline)
                .modifier(SizeSubtitle(size: model.current.size))
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close") { dismiss() }
                            .keyboardShortcut(.cancelAction)
                    }
                    ToolbarItem(placement: .primaryAction) {
                        actions
                    }
                    if model.attachments.count > 1 {
                        ToolbarItemGroup(placement: .bottomBar) {
                            Button("Previous attachment", systemImage: "chevron.left") { model.step(by: -1) }
                                .keyboardShortcut(.leftArrow, modifiers: [])
                            Spacer()
                            Text("\(model.position + 1) of \(model.attachments.count)")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                            Spacer()
                            Button("Next attachment", systemImage: "chevron.right") { model.step(by: 1) }
                                .keyboardShortcut(.rightArrow, modifiers: [])
                        }
                    }
                }
        }
        .modifier(SaveFiles(items: $saving))
        .modifier(PageSizedSheet())
        // The window's toasts are hidden behind the sheet.
        .overlay(alignment: .bottom) { ToastView(toasts: mailbox.toasts) }
        .onAppear { model.load() }
        .onDisappear { model.close() }
    }

    @ViewBuilder private var content: some View {
        switch model.state {
        case .loading:
            DelayedProgressView(label: String(localized: "Loading preview…"))
        case let .failed(message):
            ContentUnavailableView {
                Label("The preview could not be loaded.", systemImage: "exclamationmark.triangle")
            } description: {
                Text(verbatim: message)
            }
        case let .loaded(loaded):
            if loaded.isBlocked {
                BlockedFileView(file: loaded.file) { save() }
            } else if let url = loaded.quickLookURL {
                QuickLookView(url: url)
                    .ignoresSafeArea(edges: .bottom)
            } else {
                switch loaded.file.previewKind {
                case .calendar:
                    CalendarPreview(data: loaded.file.data)
                case .contact:
                    ContactPreview(data: loaded.file.data)
                case .csv:
                    CSVPreview(data: loaded.file.data)
                case .html:
                    HTMLAttachmentPreview(data: loaded.file.data)
                default:
                    NoPreviewView(file: loaded.file, transfer: transfer) { save() }
                }
            }
        }
    }

    private var actions: some View {
        Menu {
            // Files that could run code are not handed to other apps.
            if case let .loaded(loaded) = model.state, loaded.file.canOpen {
                ShareLink(item: transfer, preview: SharePreview(model.current.name)) {
                    Label("Share…", systemImage: "square.and.arrow.up")
                }
            }
            Button("Save As…", systemImage: "square.and.arrow.down") { save() }
            if model.attachments.count > 1 {
                Button("Save All", systemImage: "square.and.arrow.down.on.square") {
                    saving = model.attachments.map { mailbox.transfer(of: $0, in: model.ref) }
                }
            }
        } label: {
            Label("Share", systemImage: "square.and.arrow.up")
        }
    }

    private var transfer: AttachmentTransfer {
        mailbox.transfer(of: model.current, in: model.ref)
    }

    private func save() {
        saving = [transfer]
    }
}

/// Documents get a large sheet on the iPad (iOS 18 and later).
private struct PageSizedSheet: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.presentationSizing(.page)
        } else {
            content
        }
    }
}

/// Shows the file size below the title (iOS 26 and later).
private struct SizeSubtitle: ViewModifier {
    let size: Int64

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.navigationSubtitle(Text(verbatim: Formatting.size(size)))
        } else {
            content
        }
    }
}

/// Quick Look embedded in the preview; editing (markup) is disabled.
struct QuickLookView: UIViewControllerRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator(url: url)
    }

    func makeUIViewController(context: Context) -> QLPreviewController {
        let controller = QLPreviewController()
        controller.dataSource = context.coordinator
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: QLPreviewController, context: Context) {
        guard context.coordinator.url != url else { return }
        context.coordinator.url = url
        controller.reloadData()
    }

    final class Coordinator: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
        var url: URL

        init(url: URL) {
            self.url = url
        }

        func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
            1
        }

        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> any QLPreviewItem {
            url as NSURL
        }

        func previewController(_ controller: QLPreviewController, editingModeFor previewItem: any QLPreviewItem) -> QLPreviewItemEditingMode {
            .disabled
        }
    }
}

/// A file type that could run code: it can be saved, but is never opened.
private struct BlockedFileView: View {
    let file: AttachmentFile
    let save: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                FileBadge(name: file.fileName, size: 1.8)
                    .padding(.top, 40)
                VStack(spacing: 4) {
                    Text(verbatim: file.fileName)
                        .font(.headline)
                        .multilineTextAlignment(.center)
                    Text(verbatim: "\(Formatting.size(Int64(file.data.count))) · \(file.mimeType)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Label("This file type can run programs and is therefore not opened directly. Only save the file if you trust the sender.", systemImage: "exclamationmark.shield")
                    .font(.subheadline)
                    .padding(14)
                    .frame(maxWidth: 460, alignment: .leading)
                    .background(Color.orange.opacity(0.12), in: .rect(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.orange.opacity(0.35)))
                Button("Save As…", systemImage: "square.and.arrow.down", action: save)
                    .buttonStyle(.bordered)
            }
            .padding(24)
            .frame(maxWidth: .infinity)
        }
    }
}

/// A file Quick Look cannot show: share it with a matching app or save it.
private struct NoPreviewView: View {
    let file: AttachmentFile
    let transfer: AttachmentTransfer
    let save: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                FileBadge(name: file.fileName, size: 1.8)
                    .padding(.top, 40)
                VStack(spacing: 4) {
                    Text(verbatim: file.fileName)
                        .font(.headline)
                        .multilineTextAlignment(.center)
                    Text(verbatim: "\(Formatting.size(Int64(file.data.count))) · \(file.mimeType)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Text("No preview for this file type")
                    .font(.subheadline.weight(.semibold))
                Text("Share the file with a matching app or save it to Files.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
                HStack(spacing: 10) {
                    ShareLink(item: transfer, preview: SharePreview(file.fileName)) {
                        Label("Share…", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.borderedProminent)
                    Button("Save As…", systemImage: "square.and.arrow.down", action: save)
                        .buttonStyle(.bordered)
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity)
        }
    }
}
