import Foundation
import Observation
import PstViewerCore

/// State of a window: the welcome screen, an archive being opened, or an open mailbox.
@Observable
final class AppModel {
    enum Screen {
        case welcome
        case opening(OpeningModel)
        case mailbox(MailboxModel)
    }

    /// What the file importer is asked to pick.
    enum ImportKind: Identifiable {
        case file
        case folder

        var id: Self { self }
    }

    /// An archive that could not be opened, shown on the welcome screen.
    struct OpenFailure: Identifiable {
        let id = UUID()
        let message: String
        let path: String
        /// The recent file that could not be found, so it can be removed from the list.
        let missingRecent: RecentFile?
    }

    private(set) var screen: Screen = .welcome
    var openFailure: OpenFailure?
    var importKind: ImportKind?
    var showsSettings = false

    let recents: RecentFiles
    let toasts = Toasts()

    #if DEBUG
    /// A file shown in Quick Look by the demo driver.
    var demoPreviewURL: URL?
    #endif

    init(recents: RecentFiles = .shared) {
        self.recents = recents
    }

    var mailbox: MailboxModel? {
        if case let .mailbox(mailbox) = screen { return mailbox }
        return nil
    }

    var isOpening: Bool {
        if case .opening = screen { return true }
        return false
    }

    /// Opens a file or folder picked by the user, passed by another app or dropped.
    func open(_ url: URL) {
        open(url, recent: nil)
    }

    func open(_ recent: RecentFile) {
        do {
            open(try recents.resolve(recent), recent: recent)
        } catch {
            openFailure = OpenFailure(message: CoreError.NotFound(message: "").userMessage, path: recent.path, missingRecent: recent)
        }
    }

    private func open(_ url: URL, recent: RecentFile?) {
        guard !isOpening else { return }
        let access = SecurityScopedAccess(url)
        let isFolder = (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
        let opening = OpeningModel(name: url.lastPathComponent, isFolder: isFolder)
        let previous = mailbox
        openFailure = nil
        screen = .opening(opening)
        Task {
            await previous?.close()
            do {
                let connection = try await opening.open(url)
                let info = try await connection.info()
                guard !opening.isCanceled else {
                    await connection.close()
                    throw CoreError.Canceled
                }
                recents.record(url, store: info.store, replacing: recent)
                let mailbox = MailboxModel(connection: connection, info: info, access: access, toasts: toasts)
                screen = .mailbox(mailbox)
                mailbox.start()
            } catch {
                screen = .welcome
                let coreError = error as? CoreError ?? .Internal(message: error.localizedDescription)
                if coreError != .Canceled {
                    let missing = coreError.isNotFound ? recent : nil
                    openFailure = OpenFailure(message: coreError.userMessage, path: url.path, missingRecent: missing)
                }
                await recents.refreshAvailability()
            }
        }
    }

    func cancelOpening() {
        if case let .opening(opening) = screen { opening.cancel() }
    }

    func closeArchive() {
        guard let mailbox else { return }
        screen = .welcome
        Task {
            await mailbox.close()
            await recents.refreshAvailability()
        }
    }
}

#if DEBUG
extension AppModel {
    /// The opening screen with sample progress, for screenshots.
    func showOpeningSample() {
        let opening = OpeningModel(name: "Archiv 2024.pst", isFolder: false)
        opening.simulate(OpenProgress(phase: .indexing, done: 1_480, total: 2_315, folderName: "Posteingang"))
        screen = .opening(opening)
    }
}
#endif

private extension CoreError {
    var isNotFound: Bool {
        if case .NotFound = self { return true }
        return false
    }
}
