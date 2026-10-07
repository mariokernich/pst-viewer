import Foundation
import PstViewerCore

/// Progress reported by an archive while it is opened and indexed.
enum ArchiveEvent: Sendable {
    case open(OpenProgress)
    case index(IndexProgress)
}

/// Receives the core's listener callbacks on the archive's worker thread and
/// hands them to a handler on the main actor.
nonisolated final class ArchiveEvents: ArchiveListener, @unchecked Sendable {
    typealias Handler = @MainActor @Sendable (ArchiveEvent) -> Void

    // Guarded by `lock`.
    private let lock = NSLock()
    private var handler: Handler?
    private var lastIndex: IndexProgress?

    /// Sets the receiver of further events. The latest index progress is
    /// replayed, so a new receiver does not miss the end of indexing.
    func setHandler(_ handler: Handler?) {
        let replay = lock.withLock {
            self.handler = handler
            return lastIndex
        }
        if let handler, let replay {
            Task { @MainActor in handler(.index(replay)) }
        }
    }

    func onOpenProgress(progress: OpenProgress) {
        deliver(.open(progress))
    }

    func onIndexProgress(progress: IndexProgress) {
        lock.withLock { lastIndex = progress }
        deliver(.index(progress))
    }

    private func deliver(_ event: ArchiveEvent) {
        guard let handler = lock.withLock({ handler }) else { return }
        Task { @MainActor in handler(event) }
    }
}

/// An opened archive. Every call of the core blocks until the archive's worker
/// thread answers, so calls run on a private serial queue and are awaited.
nonisolated final class ArchiveConnection: Sendable {
    let events: ArchiveEvents
    private let session: ArchiveSession
    private let queue: DispatchQueue

    private init(session: ArchiveSession, queue: DispatchQueue, events: ArchiveEvents) {
        self.session = session
        self.queue = queue
        self.events = events
    }

    /// Opens a file or folder. Returns once the item list is built; bodies are
    /// indexed in the background afterwards and reported through `events`.
    static func open(_ url: URL, cancel: CancelToken, events: ArchiveEvents) async throws -> ArchiveConnection {
        let queue = DispatchQueue(label: "de.kernich.pstviewer.archive", qos: .userInitiated)
        let session = try await run(on: queue) {
            try coordinatedRead(url) { url in
                try ArchiveSession.open(path: url.path, listener: events, cancel: cancel)
            }
        }
        return ArchiveConnection(session: session, queue: queue, events: events)
    }

    /// Reads through a file coordinator, so file providers (iCloud Drive, …)
    /// download a file that is only a placeholder first.
    private static func coordinatedRead<T>(_ url: URL, _ read: (URL) throws -> T) throws -> T {
        var result: Result<T, Error>?
        var coordinationError: NSError?
        NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges, error: &coordinationError) { url in
            result = Result { try read(url) }
        }
        // Without coordination (e.g. a missing file) the core reports the error.
        return try result?.get() ?? read(url)
    }

    func info() async throws -> OpenResult {
        try await perform { try $0.info() }
    }

    func search(_ request: SearchRequest) async throws -> SearchResponse {
        try await perform { try $0.search(request: request) }
    }

    /// More items of a search result; nil if the result is outdated.
    func page(token: UInt64, offset: Int, limit: Int) async throws -> [MessageSummary]? {
        try await perform { try $0.page(token: token, offset: UInt32(offset), limit: UInt32(limit)) }
    }

    func message(_ ref: MessageRef) async throws -> MessageDetail {
        try await perform { try $0.message(messageRef: ref) }
    }

    func attachment(_ ref: MessageRef, index: UInt32) async throws -> AttachmentFile {
        try await perform { try $0.attachment(messageRef: ref, index: index) }
    }

    /// Writes an attachment (attached messages as .eml) to `url`.
    func saveAttachment(_ ref: MessageRef, index: UInt32, to url: URL) async throws -> AttachmentMeta {
        let path = url.path
        return try await perform { try $0.saveAttachment(messageRef: ref, index: index, path: path) }
    }

    /// Writes the message as .eml to `url`.
    func saveEml(_ ref: MessageRef, to url: URL) async throws {
        let path = url.path
        _ = try await perform { try $0.saveEml(messageRef: ref, path: path) }
    }

    /// Indexes the items of a folder first. Does not wait for the worker.
    func prioritizeFolder(_ folderId: UInt32?) {
        session.prioritizeFolder(folderId: folderId)
    }

    /// Stops the worker and releases the files.
    func close() async {
        events.setHandler(nil)
        _ = try? await perform { $0.close() }
    }

    private func perform<T: Sendable>(_ work: @escaping @Sendable (ArchiveSession) throws -> T) async throws -> T {
        let session = session
        return try await Self.run(on: queue) { try work(session) }
    }

    private static func run<T: Sendable>(on queue: DispatchQueue, _ work: @escaping @Sendable () throws -> T) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                continuation.resume(with: Result(catching: work))
            }
        }
    }
}
