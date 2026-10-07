import Foundation
import Observation
import PstViewerCore

/// State of an archive while it is being opened.
@Observable
final class OpeningModel {
    let name: String
    let isFolder: Bool
    private(set) var progress: OpenProgress?
    private(set) var isCanceled = false

    @ObservationIgnored private let cancelToken = CancelToken()

    init(name: String, isFolder: Bool) {
        self.name = name
        self.isFolder = isFolder
    }

    #if DEBUG
    func simulate(_ progress: OpenProgress) {
        self.progress = progress
    }
    #endif

    func cancel() {
        isCanceled = true
        cancelToken.cancel()
    }

    /// Opens the archive and reports progress until the item list is ready.
    func open(_ url: URL) async throws -> ArchiveConnection {
        let events = ArchiveEvents()
        events.setHandler { [weak self] event in
            if case let .open(progress) = event { self?.progress = progress }
        }
        return try await ArchiveConnection.open(url, cancel: cancelToken, events: events)
    }

    /// Indexing counts items and scanning an MBOX counts bytes; both are determinate.
    var fractionDone: Double? {
        guard let progress, progress.phase == .indexing || progress.phase == .scanning, progress.total > 0 else { return nil }
        return min(1, Double(progress.done) / Double(progress.total))
    }

    var status: String {
        switch progress?.phase {
        case .indexing: String(localized: "Indexing items…")
        case .scanning: String(localized: "Looking for messages…")
        case .finishing: String(localized: "Finishing search index…")
        case .opening, nil: String(localized: "Opening file…")
        }
    }

    var detail: String {
        guard let progress else { return "" }
        switch progress.phase {
        case .indexing where progress.total > 0:
            return String(localized: "\(Formatting.number(progress.done)) of \(Formatting.number(progress.total)) items")
        case .scanning where progress.total > 0:
            return String(localized: "\(Formatting.size(progress.done)) of \(Formatting.size(progress.total)) read")
        case .scanning where progress.done > 0:
            return String(localized: "\(Formatting.number(progress.done)) messages found")
        default:
            return ""
        }
    }
}
