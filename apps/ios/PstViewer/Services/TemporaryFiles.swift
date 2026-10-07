import Foundation

/// Files written for previews, exports and sharing. Each file gets its own
/// directory in the app's temporary folder; everything left over is removed
/// at the next launch.
nonisolated enum TemporaryFiles {
    private static var root: URL {
        FileManager.default.temporaryDirectory.appending(path: "Files", directoryHint: .isDirectory)
    }

    /// Writes `data` as a read-only file with the given (already sanitised) name.
    static func write(_ data: Data, named name: String) throws -> URL {
        let directory = root.appending(path: UUID().uuidString, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appending(path: name, directoryHint: .notDirectory)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        try FileManager.default.setAttributes([.posixPermissions: 0o444], ofItemAtPath: url.path)
        return url
    }

    /// A new location for a file with the given (already sanitised) name, for
    /// writers that create the file themselves; call `finish` afterwards.
    static func location(named name: String) throws -> URL {
        let directory = root.appending(path: UUID().uuidString, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appending(path: name, directoryHint: .notDirectory)
    }

    /// Makes a file created at a `location` read-only, renaming it if needed.
    static func finish(_ url: URL, named name: String? = nil) throws -> URL {
        var target = url
        if let name, name != url.lastPathComponent {
            target = url.deletingLastPathComponent().appending(path: name, directoryHint: .notDirectory)
            try FileManager.default.moveItem(at: url, to: target)
        }
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete, .posixPermissions: 0o444], ofItemAtPath: target.path)
        return target
    }

    /// Deletes a file created by `write` or at a `location` together with its directory.
    static func remove(_ url: URL) {
        let directory = url.deletingLastPathComponent()
        guard directory.deletingLastPathComponent().standardizedFileURL == root.standardizedFileURL else { return }
        try? FileManager.default.removeItem(at: directory)
    }

    static func removeAll() {
        try? FileManager.default.removeItem(at: root)
    }
}
