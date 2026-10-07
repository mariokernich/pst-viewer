#if DEBUG
import Foundation
import PstViewerCore

/// Drives the UI into states for screenshots and manual tests, configured with
/// launch arguments (debug builds only), e.g.
/// `simctl launch <device> de.kernich.pstviewer -demoOpen /path/Demo.mbox -demoSelect 0`.
///
/// - `-demoOpen <path>`: opens a file or folder
/// - `-demoFolder <name>`: selects a folder by (display) name
/// - `-demoSearch <text>`: searches for the text
/// - `-demoUnread`, `-demoAttachments`: sets these filters
/// - `-demoSelect <index>`: selects the message at this row
/// - `-demoAttached`: opens the first attached message of the selected one
/// - `-demoAttachment <index>`: previews this attachment of the selected message
/// - `-demoRemote`: loads remote images of the selected message
/// - `-demoTextBody`: shows the text instead of the HTML body
/// - `-demoHeaders`, `-demoFilters`, `-demoSyntax`, `-demoSettings`: opens these sheets
/// - `-demoExportPreview`: renders the selected message as PDF and shows it
/// - `-demoOpening`: shows the opening progress with sample values
/// - `-demoColumns all`: shows all three columns on the iPad
/// - `-demoPrint`: opens the print dialog for the selected message
/// - `-demoSidebar`: starts with the folders on the iPhone
/// - `-demoSuggest`: focuses the search field to show suggestions (iOS 18+)
enum DemoDriver {
    private static var arguments: [String] {
        ProcessInfo.processInfo.arguments
    }

    private static func value(_ name: String) -> String? {
        guard let index = arguments.firstIndex(of: "-\(name)"), index + 1 < arguments.count else { return nil }
        return arguments[index + 1]
    }

    private static func flag(_ name: String) -> Bool {
        arguments.contains("-\(name)")
    }

    static var showsAllColumns: Bool {
        value("demoColumns") == "all"
    }

    static var showsTextBody: Bool {
        flag("demoTextBody")
    }

    static var startsWithSidebar: Bool {
        flag("demoSidebar")
    }

    static func start(_ model: AppModel) {
        if flag("demoSettings") { model.showsSettings = true }
        if flag("demoOpening") { model.showOpeningSample() }
        guard let path = value("demoOpen") else { return }
        model.open(URL(filePath: path))
        Task { await drive(model) }
    }

    private static func drive(_ model: AppModel) async {
        guard let mailbox = await wait(for: { model.mailbox }) else { return }
        // The iPhone shows the folders while none is selected.
        if startsWithSidebar { mailbox.folderSelection = nil }
        if let name = value("demoFolder"),
           let folder = mailbox.folders.first(where: { $0.displayName == name || $0.name == name }) {
            mailbox.folderSelection = .folder(folder.id)
        }
        if let text = value("demoSearch") { mailbox.query = text }
        if flag("demoUnread") { mailbox.filters.readState = .unread }
        if flag("demoAttachments") { mailbox.filters.hasAttachments = true }
        if flag("demoFilters") { mailbox.showsFilters = true }
        if flag("demoSyntax") { mailbox.showsSearchSyntax = true }
        try? await Task.sleep(for: .milliseconds(400))
        if flag("demoSuggest") { mailbox.searchFocusRequest += 1 }
        guard let row = value("demoSelect").flatMap(Int.init) else { return }
        guard await wait(for: { mailbox.result }) != nil else { return }
        await mailbox.selectMessage(at: row)
        guard let detail = await wait(for: { mailbox.displayedDetail }) else { return }
        if flag("demoRemote") { mailbox.allowRemoteImages(for: detail.messageRef) }
        if flag("demoAttached"), let attached = detail.fileAttachments.first(where: \.isMessage) {
            mailbox.readerPath.append(MessageRef(id: detail.messageRef.id, path: [attached.index]))
        }
        if let index = value("demoAttachment").flatMap(Int.init) { mailbox.demoAttachment = index }
        if flag("demoHeaders") { mailbox.showHeaders() }
        if flag("demoPrint") { mailbox.print(detail) }
        if flag("demoExportPreview") {
            let export = mailbox.export(of: detail)
            if let data = try? await DocumentRenderer.pdf(html: export.printDocument, allowRemote: export.allowRemote, footer: export.subject) {
                model.demoPreviewURL = try? TemporaryFiles.write(data, named: "\(export.baseName).pdf")
            }
        }
    }

    private static func wait<T>(for value: () -> T?) async -> T? {
        for _ in 0..<100 {
            if let value = value() { return value }
            try? await Task.sleep(for: .milliseconds(100))
        }
        return nil
    }
}
#endif
