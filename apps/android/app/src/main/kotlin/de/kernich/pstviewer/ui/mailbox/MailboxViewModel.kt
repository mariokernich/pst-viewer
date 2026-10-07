package de.kernich.pstviewer.ui.mailbox

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.kernich.pstviewer.core.FolderInfo
import de.kernich.pstviewer.core.IndexProgress
import de.kernich.pstviewer.core.MessageDetail
import de.kernich.pstviewer.core.MessageRef
import de.kernich.pstviewer.core.MessageSummary
import de.kernich.pstviewer.core.OpenResult
import de.kernich.pstviewer.core.ResultGroup
import de.kernich.pstviewer.core.SearchFilters
import de.kernich.pstviewer.core.SearchRequest
import de.kernich.pstviewer.core.SenderSuggestion
import de.kernich.pstviewer.core.SortDir
import de.kernich.pstviewer.core.SortField
import de.kernich.pstviewer.core.SortSpec
import de.kernich.pstviewer.core.countActiveFilters
import de.kernich.pstviewer.core.defaultFilters
import de.kernich.pstviewer.core.foldForIndex
import de.kernich.pstviewer.core.hasActiveFilters
import de.kernich.pstviewer.data.AppSettings
import de.kernich.pstviewer.data.OpenArchive
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Calendar
import java.util.Locale

enum class SearchScope { ALL, FOLDER }

enum class BodyView { HTML, TEXT }

/** A search result whose summaries are loaded page by page. */
class SearchResult(
    val token: ULong,
    /** Identifies the query; a refresh of the same query keeps the known rows. */
    val signature: List<Any?>,
    val total: Int,
    val groups: List<ResultGroup>,
    val terms: List<String>,
    val isSearch: Boolean,
    private val items: Array<MessageSummary?>,
) {
    operator fun get(index: Int): MessageSummary? = items.getOrNull(index)

    fun withPage(start: Int, page: List<MessageSummary>): SearchResult {
        val copy = items.copyOf()
        page.forEachIndexed { i, summary -> if (start + i < copy.size) copy[start + i] = summary }
        return SearchResult(token, signature, total, groups, terms, isSearch, copy)
    }

    internal fun itemsSnapshot(): Array<MessageSummary?> = items
}

sealed interface DetailState {
    data object None : DetailState

    data object Loading : DetailState

    data class Loaded(val detail: MessageDetail) : DetailState

    data object Failed : DetailState
}

/** A sender with its folded name and address for suggestions. */
class FoldedSender(val sender: SenderSuggestion, val name: String, val email: String)

/**
 * State of the mailbox screen: folder, query, filters, sort, the paged result,
 * the selection and the message on display (port of the desktop store).
 */
class MailboxViewModel(private val archive: OpenArchive, private val settings: AppSettings) : ViewModel() {
    var info by mutableStateOf(archive.info.value)
        private set
    var tree by mutableStateOf(FolderTree(info.folders))
        private set
    var indexProgress by mutableStateOf(if (info.contentIndexed) null else IndexProgress(0u, info.store.itemCount, false))
        private set
    var senders by mutableStateOf(emptyList<FoldedSender>())
        private set

    var folderId by mutableStateOf(FolderTree.defaultFolder(info))
        private set
    var query by mutableStateOf("")
        private set
    var scope by mutableStateOf(SearchScope.ALL)
        private set
    var filters by mutableStateOf(defaultFilters())
        private set
    var activeFilters by mutableIntStateOf(0)
        private set
    var hasFilters by mutableStateOf(false)
        private set
    var sort by mutableStateOf(SortSpec(SortField.DATE, SortDir.DESC))
        private set
    var recentSearches by mutableStateOf(emptyList<String>())
        private set
    var expanded by mutableStateOf(tree.defaultExpanded)
        private set
    val showEmptyFolders = settings.showEmptyFolders

    var result by mutableStateOf<SearchResult?>(null)
        private set
    var searching by mutableStateOf(false)
        private set

    var selectedIndex by mutableIntStateOf(-1)
        private set
    var selectedId by mutableStateOf<UInt?>(null)
        private set
    var detail by mutableStateOf<DetailState>(DetailState.None)
        private set
    var bodyView by mutableStateOf(BodyView.HTML)

    /** Set once a single message (EML or MSG file) was selected automatically. */
    var openedSingleMessage by mutableStateOf(false)
        private set

    val remoteAllowed = archive.remoteAllowed

    val isSearching: Boolean get() = query.isNotBlank() || hasFilters

    val folder: FolderInfo? get() = tree[folderId]

    private var searchSeq = 0
    private var detailSeq = 0
    private var debounce: Job? = null
    private val requestedPages = HashSet<Int>()
    private val detailCache = object : LinkedHashMap<UInt, MessageDetail>(DETAIL_CACHE_SIZE, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<UInt, MessageDetail>?) = size > DETAIL_CACHE_SIZE
    }
    private var lastIndexRefresh = 0L
    private var autoSelectSingle = info.store.itemCount == 1u

    init {
        foldSenders(info)
        runSearch()
        prioritize()
        viewModelScope.launch {
            archive.indexProgress.collect { progress -> if (progress != null) onIndexProgress(progress) }
        }
    }

    // Folders

    fun selectFolder(id: UInt?) {
        // Choosing a folder while searching narrows the search to that folder.
        if (isSearching && id != null) scope = SearchScope.FOLDER
        folderId = id
        runSearch()
        prioritize()
    }

    fun toggleExpanded(id: UInt) {
        expanded = if (id in expanded) expanded - id else expanded + id
    }

    fun setShowEmptyFolders(show: Boolean) = settings.setShowEmptyFolders(show)

    private fun prioritize() {
        if (indexProgress == null) return
        val id = folderId
        viewModelScope.launch { runCatching { archive.call { it.prioritizeFolder(id) } } }
    }

    // Query, filters and sorting

    fun setQuery(text: String, immediate: Boolean = false) {
        query = text
        debounce?.cancel()
        if (immediate) {
            runSearch()
        } else {
            debounce = viewModelScope.launch {
                delay(SEARCH_DEBOUNCE_MS)
                runSearch()
            }
        }
    }

    /** Remembers the query as a recent search. */
    fun commitQuery() {
        val text = query.trim()
        if (text.isEmpty()) return
        recentSearches = (listOf(text) + recentSearches.filter { it != text }).take(MAX_RECENT_SEARCHES)
    }

    fun changeScope(scope: SearchScope) {
        this.scope = scope
        runSearch()
    }

    fun updateFilters(transform: (SearchFilters) -> SearchFilters) {
        applyFilters(transform(filters))
        runSearch()
    }

    fun resetFilters() = updateFilters { defaultFilters() }

    fun changeSort(sort: SortSpec) {
        this.sort = sort
        runSearch()
    }

    /** Messages from or to a person in all folders (person menu of the reading pane). */
    fun searchPerson(key: String, sender: Boolean) {
        query = ""
        scope = SearchScope.ALL
        updateFilters { it.copy(from = if (sender) key else "", to = if (sender) "" else key) }
    }

    private fun applyFilters(value: SearchFilters) {
        filters = value
        activeFilters = countActiveFilters(value).toInt()
        hasFilters = hasActiveFilters(value)
    }

    /** Senders matching typed text (suggestions). */
    fun matchingSenders(text: String, limit: Int = 5): List<SenderSuggestion> {
        val needle = foldForIndex(text)
        if (needle.isEmpty()) return emptyList()
        return senders.asSequence().filter { needle in it.name || needle in it.email }.take(limit).map { it.sender }.toList()
    }

    fun runSearch(silent: Boolean = false) {
        debounce?.cancel()
        val seq = ++searchSeq
        val searchingNow = isSearching
        val request = SearchRequest(
            text = query,
            folderId = if (searchingNow && scope == SearchScope.ALL) null else folderId,
            includeSubfolders = searchingNow,
            filters = filters,
            sort = sort,
            now = System.currentTimeMillis(),
            firstDayOfWeek = firstDayOfWeek(),
            pageSize = PAGE_SIZE.toUInt(),
        )
        val signature = listOf(request.text, request.folderId, request.includeSubfolders, request.filters, request.sort)
        if (!silent) searching = true
        viewModelScope.launch {
            val response = try {
                archive.call { it.search(request) }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                if (seq == searchSeq) searching = false
                return@launch
            }
            if (seq != searchSeq) return@launch
            requestedPages.clear()
            requestedPages.add(0)
            val total = response.total.toInt()
            val items = arrayOfNulls<MessageSummary>(total)
            // A refresh of the same query keeps the known rows until fresh pages arrive.
            val previous = result?.takeIf { silent && it.signature == signature }
            previous?.itemsSnapshot()?.copyInto(items, endIndex = minOf(total, previous.total))
            response.items.forEachIndexed { i, summary -> if (i < total) items[i] = summary }
            val id = selectedId
            var index = if (id == null) -1 else response.items.indexOfFirst { it.id == id }
            if (index < 0 && id != null && selectedIndex in 0 until total && items[selectedIndex]?.id == id) index = selectedIndex
            result = SearchResult(response.token, signature, total, response.groups, response.highlightTerms, response.isSearch, items)
            selectedIndex = index
            searching = false
            if (autoSelectSingle && total == 1) {
                autoSelectSingle = false
                openedSingleMessage = true
                select(0)
            }
        }
    }

    /** Loads the summaries of the rows [first]..[last] (item indices). */
    fun ensureRange(first: Int, last: Int) {
        val current = result ?: return
        if (current.total == 0) return
        val firstPage = maxOf(0, first / PAGE_SIZE)
        val lastPage = minOf((current.total - 1) / PAGE_SIZE, last / PAGE_SIZE)
        for (page in firstPage..lastPage) {
            if (!requestedPages.add(page)) continue
            val token = current.token
            viewModelScope.launch {
                val summaries = try {
                    archive.call { it.page(token, (page * PAGE_SIZE).toUInt(), PAGE_SIZE.toUInt()) }
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    null
                }
                val latest = result
                if (summaries == null || latest == null || latest.token != token) {
                    if (latest?.token == token) requestedPages.remove(page)
                    return@launch
                }
                val start = page * PAGE_SIZE
                result = latest.withPage(start, summaries)
                // Re-locate the selected message within the fresh page.
                val found = summaries.indexOfFirst { it.id == selectedId }
                if (found >= 0) {
                    selectedIndex = start + found
                } else if (selectedIndex in start until start + summaries.size) {
                    selectedIndex = -1
                }
            }
        }
    }

    // Selection and reading

    fun select(index: Int) {
        val current = result ?: return
        if (index !in 0 until current.total) return
        val cached = current[index]
        if (cached != null) {
            show(index, cached)
            return
        }
        viewModelScope.launch {
            val page = index / PAGE_SIZE
            val summaries = runCatching { archive.call { it.page(current.token, (page * PAGE_SIZE).toUInt(), PAGE_SIZE.toUInt()) } }.getOrNull()
            val latest = result
            if (summaries == null || latest == null || latest.token != current.token) return@launch
            requestedPages.add(page)
            result = latest.withPage(page * PAGE_SIZE, summaries)
            summaries.getOrNull(index - page * PAGE_SIZE)?.let { show(index, it) }
        }
    }

    private fun show(index: Int, summary: MessageSummary) {
        if (summary.id == selectedId && detail is DetailState.Loaded) {
            selectedIndex = index
            return
        }
        selectedIndex = index
        selectedId = summary.id
        bodyView = BodyView.HTML
        val seq = ++detailSeq
        detailCache[summary.id]?.let {
            detail = DetailState.Loaded(it)
            return
        }
        viewModelScope.launch {
            // Keep the previous message briefly to avoid flicker on fast navigation.
            val loading = launch {
                delay(LOADING_DELAY_MS)
                if (seq == detailSeq) detail = DetailState.Loading
            }
            try {
                val loaded = archive.call { it.message(MessageRef(summary.id, emptyList())) }
                detailCache[summary.id] = loaded
                if (seq == detailSeq) detail = DetailState.Loaded(loaded)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                if (seq == detailSeq) detail = DetailState.Failed
            } finally {
                loading.cancel()
            }
        }
    }

    fun moveSelection(delta: Int) {
        val current = result ?: return
        if (current.total == 0) return
        val next = if (selectedIndex < 0) {
            if (delta > 0) 0 else current.total - 1
        } else {
            (selectedIndex + delta).coerceIn(0, current.total - 1)
        }
        if (next != selectedIndex) select(next)
    }

    fun reloadDetail() {
        val id = selectedId ?: return
        detailCache.remove(id)
        selectedId = null
        select(selectedIndex)
    }

    /** Clears the selection (phone layout: back from the message to the list). */
    fun clearSelection() {
        detailSeq++
        selectedIndex = -1
        selectedId = null
        detail = DetailState.None
    }

    fun allowRemote(ref: MessageRef) = archive.allowRemote(ref)

    // Background indexing

    private fun onIndexProgress(progress: IndexProgress) {
        if (progress.finished) {
            // Bodies, attachments and addresses are now searchable.
            indexProgress = null
            lastIndexRefresh = System.currentTimeMillis()
            viewModelScope.launch {
                runCatching { archive.refreshInfo() }.onSuccess { refreshed ->
                    info = refreshed
                    tree = FolderTree(refreshed.folders)
                    foldSenders(refreshed)
                }
            }
            runSearch(silent = true)
            return
        }
        indexProgress = progress
        // Refresh the visible list now and then so previews fill in.
        val now = System.currentTimeMillis()
        if (now - lastIndexRefresh > INDEX_REFRESH_MS) {
            lastIndexRefresh = now
            runSearch(silent = true)
        }
    }

    private fun foldSenders(info: OpenResult) {
        viewModelScope.launch {
            senders = withContext(Dispatchers.Default) {
                info.senders.map { FoldedSender(it, foldForIndex(it.name), foldForIndex(it.email)) }
            }
        }
    }

    private fun firstDayOfWeek(): UByte = (Calendar.getInstance(Locale.getDefault(Locale.Category.FORMAT)).firstDayOfWeek - 1).toUByte()

    companion object {
        const val PAGE_SIZE = 100
        private const val DETAIL_CACHE_SIZE = 40
        private const val SEARCH_DEBOUNCE_MS = 160L
        private const val INDEX_REFRESH_MS = 2500L
        private const val LOADING_DELAY_MS = 120L
        private const val MAX_RECENT_SEARCHES = 8
    }
}
