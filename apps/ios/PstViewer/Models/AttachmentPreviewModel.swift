import Foundation
import Observation
import PstViewerCore
import QuickLook

/// The attachment preview: the file attachments of a message, of which one is
/// shown at a time (step through with the arrows, as on the desktop).
@Observable
final class AttachmentPreviewModel: Identifiable {
    /// A loaded attachment and, for Quick Look, its read-only temporary copy.
    struct Loaded {
        let file: AttachmentFile
        let quickLookURL: URL?

        /// Types that can run code are only saved, never previewed. HTML is
        /// the exception: it is shown sanitised, without scripts (as on the desktop).
        var isBlocked: Bool {
            !file.canOpen && file.previewKind != .html
        }
    }

    enum State {
        case loading
        case loaded(Loaded)
        case failed(String)
    }

    let id = UUID()
    let connection: ArchiveConnection
    let ref: MessageRef
    let attachments: [AttachmentInfo]
    private(set) var position: Int
    private(set) var state = State.loading

    @ObservationIgnored private var loadTask: Task<Void, Never>?
    @ObservationIgnored private var loadedPosition: Int?

    init(connection: ArchiveConnection, ref: MessageRef, attachments: [AttachmentInfo], position: Int) {
        self.connection = connection
        self.ref = ref
        self.attachments = attachments
        self.position = position
    }

    var current: AttachmentInfo {
        attachments[position]
    }

    func step(by delta: Int) {
        guard attachments.count > 1 else { return }
        position = (position + delta + attachments.count) % attachments.count
        load()
    }

    /// Loads the current attachment unless it is already shown.
    func load() {
        guard loadedPosition != position else { return }
        loadedPosition = position
        removeCopy()
        state = .loading
        let attachment = current
        loadTask?.cancel()
        loadTask = Task {
            do {
                let file = try await connection.attachment(ref, index: attachment.index)
                guard !Task.isCancelled else { return }
                state = .loaded(Loaded(file: file, quickLookURL: try Self.quickLookCopy(of: file)))
            } catch is CancellationError {
                return
            } catch {
                guard !Task.isCancelled else { return }
                loadedPosition = nil
                state = .failed((error as? CoreError)?.userMessage ?? String(localized: "The preview could not be loaded."))
            }
        }
    }

    /// Deletes the temporary copy; called when the preview closes.
    func close() {
        loadTask?.cancel()
        loadedPosition = nil
        removeCopy()
    }

    private func removeCopy() {
        if case let .loaded(loaded) = state, let url = loaded.quickLookURL {
            TemporaryFiles.remove(url)
        }
    }

    /// Quick Look shows files from disk: a read-only copy in the temporary folder.
    private static func quickLookCopy(of file: AttachmentFile) throws -> URL? {
        guard file.canOpen else { return nil }
        switch file.previewKind {
        case .pdf, .image, .text, .audio, .video, .none:
            let url = try TemporaryFiles.write(file.data, named: sanitizeFileName(name: file.fileName, fallback: "attachment"))
            if file.previewKind == .none, !QLPreviewController.canPreview(url as NSURL) {
                TemporaryFiles.remove(url)
                return nil
            }
            return url
        case .csv, .html, .calendar, .contact, .message:
            return nil
        }
    }
}
