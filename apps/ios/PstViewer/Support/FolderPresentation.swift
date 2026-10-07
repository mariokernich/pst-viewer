import Foundation
import PstViewerCore

/// Names and symbols of folders (port of `lib/folders.ts`).
extension FolderInfo {
    /// Display name, localising the well-known Outlook folders. Folders detected
    /// by their type only (calendar, contacts, …) keep a custom name.
    var displayName: String {
        guard let special else { return name }
        if let standardNames = special.standardNames,
           !standardNames.contains(name.trimmingCharacters(in: .whitespaces).lowercased()) {
            return name
        }
        return special.localizedName
    }

    var symbolName: String {
        if let special { return special.symbolName }
        let type = containerClass.lowercased()
        if type.hasPrefix("ipf.appointment") { return "calendar" }
        if type.hasPrefix("ipf.contact") { return "person.crop.circle" }
        if type.hasPrefix("ipf.task") { return "checklist" }
        if type.hasPrefix("ipf.stickynote") { return "note.text" }
        return "folder"
    }

    /// Sent mail lists the recipients instead of the sender.
    var showsRecipients: Bool {
        special == .sent || special == .drafts || special == .outbox
    }
}

extension SpecialFolder {
    var localizedName: String {
        switch self {
        case .inbox: String(localized: "Inbox")
        case .drafts: String(localized: "Drafts")
        case .sent: String(localized: "Sent Items")
        case .deleted: String(localized: "Deleted Items")
        case .archive: String(localized: "Archive")
        case .junk: String(localized: "Junk Email")
        case .outbox: String(localized: "Outbox")
        case .calendar: String(localized: "Calendar")
        case .contacts: String(localized: "Contacts")
        case .tasks: String(localized: "Tasks")
        case .notes: String(localized: "Notes")
        case .journal: String(localized: "Journal")
        case .syncIssues: String(localized: "Sync Issues")
        case .rss: String(localized: "RSS Feeds")
        }
    }

    var symbolName: String {
        switch self {
        case .inbox: "tray"
        case .drafts: "doc"
        case .sent: "paperplane"
        case .deleted: "trash"
        case .archive: "archivebox"
        case .junk: "xmark.bin"
        case .outbox: "tray.and.arrow.up"
        case .calendar: "calendar"
        case .contacts: "person.crop.circle"
        case .tasks: "checklist"
        case .notes: "note.text"
        case .journal: "book"
        case .syncIssues: "arrow.triangle.2.circlepath"
        case .rss: "dot.radiowaves.up.forward"
        }
    }

    /// Standard names of folders that are recognised by their type; a folder
    /// with another name keeps it.
    fileprivate var standardNames: Set<String>? {
        switch self {
        case .calendar: ["calendar", "kalender"]
        case .contacts: ["contacts", "kontakte"]
        case .tasks: ["tasks", "aufgaben"]
        case .notes: ["notes", "notizen"]
        case .journal: ["journal"]
        default: nil
        }
    }
}
