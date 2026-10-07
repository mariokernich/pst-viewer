import PstViewerCore
import SwiftUI

/// The attachments of a message: tap to preview, long press for more.
struct AttachmentStrip: View {
    let detail: MessageDetail
    let open: (AttachmentInfo) -> Void

    @Environment(MailboxModel.self) private var mailbox
    @State private var saving: [AttachmentTransfer] = []

    var body: some View {
        let files = detail.fileAttachments
        if !files.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("\(files.count) attachments")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    if files.count > 1 {
                        Button("Save All", systemImage: "square.and.arrow.down") { save(files) }
                            .font(.footnote.weight(.medium))
                    }
                }
                .padding(.horizontal, 20)
                FlowLayout(spacing: 8, lineSpacing: 8) {
                    ForEach(files, id: \.index) { attachment in
                        AttachmentCard(attachment: attachment, open: { open(attachment) }) {
                            attachmentMenu(attachment, all: files)
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
            .modifier(SaveFiles(items: $saving))
        }
    }

    @ViewBuilder private func attachmentMenu(_ attachment: AttachmentInfo, all: [AttachmentInfo]) -> some View {
        if attachment.isMessage {
            Button("Open Message", systemImage: "envelope.open") { open(attachment) }
        } else {
            Button("Preview", systemImage: "eye") { open(attachment) }
        }
        if attachment.canOpen {
            ShareLink(item: mailbox.transfer(of: attachment, in: detail.messageRef), preview: SharePreview(attachment.name)) {
                Label("Share…", systemImage: "square.and.arrow.up")
            }
        }
        Button("Save As…", systemImage: "square.and.arrow.down") { save([attachment]) }
        if all.count > 1 {
            Button("Save All", systemImage: "square.and.arrow.down.on.square") { save(all) }
        }
    }

    private func save(_ attachments: [AttachmentInfo]) {
        saving = attachments.map { mailbox.transfer(of: $0, in: detail.messageRef) }
    }
}

/// An attachment with its type badge, name and size.
private struct AttachmentCard<MenuContent: View>: View {
    let attachment: AttachmentInfo
    let open: () -> Void
    @ViewBuilder let menu: MenuContent

    var body: some View {
        Button(action: open) {
            HStack(spacing: 10) {
                FileBadge(name: attachment.name, isMessage: attachment.isMessage)
                VStack(alignment: .leading, spacing: 1) {
                    Text(verbatim: attachment.name)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Group {
                        if attachment.isMessage {
                            Text("Attached message")
                        } else {
                            Text(verbatim: Formatting.size(attachment.size))
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
            .padding(8)
            .padding(.trailing, 6)
            .frame(minWidth: 150, maxWidth: 250, alignment: .leading)
            .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12, style: .continuous))
            .contentShape(.rect(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .contextMenu { menu }
        .accessibilityHint(attachment.isMessage ? Text("Opens the attached message") : Text("Shows a preview"))
    }
}

/// Saves attachments to a folder the user picks in Files.
struct SaveFiles: ViewModifier {
    @Binding var items: [AttachmentTransfer]
    @Environment(MailboxModel.self) private var mailbox

    func body(content: Content) -> some View {
        content.fileExporter(isPresented: isPresented, items: items, contentTypes: [.data]) { result in
            switch result {
            case let .success(urls):
                mailbox.toasts.show(urls.count > 1 ? String(localized: "\(urls.count) files saved") : String(localized: "Saved"))
            case .failure:
                mailbox.toasts.show(String(localized: "Saving failed"), style: .failure)
            }
            items = []
        } onCancellation: {
            items = []
        }
    }

    private var isPresented: Binding<Bool> {
        Binding { !items.isEmpty } set: { if !$0 { items = [] } }
    }
}
