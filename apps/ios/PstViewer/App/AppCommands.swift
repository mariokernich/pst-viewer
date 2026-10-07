import SwiftUI

extension FocusedValues {
    @Entry var appModel: AppModel?
    @Entry var mailbox: MailboxModel?
}

/// Menu bar commands and keyboard shortcuts of the iPad (see the desktop README).
struct AppCommands: Commands {
    @FocusedValue(\.appModel) private var app
    @FocusedValue(\.mailbox) private var mailbox

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("Open File…") { app?.importKind = .file }
                .keyboardShortcut("o")
                .disabled(app == nil || app?.isOpening == true)
            Button("Open Folder…") { app?.importKind = .folder }
                .keyboardShortcut("o", modifiers: [.command, .shift])
                .disabled(app == nil || app?.isOpening == true)
            Divider()
            Button("Close File") { app?.closeArchive() }
                .keyboardShortcut("w", modifiers: [.command, .shift])
                .disabled(mailbox == nil)
        }

        CommandMenu("Search") {
            Group {
                Button("Search") { mailbox?.searchFocusRequest += 1 }
                    .keyboardShortcut("f")
                Button("Filters") { mailbox?.showsFilters.toggle() }
                    .keyboardShortcut("f", modifiers: [.command, .option])
                Button("Search Syntax") { mailbox?.showsSearchSyntax = true }
            }
            .disabled(mailbox == nil)
        }

        CommandMenu("Message") {
            Group {
                Button("Previous message") { mailbox?.moveSelection(by: -1) }
                    .keyboardShortcut(.upArrow, modifiers: [])
                    .disabled(mailbox?.canSelectPrevious != true)
                Button("Next message") { mailbox?.moveSelection(by: 1) }
                    .keyboardShortcut(.downArrow, modifiers: [])
                    .disabled(mailbox?.canSelectNext != true)
                Divider()
                Button("Internet Headers") { mailbox?.showHeaders() }
                    .keyboardShortcut("u", modifiers: [.command, .option])
                    .disabled(mailbox?.displayedDetail == nil)
                Button("Print…") { mailbox?.printDisplayed() }
                    .keyboardShortcut("p")
                    .disabled(mailbox?.displayedDetail == nil)
            }
            .disabled(isCovered)
        }
    }

    /// Sheets have their own keys (e.g. the arrows of the attachment preview).
    private var isCovered: Bool {
        mailbox?.isPresentingSheet == true || app?.showsSettings == true
    }
}
