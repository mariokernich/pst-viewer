import Foundation
import PstViewerCore
import Testing
@testable import PstViewer

/// Opens a small MBOX file with the real core and exercises the bridge and the models.
@MainActor
struct ArchiveIntegrationTests {
    private static let mailbox = """
    From demo@example.com Mon Oct 05 10:00:00 2026
    From: Anna Becker <anna@example.com>
    To: Mario Beispiel <mario@example.com>
    Subject: Angebot Messestand
    Date: Mon, 05 Oct 2026 10:00:00 +0200
    X-Gmail-Labels: Posteingang
    MIME-Version: 1.0
    Content-Type: multipart/mixed; boundary="b1"

    --b1
    Content-Type: text/plain; charset=utf-8

    Hallo Mario, anbei das Angebot für den Messestand.
    --b1
    Content-Type: text/plain; name="Angebot.txt"
    Content-Disposition: attachment; filename="Angebot.txt"

    Preis: 100 EUR
    --b1--

    From demo@example.com Sun Oct 04 09:00:00 2026
    From: Jonas Weber <jonas@example.com>
    To: Mario Beispiel <mario@example.com>
    Subject: Rechnung 2026-1043
    Date: Sun, 04 Oct 2026 09:00:00 +0200
    X-Gmail-Labels: Archiv
    Content-Type: text/plain; charset=utf-8

    Guten Tag, anbei die Rechnung.

    """

    private func openMailbox() async throws -> (ArchiveConnection, OpenResult) {
        let url = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).mbox")
        try Data(Self.mailbox.utf8).write(to: url)
        let connection = try await ArchiveConnection.open(url, cancel: CancelToken(), events: ArchiveEvents())
        var info = try await connection.info()
        for _ in 0..<200 where !info.contentIndexed {
            try await Task.sleep(for: .milliseconds(20))
            info = try await connection.info()
        }
        return (connection, info)
    }

    private func request(_ text: String) -> SearchRequest {
        SearchRequest(
            text: text, folderId: nil, includeSubfolders: true, filters: defaultFilters(),
            sort: SortSpec(field: .date, dir: .desc), now: Date.now.epochMillis, firstDayOfWeek: 1, pageSize: 100
        )
    }

    @Test func searchesReadsAndExportsMessages() async throws {
        let (connection, info) = try await openMailbox()
        #expect(info.store.itemCount == 2)
        #expect(info.contentIndexed)

        let response = try await connection.search(request("angebot"))
        #expect(response.total == 1)
        let summary = try #require(response.items.first)
        #expect(findMatches(text: summary.subject, terms: response.highlightTerms).count == 1)

        let detail = try await connection.message(MessageRef(id: summary.id, path: []))
        #expect(detail.subject == "Angebot Messestand")
        let attachment = try #require(detail.fileAttachments.first)
        let file = try await connection.attachment(detail.messageRef, index: attachment.index)
        #expect(file.fileName == "Angebot.txt")
        #expect(String(decoding: file.data, as: UTF8.self).contains("100 EUR"))

        let staging = try TemporaryFiles.location(named: "attachment")
        let meta = try await connection.saveAttachment(detail.messageRef, index: attachment.index, to: staging)
        let saved = try TemporaryFiles.finish(staging, named: meta.fileName)
        #expect(saved.lastPathComponent == "Angebot.txt")
        #expect(try Data(contentsOf: saved) == file.data)
        TemporaryFiles.remove(saved)

        let emlURL = try TemporaryFiles.location(named: "message.eml")
        try await connection.saveEml(detail.messageRef, to: emlURL)
        #expect(try String(contentsOf: emlURL, encoding: .utf8).contains("Angebot Messestand"))
        TemporaryFiles.remove(try TemporaryFiles.finish(emlURL))

        let export = MessageExport(detail: detail, folderName: "Posteingang", allowRemote: false)
        #expect(export.headerRows.contains { $0.label == String(localized: "Folder") && $0.value == "Posteingang" })
        #expect(export.headerRows.contains { $0.label == String(localized: "Attachments") && $0.value.hasPrefix("Angebot.txt") })
        #expect(export.printDocument.contains("Content-Security-Policy"))
        #expect(export.text.contains("Angebot Messestand"))
        await connection.close()
    }

    @Test func mailboxModelListsTheInboxAndSuggests() async throws {
        let (connection, info) = try await openMailbox()
        let mailbox = MailboxModel(
            connection: connection, info: info,
            access: SecurityScopedAccess(FileManager.default.temporaryDirectory), toasts: Toasts()
        )
        mailbox.start()
        for _ in 0..<200 where mailbox.result == nil {
            try await Task.sleep(for: .milliseconds(20))
        }
        #expect(mailbox.selectedFolder?.special == .inbox)
        #expect(mailbox.result?.total == 1)
        #expect(mailbox.folderTree.count == info.folders.filter { $0.parentId == nil }.count)

        mailbox.query = "anna"
        let suggestions = mailbox.suggestions()
        #expect(suggestions.contains { if case .sender = $0.action { true } else { false } })
        #expect(suggestions.first?.section == .searchIn)

        mailbox.scope = .all
        mailbox.runSearch()
        for _ in 0..<200 where mailbox.result?.signature.text != "anna" {
            try await Task.sleep(for: .milliseconds(20))
        }
        #expect(mailbox.result?.total == 1)
        await mailbox.selectMessage(at: 0)
        #expect(mailbox.selectedIndex == 0)
        #expect(!mailbox.canSelectNext)
        await mailbox.close()
    }
}
