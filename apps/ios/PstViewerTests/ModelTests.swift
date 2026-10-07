import Foundation
import PstViewerCore
import Testing
@testable import PstViewer

@MainActor
struct FilterChipTests {
    @Test func defaultFiltersHaveNoChips() {
        #expect(defaultFilters().chips.isEmpty)
    }

    @Test func chipsResetTheirFilter() throws {
        var filters = defaultFilters()
        filters.from = "anna"
        filters.hasAttachments = true
        filters.datePreset = .custom
        filters.customFrom = Calendar.current.date(from: DateComponents(year: 2024, month: 3, day: 1))
        #expect(filters.dateFrom == "2024-03-01")
        #expect(filters.chips.map(\.id) == ["date", "from", "attachments"])

        let chip = try #require(filters.chips.first { $0.id == "date" })
        chip.reset(&filters)
        #expect(filters.datePreset == .any && filters.dateFrom == nil)
        #expect(filters.chips.map(\.id) == ["from", "attachments"])
    }
}

@MainActor
struct TemporaryFilesTests {
    @Test func writesReadOnlyCopiesAndRemovesThem() throws {
        let url = try TemporaryFiles.write(Data("hello".utf8), named: "test.txt")
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        #expect((attributes[.posixPermissions] as? NSNumber)?.int16Value == 0o444)
        #expect(try Data(contentsOf: url) == Data("hello".utf8))
        TemporaryFiles.remove(url)
        #expect(!FileManager.default.fileExists(atPath: url.deletingLastPathComponent().path))
    }
}

@MainActor
struct RecentFilesTests {
    @Test func recordsMovesAndRemovesFiles() throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let first = directory.appending(path: "a.mbox")
        let second = directory.appending(path: "b.pst")
        try Data().write(to: first)
        try Data().write(to: second)

        let recents = RecentFiles(storeURL: directory.appending(path: "Recent.json"))
        recents.record(first, store: .sample(itemCount: 3))
        recents.record(second, store: .sample(itemCount: 5))
        recents.record(first, store: .sample(itemCount: 4))
        #expect(recents.files.map(\.name) == ["a.mbox", "b.pst"])
        #expect(recents.files.first?.itemCount == 4)
        #expect(try recents.resolve(recents.files[0]).lastPathComponent == "a.mbox")

        // A second instance reads the persisted list.
        let reloaded = RecentFiles(storeURL: directory.appending(path: "Recent.json"))
        #expect(reloaded.files.map(\.name) == ["a.mbox", "b.pst"])

        recents.remove(recents.files[0])
        #expect(recents.files.map(\.name) == ["b.pst"])
        recents.clear()
        #expect(recents.files.isEmpty)
    }
}

extension StoreInfo {
    static func sample(itemCount: UInt32) -> StoreInfo {
        StoreInfo(
            filePath: "", fileName: "", fileSize: 1024, displayName: "", format: .mbox, itemCount: itemCount, unreadCount: 0,
            folderCount: 1, dateMin: nil, dateMax: nil, indexMs: 0, skippedItems: 0
        )
    }
}
