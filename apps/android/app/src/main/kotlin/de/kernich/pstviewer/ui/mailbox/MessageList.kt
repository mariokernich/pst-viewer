package de.kernich.pstviewer.ui.mailbox

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.DateGroup
import de.kernich.pstviewer.core.SortDir
import de.kernich.pstviewer.core.SortField
import de.kernich.pstviewer.core.SortSpec
import de.kernich.pstviewer.ui.components.ActionIcon
import de.kernich.pstviewer.ui.components.EmptyState
import de.kernich.pstviewer.ui.folderLabel
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.ui.search.FilterChipsRow
import de.kernich.pstviewer.ui.search.MailboxSearchBar
import de.kernich.pstviewer.util.Formatter
import de.kernich.pstviewer.util.isOutgoing
import de.kernich.pstviewer.util.sortFieldLabel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged

/** Search bar, filter chips, list header and the virtualised, date grouped message list. */
@Composable
fun MessageListPane(
    viewModel: MailboxViewModel,
    navigation: MailboxNavigation,
    drawerButton: Boolean,
    onOpenDrawer: () -> Unit,
    onOpenFilters: () -> Unit,
    searchRequested: Boolean,
    onSearchRequestHandled: () -> Unit,
    fullScreenSearch: Boolean,
    highlightSelection: Boolean,
    onOpenMessage: (Int) -> Unit,
) {
    Scaffold(
        topBar = {
            MailboxSearchBar(
                viewModel = viewModel,
                navigation = navigation,
                drawerButton = drawerButton,
                onOpenDrawer = onOpenDrawer,
                onOpenFilters = onOpenFilters,
                searchRequested = searchRequested,
                onSearchRequestHandled = onSearchRequestHandled,
                fullScreen = fullScreenSearch,
            )
        },
        contentWindowInsets = WindowInsets(0),
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            FilterChipsRow(viewModel, Modifier.padding(top = 4.dp, bottom = 4.dp))
            ListHeader(viewModel)
            SearchProgress(viewModel.searching)
            val result = viewModel.result
            when {
                result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                result.total == 0 -> EmptyList(viewModel, Modifier.fillMaxSize())
                else -> MessageList(viewModel, result, highlightSelection, onOpenMessage)
            }
        }
    }
}

@Composable
private fun ListHeader(viewModel: MailboxViewModel) {
    val format = rememberFormatter()
    val folder = viewModel.folder
    val searching = viewModel.isSearching
    val title = when {
        searching -> stringResource(R.string.search_results)
        folder != null -> folderLabel(folder)
        else -> stringResource(R.string.all_items)
    }
    val result = viewModel.result
    val summary = when {
        result == null -> ""
        result.isSearch -> pluralStringResource(R.plurals.result_count, result.total, format.number(result.total.toLong()))
        else -> pluralStringResource(R.plurals.item_count, result.total, format.number(result.total.toLong()))
    }
    // "All items" counts each unread message once, also when it is in several folders (labels).
    val unreadCount = if (searching) 0u else folder?.unreadCount ?: viewModel.info.store.unreadCount
    val unread = if (unreadCount > 0u) stringResource(R.string.unread_count, format.number(unreadCount.toLong())) else null
    Column(Modifier.padding(start = 20.dp, end = 8.dp, top = 4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    listOfNotNull(summary, unread).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            SortButton(viewModel.sort, viewModel::changeSort)
        }
        if (searching) {
            viewModel.indexProgress?.takeIf { it.total > 0u }?.let { progress ->
                val percent = minOf(99, (progress.done.toLong() * 100 / progress.total.toLong()).toInt())
                Surface(
                    color = MaterialTheme.colorScheme.surfaceContainerHigh,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.padding(top = 8.dp, end = 12.dp),
                ) {
                    Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(10.dp))
                        Text(stringResource(R.string.indexing_hint, percent), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            val scopeFolder = viewModel.folder
            if (scopeFolder != null) {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(top = 8.dp, end = 12.dp)) {
                    SegmentedButton(
                        selected = viewModel.scope == SearchScope.ALL,
                        onClick = { viewModel.changeScope(SearchScope.ALL) },
                        shape = SegmentedButtonDefaults.itemShape(0, 2),
                    ) { Text(stringResource(R.string.scope_all), maxLines = 1, overflow = TextOverflow.Ellipsis) }
                    SegmentedButton(
                        selected = viewModel.scope == SearchScope.FOLDER,
                        onClick = { viewModel.changeScope(SearchScope.FOLDER) },
                        shape = SegmentedButtonDefaults.itemShape(1, 2),
                    ) { Text(folderLabel(scopeFolder), maxLines = 1, overflow = TextOverflow.Ellipsis) }
                }
            }
        }
    }
}

@Composable
private fun SortButton(sort: SortSpec, onSort: (SortSpec) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        ActionIcon(R.drawable.ic_swap_vert, stringResource(R.string.sort_by_field, stringResource(sortFieldLabel(sort.field))), { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Text(
                stringResource(R.string.sort_by),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
            SortField.entries.forEach { field ->
                CheckItem(stringResource(sortFieldLabel(field)), sort.field == field) {
                    open = false
                    onSort(SortSpec(field, if (field == SortField.DATE || field == SortField.SIZE) SortDir.DESC else SortDir.ASC))
                }
            }
            HorizontalDivider()
            CheckItem(stringResource(if (sort.field == SortField.DATE) R.string.sort_newest else R.string.sort_desc), sort.dir == SortDir.DESC) {
                open = false
                onSort(sort.copy(dir = SortDir.DESC))
            }
            CheckItem(stringResource(if (sort.field == SortField.DATE) R.string.sort_oldest else R.string.sort_asc), sort.dir == SortDir.ASC) {
                open = false
                onSort(sort.copy(dir = SortDir.ASC))
            }
        }
    }
}

@Composable
private fun CheckItem(label: String, checked: Boolean, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(label) },
        trailingIcon = { if (checked) Icon(painterResource(R.drawable.ic_check), contentDescription = null) },
        onClick = onClick,
        modifier = Modifier.semantics { selected = checked },
    )
}

/** A thin progress bar while a search takes longer than a moment. */
@Composable
private fun SearchProgress(searching: Boolean) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(searching) {
        if (searching) {
            delay(200)
            visible = true
        } else {
            visible = false
        }
    }
    Box(Modifier.fillMaxWidth().height(2.dp)) {
        AnimatedVisibility(visible) { LinearProgressIndicator(Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun EmptyList(viewModel: MailboxViewModel, modifier: Modifier) {
    val searching = viewModel.isSearching
    Box(modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)), contentAlignment = Alignment.Center) {
        if (searching) {
            EmptyState(
                icon = R.drawable.ic_search_off,
                title = stringResource(R.string.no_results),
                text = stringResource(R.string.no_results_hint),
            ) {
                if (viewModel.scope == SearchScope.FOLDER && viewModel.folderId != null) {
                    OutlinedButton(onClick = { viewModel.changeScope(SearchScope.ALL) }) { Text(stringResource(R.string.search_everywhere)) }
                }
                TextButton(onClick = viewModel::resetFilters) { Text(stringResource(R.string.reset_filters)) }
            }
        } else {
            EmptyState(icon = R.drawable.ic_inbox, title = stringResource(R.string.empty_folder), text = stringResource(R.string.empty_folder_hint))
        }
    }
}

/** Index of the list row (group headers included) that shows the item [index]. */
private fun rowOf(result: SearchResult, index: Int): Int {
    if (result.groups.isEmpty()) return index
    val group = result.groups.indexOfLast { it.start.toInt() <= index }
    return index + group + 1
}

@Composable
private fun MessageList(viewModel: MailboxViewModel, result: SearchResult, highlightSelection: Boolean, onOpenMessage: (Int) -> Unit) {
    val format = rememberFormatter()
    val state = rememberLazyListState()
    val folders = viewModel.tree
    val showFolder = result.isSearch

    // A new query starts at the top.
    LaunchedEffect(result.signature) { state.scrollToItem(0) }
    // Load the summaries of the rows on screen (and a few more).
    LaunchedEffect(state, result.token) {
        snapshotFlow { state.layoutInfo.visibleItemsInfo.mapNotNull { it.key as? Int } }
            .distinctUntilChanged()
            .collect { keys -> if (keys.isNotEmpty()) viewModel.ensureRange(keys.min(), keys.max() + PREFETCH) }
    }
    // Keep the selection visible during keyboard navigation.
    LaunchedEffect(viewModel.selectedIndex) { scrollIntoView(state, result, viewModel.selectedIndex) }

    val groupLabels = groupLabels(result, format)
    LazyColumn(
        state = state,
        contentPadding = WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom).asPaddingValues(),
        modifier = Modifier.fillMaxSize(),
    ) {
        fun rows(start: Int, count: Int) {
            items(count, key = { start + it }, contentType = { "message" }) { offset ->
                val index = start + offset
                val summary = result[index]
                if (summary == null) {
                    PlaceholderRow()
                } else {
                    val folder = folders[summary.folderId]
                    MessageRow(
                        summary = summary,
                        selected = highlightSelection && index == viewModel.selectedIndex,
                        terms = result.terms,
                        folderName = if (showFolder) folder?.let { folderLabel(it) } else null,
                        outgoing = isOutgoing(folder),
                        onClick = { onOpenMessage(index) },
                    )
                }
            }
        }
        if (result.groups.isEmpty()) {
            rows(0, result.total)
        } else {
            result.groups.forEachIndexed { g, group ->
                stickyHeader(key = "group-$g", contentType = "group") { GroupHeader(groupLabels[g], group.count.toInt()) }
                rows(group.start.toInt(), group.count.toInt())
            }
        }
    }
}

private suspend fun scrollIntoView(state: LazyListState, result: SearchResult, index: Int) {
    if (index < 0 || index >= result.total) return
    val row = rowOf(result, index)
    val visible = state.layoutInfo.visibleItemsInfo
    if (visible.isEmpty()) return
    val first = visible.first().index
    val last = visible.last().index
    if (row <= first || row >= last) state.animateScrollToItem(maxOf(0, row - 1))
}

@Composable
private fun groupLabels(result: SearchResult, format: Formatter): List<String> {
    val today = stringResource(R.string.group_today)
    val yesterday = stringResource(R.string.group_yesterday)
    val thisWeek = stringResource(R.string.group_this_week)
    val lastWeek = stringResource(R.string.group_last_week)
    val thisMonth = stringResource(R.string.group_this_month)
    val unknown = stringResource(R.string.group_unknown)
    return remember(result.groups, format, today) {
        result.groups.map {
            when (val group = it.group) {
                DateGroup.Today -> today
                DateGroup.Yesterday -> yesterday
                DateGroup.ThisWeek -> thisWeek
                DateGroup.LastWeek -> lastWeek
                DateGroup.ThisMonth -> thisMonth
                is DateGroup.Month -> format.month(group.year, group.month.toInt())
                DateGroup.Unknown -> unknown
            }
        }
    }
}

@Composable
private fun GroupHeader(label: String, count: Int) {
    val format = rememberFormatter()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 6.dp)
            .semantics(mergeDescendants = true) { heading() },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.weight(1f))
        Text(format.number(count.toLong()), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun PlaceholderRow() {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(20.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh))
        Spacer(Modifier.width(16.dp))
        Column(Modifier.weight(1f)) {
            listOf(0.4f, 0.75f, 0.9f).forEach { width ->
                Box(
                    Modifier
                        .padding(vertical = 4.dp)
                        .fillMaxWidth(width)
                        .height(10.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                )
            }
        }
    }
}

private const val PREFETCH = 20
