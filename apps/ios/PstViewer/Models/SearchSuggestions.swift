import Foundation
import PstViewerCore

/// A suggestion below the search field (port of the desktop app's search box).
struct SearchSuggestion: Identifiable {
    enum Section: CaseIterable {
        case recent
        case quickFilters
        case searchIn
        case senders
        case folders

        var title: String {
            switch self {
            case .recent: String(localized: "Recent Searches")
            case .quickFilters: String(localized: "Quick Filters")
            case .searchIn: String(localized: "Search in")
            case .senders: String(localized: "Senders")
            case .folders: String(localized: "Folders")
            }
        }
    }

    enum Action {
        /// Replaces the query and searches right away.
        case search(String)
        case unread
        case hasAttachments
        case important
        case sender(String)
        case folder(UInt32)
    }

    let id: String
    let section: Section
    let symbol: String
    let title: String
    var detail: String?
    let action: Action
}

extension MailboxModel {
    /// Suggestions for the current query: recent searches and quick filters while
    /// the field is empty, otherwise fields, senders and folders.
    func suggestions() -> [SearchSuggestion] {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            let recent = recentSearches.prefix(5).map {
                SearchSuggestion(id: "recent-\($0)", section: .recent, symbol: "clock.arrow.circlepath", title: $0, action: .search($0))
            }
            return recent + [
                SearchSuggestion(id: "quick-unread", section: .quickFilters, symbol: "envelope.badge", title: ReadState.unread.label, action: .unread),
                SearchSuggestion(id: "quick-attachments", section: .quickFilters, symbol: "paperclip", title: String(localized: "Has attachments"), action: .hasAttachments),
                SearchSuggestion(id: "quick-important", section: .quickFilters, symbol: "exclamationmark.triangle", title: String(localized: "Important"), action: .important),
            ]
        }

        var result = [
            SearchSuggestion(id: "all", section: .searchIn, symbol: "text.magnifyingglass", title: String(localized: "Search for “\(text)” in all fields"), action: .search(query)),
        ]
        // Only suggest for plain words, not when the query already uses the syntax.
        guard !text.contains(":"), !text.contains("\"") else { return result }
        let quoted = text.contains(where: \.isWhitespace) ? "\"\(text)\"" : text
        for field in [SearchField.subject, .from, .body] {
            let fieldQuery = "\(field.queryPrefix):\(quoted)"
            result.append(SearchSuggestion(
                id: "field-\(field.queryPrefix)",
                section: .searchIn,
                symbol: field == .from ? "at" : "text.magnifyingglass",
                title: String(localized: "“\(text)” in \(field.label) only"),
                detail: fieldQuery,
                action: .search(fieldQuery)
            ))
        }

        let needle = foldForIndex(text: text)
        for sender in senders(matching: needle, limit: 5) {
            let key = sender.email.isEmpty ? sender.name : sender.email
            result.append(SearchSuggestion(
                id: "sender-\(key)",
                section: .senders,
                symbol: "at",
                title: sender.name.isEmpty ? sender.email : sender.name,
                detail: sender.name.isEmpty ? nil : sender.email,
                action: .sender(key)
            ))
        }

        let matchingFolders = folders.lazy
            .filter { $0.totalCount > 0 && foldForIndex(text: $0.displayName).contains(needle) }
            .prefix(3)
        for folder in matchingFolders {
            result.append(SearchSuggestion(
                id: "folder-\(folder.id)",
                section: .folders,
                symbol: "folder",
                title: String(localized: "Go to folder “\(folder.displayName)”"),
                action: .folder(folder.id)
            ))
        }
        return result
    }

    func apply(_ suggestion: SearchSuggestion) {
        switch suggestion.action {
        case let .search(text):
            query = text
            commitQuery()
            runSearch()
        case .unread:
            filters.readState = .unread
        case .hasAttachments:
            filters.hasAttachments = true
        case .important:
            filters.important = true
        case let .sender(key):
            query = ""
            filters.from = key
        case let .folder(id):
            query = ""
            folderSelection = .folder(id)
        }
    }
}
