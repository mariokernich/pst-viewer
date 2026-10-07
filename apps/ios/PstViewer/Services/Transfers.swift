import CoreTransferable
import Foundation
import PstViewerCore
import UniformTypeIdentifiers

/// An attachment that is read from the archive only when the user shares or
/// saves it.
nonisolated struct AttachmentTransfer: Transferable {
    let connection: ArchiveConnection
    let ref: MessageRef
    let index: UInt32

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .data) { item in
            // The core writes the file itself; the name is only known afterwards.
            let staging = try TemporaryFiles.location(named: "attachment")
            do {
                let meta = try await item.connection.saveAttachment(item.ref, index: item.index, to: staging)
                let name = sanitizeFileName(name: meta.fileName, fallback: "attachment")
                return SentTransferredFile(try TemporaryFiles.finish(staging, named: name))
            } catch {
                TemporaryFiles.remove(staging)
                throw error
            }
        }
    }
}

/// A message exported as PDF, .eml or text, produced when a share or save
/// destination asks for it.
nonisolated struct MessageTransfer: Transferable {
    enum Format: Sendable {
        case pdf
        case eml
        case text

        var fileExtension: String {
            switch self {
            case .pdf: "pdf"
            case .eml: "eml"
            case .text: "txt"
            }
        }
    }

    let format: Format
    let baseName: String
    /// Writes the export to the given file.
    let write: @Sendable (URL) async throws -> Void

    var fileName: String {
        "\(baseName).\(format.fileExtension)"
    }

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .pdf) { try await $0.file() }
            .exportingCondition { $0.format == .pdf }
        FileRepresentation(exportedContentType: .emailMessage) { try await $0.file() }
            .exportingCondition { $0.format == .eml }
        FileRepresentation(exportedContentType: .utf8PlainText) { try await $0.file() }
            .exportingCondition { $0.format == .text }
    }

    private func file() async throws -> SentTransferredFile {
        let url = try TemporaryFiles.location(named: fileName)
        do {
            try await write(url)
            return SentTransferredFile(try TemporaryFiles.finish(url))
        } catch {
            TemporaryFiles.remove(url)
            throw error
        }
    }
}

extension MailboxModel {
    /// Export of a message in the given format; failures are reported as toast.
    /// The documents are only built when a destination asks for the file.
    func transfer(_ detail: MessageDetail, as format: MessageTransfer.Format) -> MessageTransfer {
        let export = export(of: detail)
        let toasts = toasts
        let write: @Sendable (URL) async throws -> Void
        switch format {
        case .pdf:
            write = { @MainActor url in
                try await DocumentRenderer.pdf(html: export.printDocument, allowRemote: export.allowRemote, footer: export.subject).write(to: url)
            }
        case .eml:
            let connection = connection
            let ref = detail.messageRef
            write = { url in try await connection.saveEml(ref, to: url) }
        case .text:
            write = { @MainActor url in try Data(export.text.utf8).write(to: url) }
        }
        return MessageTransfer(format: format, baseName: export.baseName) { url in
            do {
                try await write(url)
            } catch {
                await toasts.show(String(localized: "Export failed"), style: .failure)
                throw error
            }
        }
    }

    func transfer(of attachment: AttachmentInfo, in ref: MessageRef) -> AttachmentTransfer {
        AttachmentTransfer(connection: connection, ref: ref, index: attachment.index)
    }
}
