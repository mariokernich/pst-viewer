package de.kernich.pstviewer.ui.mailbox

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.ui.components.SymbolIcon
import de.kernich.pstviewer.ui.folderLabel
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.util.folderIcon
import de.kernich.pstviewer.util.formatLabel

/** Store card, "All Items" and the folder tree (desktop Sidebar). */
@Composable
fun FolderPane(viewModel: MailboxViewModel, showEmpty: Boolean, navigation: MailboxNavigation, onSelect: (UInt?) -> Unit) {
    val rows = remember(viewModel.tree, viewModel.expanded, showEmpty, viewModel.folderId) {
        viewModel.tree.rows(viewModel.expanded, showEmpty, viewModel.folderId)
    }
    LazyColumn(Modifier.windowInsetsPadding(WindowInsets.statusBars)) {
        item(key = "store") { StoreCard(viewModel, showEmpty, navigation) }
        item(key = "all") {
            val store = viewModel.info.store
            NavigationDrawerItem(
                label = {
                    Text(
                        stringResource(R.string.all_items),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        fontWeight = if (store.unreadCount > 0u) FontWeight.SemiBold else null,
                    )
                },
                icon = { Icon(painterResource(R.drawable.ic_all_inbox), contentDescription = null) },
                // Unread messages of the archive, each counted once even if it is in several folders (labels).
                badge = { CountBadge(store.itemCount, store.unreadCount) },
                selected = viewModel.folderId == null,
                onClick = { onSelect(null) },
                modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
            )
        }
        item(key = "header") {
            Text(
                stringResource(R.string.folders),
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(start = 28.dp, top = 16.dp, bottom = 8.dp)
                    .semantics { heading() },
            )
        }
        items(rows, key = { it.folder.id.toLong() }) { row ->
            FolderItem(row, selected = row.folder.id == viewModel.folderId, onSelect = { onSelect(row.folder.id) }, onToggle = { viewModel.toggleExpanded(row.folder.id) })
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun FolderItem(row: FolderRow, selected: Boolean, onSelect: () -> Unit, onToggle: () -> Unit) {
    val folder = row.folder
    val name = folderLabel(folder)
    val empty = folder.totalCount == 0u
    NavigationDrawerItem(
        label = {
            Text(
                name,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = if (empty && !selected) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                fontWeight = if (folder.unreadCount > 0u) FontWeight.SemiBold else null,
            )
        },
        icon = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.width((folder.depth.toInt() * 14).dp))
                Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
                    if (row.hasChildren) {
                        IconButton(onClick = onToggle, modifier = Modifier.size(28.dp)) {
                            Icon(
                                painterResource(R.drawable.ic_chevron_right),
                                contentDescription = stringResource(if (row.expanded) R.string.collapse_folder else R.string.expand_folder),
                                modifier = Modifier.size(20.dp).rotate(if (row.expanded) 90f else 0f),
                            )
                        }
                    }
                }
                Icon(
                    painterResource(folderIcon(folder)),
                    contentDescription = null,
                    tint = if (empty) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary,
                )
            }
        },
        badge = { CountBadge(folder.itemCount, folder.unreadCount) },
        selected = selected,
        onClick = onSelect,
        modifier = Modifier
            .padding(NavigationDrawerItemDefaults.ItemPadding)
            .height(48.dp),
    )
}

/** Unread count (emphasised) or else the number of items; read out with both. */
@Composable
private fun CountBadge(items: UInt, unread: UInt) {
    val format = rememberFormatter()
    val description = listOfNotNull(
        pluralStringResource(R.plurals.item_count, items.toInt(), format.number(items.toLong())),
        if (unread > 0u) stringResource(R.string.unread_count, format.number(unread.toLong())) else null,
    ).joinToString(", ")
    when {
        unread > 0u -> Text(
            format.number(unread.toLong()),
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.semantics { contentDescription = description },
        )
        items > 0u -> Text(
            format.number(items.toLong()),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.semantics { contentDescription = description },
        )
    }
}

@Composable
private fun StoreCard(viewModel: MailboxViewModel, showEmpty: Boolean, navigation: MailboxNavigation) {
    val format = rememberFormatter()
    val store = viewModel.info.store
    var menuOpen by remember { mutableStateOf(false) }
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 8.dp),
    ) {
        Column(Modifier.padding(start = 16.dp, top = 12.dp, bottom = 12.dp, end = 4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(store.fileName, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(
                        stringResource(formatLabel(store.format)),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        SymbolIcon(R.drawable.ic_lock, stringResource(R.string.read_only), Modifier.size(12.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        val details = listOfNotNull(
                            pluralStringResource(R.plurals.item_count, store.itemCount.toInt(), format.number(store.itemCount.toLong())),
                            store.fileSize.takeIf { it > 0 }?.let(format::size),
                        )
                        Text(details.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (store.dateMin != null && store.dateMax != null) {
                        Text(
                            stringResource(R.string.store_range, format.shortDate(store.dateMin), format.shortDate(store.dateMax)),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Box {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(painterResource(R.drawable.ic_more_vert), contentDescription = stringResource(R.string.file_info))
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.open_other_file)) },
                            leadingIcon = { Icon(painterResource(R.drawable.ic_file_open), null) },
                            onClick = {
                                menuOpen = false
                                navigation.openOtherFile()
                            },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(if (showEmpty) R.string.hide_empty_folders else R.string.show_empty_folders)) },
                            leadingIcon = { Icon(painterResource(if (showEmpty) R.drawable.ic_visibility_off else R.drawable.ic_visibility), null) },
                            onClick = {
                                menuOpen = false
                                viewModel.setShowEmptyFolders(!showEmpty)
                            },
                        )
                        HorizontalDivider()
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.close_file)) },
                            leadingIcon = { Icon(painterResource(R.drawable.ic_close), null) },
                            onClick = {
                                menuOpen = false
                                navigation.closeFile()
                            },
                        )
                    }
                }
            }
            viewModel.indexProgress?.takeIf { it.total > 0u }?.let { progress ->
                val percent = minOf(99, (progress.done.toLong() * 100 / progress.total.toLong()).toInt())
                Spacer(Modifier.height(10.dp))
                LinearProgressIndicator(
                    progress = { maxOf(0.03f, percent / 100f) },
                    modifier = Modifier.fillMaxWidth().padding(end = 12.dp).clip(CircleShape),
                )
                Text(
                    stringResource(R.string.indexing, percent),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/** Small filled container behind a count or label. */
@Composable
internal fun Pill(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSecondaryContainer,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(MaterialTheme.colorScheme.secondaryContainer)
            .padding(horizontal = 6.dp, vertical = 1.dp),
    )
}
