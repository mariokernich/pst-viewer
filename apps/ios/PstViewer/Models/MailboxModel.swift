import Foundation
import Observation
import PstViewerCore

/// Selection in the sidebar: all items or a folder.
enum FolderSelection: Hashable {
    case all
    case folder(UInt32)
}

/// Where a search looks while a folder is selected.
enum SearchScope: Hashable {
    case all
    case folder
}

/// A folder with its visible subfolders.
struct FolderNode: Identifiable {
    let folder: FolderInfo
    let children: [FolderNode]

    var id: UInt32 { folder.id }
}

/// Internet headers of a message, shown in a sheet.
struct MessageHeaders: Identifiable {
    let id: MessageRef
    let text: String
}

/// The search result shown in the message list.
struct SearchResult {
    /// Identifies the query; a refresh of the same query keeps the list position.
    struct Signature: Hashable {
        let text: String
        let folderId: UInt32?
        let includeSubfolders: Bool
        let filters: SearchFilters
        let sort: SortSpec
    }

    let token: UInt64
    let signature: Signature
    let total: Int
    let groups: [ResultGroup]
    let highlightTerms: [String]
    let isSearch: Bool
}

/// An open archive: folders, search, the message list and the selection
/// (port of the desktop app's store).
@Observable
final class MailboxModel {
    private static let pageSize = 100
    private static let detailCacheSize = 40
    private static let recentSearchLimit = 8
    private static let searchDebounce = Duration.milliseconds(160)
    private static let indexRefreshInterval: TimeInterval = 2.5
    private static let emptyFoldersKey = "showsEmptyFolders"

    let connection: ArchiveConnection
    let toasts: Toasts

    private(set) var store: StoreInfo
    private(set) var folders: [FolderInfo]
    private(set) var foldersById: [UInt32: FolderInfo]
    private(set) var senders: [SenderSuggestion]
    /// Background indexing of bodies and attachments; nil when complete.
    private(set) var indexProgress: IndexProgress?

    var folderSelection: FolderSelection? {
        didSet { if folderSelection != oldValue { folderDidChange() } }
    }
    var expandedFolders: Set<UInt32>
    var showsEmptyFolders: Bool {
        didSet { UserDefaults.standard.set(showsEmptyFolders, forKey: Self.emptyFoldersKey) }
    }

    var query = "" {
        didSet { if query != oldValue { debounceSearch() } }
    }
    var scope = SearchScope.all {
        didSet { if scope != oldValue { searchSoon() } }
    }
    var filters = defaultFilters() {
        didSet { if filters != oldValue { searchSoon() } }
    }
    var sort = SortSpec(field: .date, dir: .desc) {
        didSet { if sort != oldValue { searchSoon() } }
    }
    private(set) var recentSearches: [String] = []

    private(set) var result: SearchResult?
    /// Loaded summaries of the result by row; pages are loaded as rows appear.
    private(set) var summaries: [Int: MessageSummary] = [:]
    private(set) var isSearching = false

    var selectedMessageID: UInt32? {
        didSet {
            guard selectedMessageID != oldValue else { return }
            readerPath = []
            if selectedMessageID == nil { displayedDetail = nil }
            updateSelectedIndex()
        }
    }
    private(set) var selectedIndex: Int?
    /// Attached messages opened in the reading view.
    var readerPath: [MessageRef] = []
    /// The message currently in front of the reading view, for menu commands.
    var displayedDetail: MessageDetail?
    private(set) var remoteAllowed: Set<MessageRef> = []

    var showsFilters = false
    var showsSearchSyntax = false
    /// Incremented to move the focus into the search field (⌘F).
    var searchFocusRequest = 0
    var presentedHeaders: MessageHeaders?
    var attachmentPreview: AttachmentPreviewModel?
    #if DEBUG
    /// An attachment the demo driver asks the reading view to preview.
    var demoAttachment: Int?
    #endif

    /// Keeps the archive's file or folder accessible while it is open.
    @ObservationIgnored private let access: SecurityScopedAccess
    @ObservationIgnored private var searchSequence = 0
    @ObservationIgnored private var debounceTask: Task<Void, Never>?
    @ObservationIgnored private var searchScheduled = false
    @ObservationIgnored private var requestedPages: Set<Int> = []
    @ObservationIgnored private var visibleRows: Set<Int> = []
    @ObservationIgnored private var lastIndexRefresh = Date.distantPast
    @ObservationIgnored private var selectSingleItem: Bool
    @ObservationIgnored private var details: [MessageRef: MessageDetail] = [:]
    @ObservationIgnored private var detailOrder: [MessageRef] = []
    @ObservationIgnored private var foldedSenders: [(name: String, email: String)]?

    init(connection: ArchiveConnection, info: OpenResult, access: SecurityScopedAccess, toasts: Toasts) {
        self.connection = connection
        self.access = access
        self.toasts = toasts
        store = info.store
        folders = info.folders
        foldersById = Dictionary(info.folders.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        senders = info.senders
        indexProgress = info.contentIndexed ? nil : IndexProgress(done: 0, total: info.store.itemCount, finished: false)
        showsEmptyFolders = UserDefaults.standard.bool(forKey: Self.emptyFoldersKey)
        expandedFolders = Self.defaultExpanded(info.folders)
        folderSelection = Self.defaultSelection(info.folders, format: info.store.format)
        // A single message (EML/MSG file) is shown right away.
        selectSingleItem = info.store.itemCount == 1
    }

    /// Starts listening to index progress and lists the first folder.
    func start() {
        connection.events.setHandler { [weak self] event in
            if case let .index(progress) = event { self?.handleIndexProgress(progress) }
        }
        connection.prioritizeFolder(folderId)
        runSearch()
    }

    func close() async {
        debounceTask?.cancel()
        await connection.close()
    }

    // MARK: Folders

    var folderId: UInt32? {
        if case let .folder(id) = folderSelection { return id }
        return nil
    }

    var selectedFolder: FolderInfo? {
        folderId.flatMap { foldersById[$0] }
    }

    func folder(_ id: UInt32?) -> FolderInfo? {
        id.flatMap { foldersById[$0] }
    }

    /// The folder tree; empty folders are hidden unless shown or selected.
    var folderTree: [FolderNode] {
        let children = Dictionary(grouping: folders) { folder in
            folder.parentId.flatMap { foldersById[$0] == nil ? nil : $0 }
        }
        let keep = folderId
        func nodes(_ parent: UInt32?) -> [FolderNode] {
            (children[parent] ?? []).compactMap { folder in
                let node = FolderNode(folder: folder, children: nodes(folder.id))
                let visible = showsEmptyFolders || folder.totalCount > 0 || folder.id == keep || !node.children.isEmpty
                return visible ? node : nil
            }
        }
        return nodes(nil)
    }

    private func folderDidChange() {
        // Choosing a folder while searching narrows the search to that folder.
        if isSearch, folderId != nil { scope = .folder }
        selectedMessageID = nil
        connection.prioritizeFolder(folderId)
        searchSoon()
    }

    private static func defaultSelection(_ folders: [FolderInfo], format: ArchiveFormat) -> FolderSelection {
        if let inbox = folders.first(where: { $0.special == .inbox && $0.itemCount > 0 }) { return .folder(inbox.id) }
        // Mail files spread over a directory tree are best shown all at once.
        if format == .folder { return .all }
        return folders.first(where: { $0.itemCount > 0 }).map { .folder($0.id) } ?? .all
    }

    private static func defaultExpanded(_ folders: [FolderInfo]) -> Set<UInt32> {
        let filled = Set(folders.filter { $0.totalCount > 0 }.compactMap(\.parentId))
        return Set(folders.filter { folder in
            folder.parentId == nil && filled.contains(folder.id) && folder.special != .contacts && folder.special != .syncIssues
        }.map(\.id))
    }

    // MARK: Search

    /// True while a query or filter restricts the list.
    var isSearch: Bool {
        !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || hasActiveFilters(filters: filters)
    }

    var activeFilterCount: Int {
        Int(countActiveFilters(filters: filters))
    }

    var highlightTerms: [String] {
        result?.highlightTerms ?? []
    }

    func resetFilters() {
        filters = defaultFilters()
    }

    /// Title of the message list: the folder, "All Items" or "Search Results".
    var listTitle: String {
        if isSearch { return String(localized: "Search Results") }
        return selectedFolder?.displayName ?? String(localized: "All Items")
    }

    /// "25 items · 3 unread" or "4 results".
    var listSummary: String {
        guard let result else { return "" }
        if isSearch { return String(localized: "\(result.total) results") }
        var text = String(localized: "\(result.total) items")
        if !isSearch, let unread = selectedFolder?.unreadCount, unread > 0 {
            text += " · " + String(localized: "\(Int(unread)) unread")
        }
        return text
    }

    /// Remembers the query for the suggestions.
    func commitQuery() {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        recentSearches = Array(([text] + recentSearches.filter { $0 != text }).prefix(Self.recentSearchLimit))
    }

    /// Senders whose name or address contains the folded text.
    func senders(matching needle: String, limit: Int) -> [SenderSuggestion] {
        let folded = foldedSenders ?? senders.map { (foldForIndex(text: $0.name), foldForIndex(text: $0.email)) }
        foldedSenders = folded
        var result: [SenderSuggestion] = []
        for (index, sender) in folded.enumerated() where sender.name.contains(needle) || sender.email.contains(needle) {
            result.append(senders[index])
            if result.count == limit { break }
        }
        return result
    }

    private func debounceSearch() {
        debounceTask?.cancel()
        debounceTask = Task {
            try? await Task.sleep(for: Self.searchDebounce)
            guard !Task.isCancelled else { return }
            runSearch()
        }
    }

    /// Runs one search after all changes of the current update.
    private func searchSoon() {
        debounceTask?.cancel()
        guard !searchScheduled else { return }
        searchScheduled = true
        Task {
            searchScheduled = false
            runSearch()
        }
    }

    /// Searches with the current state. A silent refresh (while indexing) keeps
    /// the known rows of the same query until fresh pages arrive.
    func runSearch(silent: Bool = false) {
        if !silent { debounceTask?.cancel() }
        searchSequence += 1
        let sequence = searchSequence
        let searching = isSearch
        let request = SearchRequest(
            text: query,
            folderId: searching && scope == .all ? nil : folderId,
            includeSubfolders: searching,
            filters: filters,
            sort: sort,
            now: Date.now.epochMillis,
            firstDayOfWeek: UInt8((Calendar.current.firstWeekday - 1) % 7),
            pageSize: UInt32(Self.pageSize)
        )
        let signature = SearchResult.Signature(
            text: request.text,
            folderId: request.folderId,
            includeSubfolders: request.includeSubfolders,
            filters: request.filters,
            sort: request.sort
        )
        if !silent { isSearching = true }
        Task {
            do {
                let response = try await connection.search(request)
                guard sequence == searchSequence else { return }
                apply(response, signature: signature, silent: silent)
            } catch {
                guard sequence == searchSequence else { return }
                isSearching = false
            }
        }
    }

    private func apply(_ response: SearchResponse, signature: SearchResult.Signature, silent: Bool) {
        let total = Int(response.total)
        let sameQuery = result?.signature == signature
        var rows = silent && sameQuery ? summaries.filter { $0.key < total } : [:]
        for (index, item) in response.items.enumerated() where index < total {
            rows[index] = item
        }
        requestedPages = [0]
        if !sameQuery { visibleRows = [] }
        result = SearchResult(
            token: response.token,
            signature: signature,
            total: total,
            groups: response.groups,
            highlightTerms: response.highlightTerms,
            isSearch: response.isSearch
        )
        summaries = rows
        isSearching = false
        updateSelectedIndex()
        // Reload the rows on screen so previews fill in while indexing.
        for page in Set(visibleRows.map { $0 / Self.pageSize }) where page != 0 {
            loadPage(page)
        }
        if selectSingleItem, total == 1, let first = response.items.first {
            selectSingleItem = false
            selectedMessageID = first.id
        }
    }

    // MARK: Paging

    func rowAppeared(_ index: Int) {
        guard let result, index < result.total else { return }
        visibleRows.insert(index)
        if summaries[index] == nil { loadPage(index / Self.pageSize) }
        // Load ahead so scrolling rarely shows placeholders.
        let ahead = index + Self.pageSize / 3
        if ahead < result.total, summaries[ahead] == nil { loadPage(ahead / Self.pageSize) }
    }

    func rowDisappeared(_ index: Int) {
        visibleRows.remove(index)
    }

    private func loadPage(_ page: Int) {
        guard let result, !requestedPages.contains(page) else { return }
        requestedPages.insert(page)
        Task {
            do {
                try await fetchPage(page, token: result.token)
            } catch {
                requestedPages.remove(page)
            }
        }
    }

    private func fetchPage(_ page: Int, token: UInt64) async throws {
        let start = page * Self.pageSize
        guard let page = try await connection.page(token: token, offset: start, limit: Self.pageSize),
              let result, result.token == token else { return }
        for (offset, summary) in page.enumerated() where start + offset < result.total {
            summaries[start + offset] = summary
        }
        updateSelectedIndex()
    }

    // MARK: Selection

    private func updateSelectedIndex() {
        let index = selectedMessageID.flatMap { id in summaries.first { $0.value.id == id }?.key }
        if index != selectedIndex { selectedIndex = index }
    }

    var canSelectPrevious: Bool {
        (selectedIndex ?? 0) > 0
    }

    var canSelectNext: Bool {
        guard let result else { return false }
        return (selectedIndex ?? -1) < result.total - 1
    }

    /// Selects the message `delta` rows away, loading its page if necessary.
    func moveSelection(by delta: Int) {
        guard let result, result.total > 0 else { return }
        let target = selectedIndex.map { min(result.total - 1, max(0, $0 + delta)) } ?? (delta > 0 ? 0 : result.total - 1)
        guard target != selectedIndex else { return }
        Task { await selectMessage(at: target) }
    }

    /// Selects the message at a row of the result, loading its page if necessary.
    func selectMessage(at index: Int) async {
        guard let result, index < result.total else { return }
        if summaries[index] == nil {
            try? await fetchPage(index / Self.pageSize, token: result.token)
        }
        guard let summary = summaries[index] else { return }
        selectedMessageID = summary.id
    }

    // MARK: Messages

    /// Details of a message, cached for quick navigation.
    func detail(for ref: MessageRef) async throws -> MessageDetail {
        if let cached = details[ref] { return cached }
        let detail = try await connection.message(ref)
        details[ref] = detail
        detailOrder.append(ref)
        if detailOrder.count > Self.detailCacheSize {
            details.removeValue(forKey: detailOrder.removeFirst())
        }
        return detail
    }

    func cachedDetail(for ref: MessageRef) -> MessageDetail? {
        details[ref]
    }

    func allowRemoteImages(for ref: MessageRef) {
        remoteAllowed.insert(ref)
    }

    func folderName(of detail: MessageDetail) -> String? {
        folder(detail.folderId)?.displayName
    }

    func export(of detail: MessageDetail) -> MessageExport {
        MessageExport(detail: detail, folderName: folderName(of: detail), allowRemote: remoteAllowed.contains(detail.messageRef))
    }

    /// True while a sheet covers the mailbox; message commands pause then.
    var isPresentingSheet: Bool {
        presentedHeaders != nil || attachmentPreview != nil || showsFilters || showsSearchSyntax
    }

    func showHeaders() {
        guard let detail = displayedDetail else { return }
        presentedHeaders = MessageHeaders(id: detail.messageRef, text: detail.headers)
    }

    func print(_ detail: MessageDetail) {
        let export = export(of: detail)
        Task {
            do {
                try await DocumentRenderer.print(html: export.printDocument, allowRemote: export.allowRemote, jobName: export.subject)
            } catch {
                toasts.show(String(localized: "Printing failed"), style: .failure)
            }
        }
    }

    func printDisplayed() {
        if let displayedDetail { print(displayedDetail) }
    }

    // MARK: Indexing

    private func handleIndexProgress(_ progress: IndexProgress) {
        guard indexProgress != nil else { return }
        if progress.finished {
            // Bodies, attachments and addresses are now searchable.
            indexProgress = nil
            lastIndexRefresh = .now
            Task {
                await refreshInfo()
                runSearch(silent: true)
            }
            return
        }
        indexProgress = progress
        // Refresh the list now and then so previews fill in.
        if Date.now.timeIntervalSince(lastIndexRefresh) > Self.indexRefreshInterval {
            lastIndexRefresh = .now
            runSearch(silent: true)
        }
    }

    private func refreshInfo() async {
        guard let info = try? await connection.info() else { return }
        store = info.store
        folders = info.folders
        foldersById = Dictionary(info.folders.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        senders = info.senders
        foldedSenders = nil
    }

    /// Percentage of indexed items, below 100 while indexing.
    var indexPercent: Int? {
        guard let progress = indexProgress, progress.total > 0 else { return nil }
        return min(99, Int(Double(progress.done) / Double(progress.total) * 100))
    }
}
