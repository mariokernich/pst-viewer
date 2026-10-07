import Foundation
import Observation
import PstViewerCore
import UIKit

/// A recently opened file or folder. Only names, sizes and a bookmark are
/// stored, never mail content.
struct RecentFile: Codable, Identifiable, Hashable {
    var path: String
    var name: String
    /// Where the file lives, e.g. "iCloud Drive › Archiv".
    var location: String
    var isFolder: Bool
    var size: Int64
    var itemCount: UInt32?
    var lastOpened: Date
    /// Bookmark that grants access again after a restart.
    var bookmark: Data

    var id: String { path }
}

/// The list of recently opened files, persisted as JSON in Application Support.
@Observable
final class RecentFiles {
    static let shared = RecentFiles()

    private static let limit = 12

    private(set) var files: [RecentFile] = []
    /// Paths of entries whose file no longer exists.
    private(set) var missing: Set<String> = []

    private let storeURL: URL

    init(storeURL: URL = URL.applicationSupportDirectory.appending(path: "RecentFiles.json")) {
        self.storeURL = storeURL
        if let data = try? Data(contentsOf: storeURL), let files = try? JSONDecoder().decode([RecentFile].self, from: data) {
            self.files = files
        }
    }

    /// Adds or moves an opened file to the top; `previous` is the entry it was
    /// opened from (the file may have moved since). Call while the file is accessible.
    func record(_ url: URL, store: StoreInfo, replacing previous: RecentFile? = nil) {
        guard let bookmark = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) else { return }
        let isFolder = (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
        let entry = RecentFile(
            path: url.path,
            name: url.lastPathComponent,
            location: FileLocation.describe(url),
            isFolder: isFolder,
            size: store.fileSize,
            itemCount: store.itemCount,
            lastOpened: .now,
            bookmark: bookmark
        )
        files = [entry] + files.filter { $0.path != entry.path && $0.path != previous?.path }.prefix(Self.limit - 1)
        missing.remove(entry.path)
        save()
    }

    /// The current location of a recent file. Callers start accessing the
    /// security-scoped URL themselves.
    func resolve(_ file: RecentFile) throws -> URL {
        var stale = false
        let url = try URL(resolvingBookmarkData: file.bookmark, options: [.withoutUI], relativeTo: nil, bookmarkDataIsStale: &stale)
        if stale, let index = files.firstIndex(of: file) {
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            if let bookmark = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) {
                files[index].bookmark = bookmark
                save()
            }
        }
        return url
    }

    func remove(_ file: RecentFile) {
        files.removeAll { $0.path == file.path }
        missing.remove(file.path)
        deleteInboxCopy(file)
        save()
    }

    func clear() {
        files.forEach(deleteInboxCopy)
        files = []
        missing = []
        save()
    }

    /// Copies handed to the app ("Open in", drops) are only reachable through
    /// this list, so they go when their entry goes.
    private func deleteInboxCopy(_ file: RecentFile) {
        guard Inbox.contains(file.path) else { return }
        let url = URL(filePath: file.path)
        try? FileManager.default.removeItem(at: url)
        let folder = url.deletingLastPathComponent()
        if folder.standardizedFileURL != Inbox.directory.standardizedFileURL {
            try? FileManager.default.removeItem(at: folder)
        }
    }

    /// Checks which files still exist (off the main thread, file providers can be slow).
    func refreshAvailability() async {
        let entries = files.map { ($0.path, $0.bookmark) }
        let missing = await Task.detached(priority: .utility) {
            Set(entries.compactMap { path, bookmark in Self.exists(bookmark: bookmark) ? nil : path })
        }.value
        self.missing = missing
    }

    private nonisolated static func exists(bookmark: Data) -> Bool {
        var stale = false
        guard let url = try? URL(resolvingBookmarkData: bookmark, options: [.withoutUI], relativeTo: nil, bookmarkDataIsStale: &stale) else {
            return false
        }
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        return FileManager.default.fileExists(atPath: url.path)
    }

    private func save() {
        do {
            try FileManager.default.createDirectory(at: storeURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(files).write(to: storeURL, options: .atomic)
        } catch {
            // The list is a convenience; failing to persist it is not worth an error.
        }
    }
}

/// Keeps a security-scoped file or folder accessible for the lifetime of this object.
nonisolated final class SecurityScopedAccess: Sendable {
    let url: URL
    private let accessing: Bool

    init(_ url: URL) {
        self.url = url
        accessing = url.startAccessingSecurityScopedResource()
    }

    deinit {
        if accessing { url.stopAccessingSecurityScopedResource() }
    }
}

/// Human-readable locations of files, similar to the Files app.
enum FileLocation {
    static func describe(_ url: URL) -> String {
        let parent = url.deletingLastPathComponent().standardizedFileURL.path
        if let rest = components(of: parent, after: "/Mobile Documents/com~apple~CloudDocs") {
            return join(["iCloud Drive"] + rest)
        }
        if let rest = components(of: parent, after: "/File Provider Storage") {
            let root = UIDevice.current.userInterfaceIdiom == .pad ? String(localized: "On My iPad") : String(localized: "On My iPhone")
            return join([root] + rest)
        }
        if parent.hasPrefix(URL.homeDirectory.standardizedFileURL.path) {
            return "PST Viewer"
        }
        return FileManager.default.displayName(atPath: parent)
    }

    private static func components(of path: String, after marker: String) -> [String]? {
        guard let range = path.range(of: marker) else { return nil }
        return path[range.upperBound...].split(separator: "/").map(String.init)
    }

    private static func join(_ parts: [String]) -> String {
        parts.joined(separator: " › ")
    }
}
