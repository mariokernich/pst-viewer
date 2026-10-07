package de.kernich.pstviewer.ui.search

import androidx.annotation.DrawableRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.text.input.clearText
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExpandedDockedSearchBar
import androidx.compose.material3.ExpandedFullScreenSearchBar
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SearchBarDefaults
import androidx.compose.material3.SearchBarValue
import androidx.compose.material3.Text
import androidx.compose.material3.TopSearchBar
import androidx.compose.material3.rememberSearchBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.ReadState
import de.kernich.pstviewer.core.foldForIndex
import de.kernich.pstviewer.ui.components.ActionIcon
import de.kernich.pstviewer.ui.folderLabel
import de.kernich.pstviewer.ui.mailbox.MailboxNavigation
import de.kernich.pstviewer.ui.mailbox.MailboxViewModel
import de.kernich.pstviewer.util.folderName
import kotlinx.coroutines.launch

private val WHITESPACE = Regex("\\s")

/**
 * Search field of the mailbox: searches as you type and suggests fields,
 * senders, folders, recent searches and quick filters (desktop SearchBox).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MailboxSearchBar(
    viewModel: MailboxViewModel,
    navigation: MailboxNavigation,
    drawerButton: Boolean,
    onOpenDrawer: () -> Unit,
    onOpenFilters: () -> Unit,
    searchRequested: Boolean,
    onSearchRequestHandled: () -> Unit,
    fullScreen: Boolean,
) {
    val state = rememberSearchBarState()
    val text = rememberTextFieldState(viewModel.query)
    val scope = rememberCoroutineScope()
    val expanded = state.targetValue == SearchBarValue.Expanded
    val keyboard = LocalSoftwareKeyboardController.current
    // The keyboard stays open otherwise when the field loses focus by collapsing.
    val collapse: () -> Unit = {
        keyboard?.hide()
        scope.launch { state.animateToCollapsed() }
    }

    // Typing searches; queries set elsewhere (suggestions, help, person menu) show up in the field.
    var typed by remember { mutableStateOf(viewModel.query) }
    LaunchedEffect(text) {
        snapshotFlow { text.text.toString() }.collect { value ->
            typed = value
            if (value != viewModel.query) viewModel.setQuery(value)
        }
    }
    LaunchedEffect(viewModel.query) {
        if (viewModel.query != typed) {
            typed = viewModel.query
            text.setTextAndPlaceCursorAtEnd(viewModel.query)
        }
    }
    LaunchedEffect(searchRequested) {
        if (searchRequested) {
            state.animateToExpanded()
            onSearchRequestHandled()
        }
    }

    val folder = viewModel.folder
    val placeholder = if (folder != null) stringResource(R.string.search_placeholder_in, folderLabel(folder)) else stringResource(R.string.search_placeholder)
    val inputField = @Composable {
        SearchBarDefaults.InputField(
            textFieldState = text,
            searchBarState = state,
            onSearch = {
                viewModel.commitQuery()
                viewModel.setQuery(it, immediate = true)
                collapse()
            },
            placeholder = { Text(placeholder, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            leadingIcon = {
                when {
                    expanded -> ActionIcon(R.drawable.ic_arrow_back, stringResource(R.string.back), collapse)
                    drawerButton -> ActionIcon(R.drawable.ic_menu, stringResource(R.string.show_folders), onOpenDrawer)
                    else -> Icon(painterResource(R.drawable.ic_search), contentDescription = null)
                }
            },
            trailingIcon = {
                Row {
                    if (text.text.isNotEmpty()) {
                        ActionIcon(R.drawable.ic_close, stringResource(R.string.clear_search), {
                            text.clearText()
                            viewModel.setQuery("", immediate = true)
                        })
                    }
                    if (!expanded) {
                        FilterButton(viewModel.activeFilters, onOpenFilters)
                        OverflowMenu(navigation)
                    }
                }
            },
        )
    }
    TopSearchBar(state = state, inputField = inputField)
    val suggestions = @Composable {
        Suggestions(
            viewModel = viewModel,
            text = text.text.toString(),
            onDone = collapse,
            onOpenHelp = {
                collapse()
                navigation.openSearchHelp()
            },
        )
    }
    if (fullScreen) {
        ExpandedFullScreenSearchBar(state = state, inputField = inputField) { suggestions() }
    } else {
        ExpandedDockedSearchBar(state = state, inputField = inputField) { suggestions() }
    }
}

@Composable
private fun FilterButton(active: Int, onClick: () -> Unit) {
    val label = stringResource(R.string.filters)
    IconButton(onClick = onClick) {
        BadgedBox(badge = { if (active > 0) Badge { Text(active.toString()) } }) {
            Icon(
                painterResource(R.drawable.ic_tune),
                contentDescription = if (active > 0) "$label, ${stringResource(R.string.filters_active, active)}" else label,
            )
        }
    }
}

@Composable
private fun OverflowMenu(navigation: MailboxNavigation) {
    var open by remember { mutableStateOf(false) }
    Box {
        ActionIcon(R.drawable.ic_more_vert, stringResource(R.string.more_options), { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            MenuItem(R.drawable.ic_help, R.string.search_syntax) {
                open = false
                navigation.openSearchHelp()
            }
            MenuItem(R.drawable.ic_file_open, R.string.open_other_file) {
                open = false
                navigation.openOtherFile()
            }
            MenuItem(R.drawable.ic_close, R.string.close_file) {
                open = false
                navigation.closeFile()
            }
            HorizontalDivider()
            MenuItem(R.drawable.ic_settings, R.string.settings) {
                open = false
                navigation.openSettings()
            }
        }
    }
}

@Composable
private fun MenuItem(@DrawableRes icon: Int, label: Int, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(stringResource(label)) },
        leadingIcon = { Icon(painterResource(icon), contentDescription = null) },
        onClick = onClick,
    )
}

/** A suggestion row: section, icon, label, optional detail, action. */
private class Suggestion(val section: String, @param:DrawableRes val icon: Int, val label: String, val detail: String?, val run: () -> Unit)

@Composable
private fun Suggestions(viewModel: MailboxViewModel, text: String, onDone: () -> Unit, onOpenHelp: () -> Unit) {
    val resources = LocalResources.current
    val trimmed = text.trim()
    val folderNames = remember(viewModel.tree, resources) {
        viewModel.tree.folders.filter { it.totalCount > 0u }.map { it to folderName(it, resources) }.map { (folder, name) -> Triple(folder, name, foldForIndex(name)) }
    }
    val suggestions = ArrayList<Suggestion>()
    if (trimmed.isEmpty()) {
        val recentSection = stringResource(R.string.suggestions_recent)
        viewModel.recentSearches.take(5).forEach { recent ->
            suggestions += Suggestion(recentSection, R.drawable.ic_history, recent, null) {
                viewModel.setQuery(recent, immediate = true)
                onDone()
            }
        }
        val quick = stringResource(R.string.suggestions_quick)
        suggestions += Suggestion(quick, R.drawable.ic_mark_email_unread, stringResource(R.string.read_unread), null) {
            viewModel.updateFilters { it.copy(readState = ReadState.UNREAD) }
            onDone()
        }
        suggestions += Suggestion(quick, R.drawable.ic_attach_file, stringResource(R.string.flag_has_attachments), null) {
            viewModel.updateFilters { it.copy(hasAttachments = true) }
            onDone()
        }
        suggestions += Suggestion(quick, R.drawable.ic_priority_high, stringResource(R.string.flag_important), null) {
            viewModel.updateFilters { it.copy(important = true) }
            onDone()
        }
        suggestions += Suggestion(quick, R.drawable.ic_help, stringResource(R.string.search_syntax), null, onOpenHelp)
    } else {
        // Only suggest for plain words, not when the user already typed syntax.
        val plain = ':' !in trimmed && '"' !in trimmed
        val quoted = if (WHITESPACE.containsMatchIn(trimmed)) "\"$trimmed\"" else trimmed
        val searchIn = stringResource(R.string.suggestions_search_in)
        suggestions += Suggestion(searchIn, R.drawable.ic_manage_search, stringResource(R.string.search_all, trimmed), null) {
            viewModel.commitQuery()
            viewModel.setQuery(text, immediate = true)
            onDone()
        }
        if (plain) {
            listOf(
                Triple(R.string.field_subject, R.string.search_prefix_subject, R.drawable.ic_manage_search),
                Triple(R.string.field_from, R.string.search_prefix_from, R.drawable.ic_alternate_email),
                Triple(R.string.field_body, R.string.search_prefix_body, R.drawable.ic_manage_search),
            ).forEach { (field, prefix, icon) ->
                val query = "${stringResource(prefix)}:$quoted"
                suggestions += Suggestion(searchIn, icon, stringResource(R.string.search_in, trimmed, stringResource(field)), query) {
                    viewModel.setQuery(query, immediate = true)
                    viewModel.commitQuery()
                    onDone()
                }
            }
            val senders = stringResource(R.string.suggestions_senders)
            viewModel.matchingSenders(trimmed).forEach { sender ->
                val label = sender.name.ifEmpty { sender.email }
                suggestions += Suggestion(senders, R.drawable.ic_alternate_email, label, sender.email.takeIf { sender.name.isNotEmpty() && it.isNotEmpty() }) {
                    viewModel.setQuery("")
                    viewModel.updateFilters { it.copy(from = sender.email.ifEmpty { sender.name }) }
                    onDone()
                }
            }
            val needle = foldForIndex(trimmed)
            val folders = stringResource(R.string.suggestions_folders)
            folderNames.filter { needle in it.third }.take(3).forEach { (folder, name, _) ->
                suggestions += Suggestion(folders, R.drawable.ic_folder_open, stringResource(R.string.suggestion_folder, name), null) {
                    viewModel.setQuery("")
                    viewModel.selectFolder(folder.id)
                    onDone()
                }
            }
        }
    }
    LazyColumn(Modifier.fillMaxWidth()) { suggestionItems(suggestions) }
}

private fun LazyListScope.suggestionItems(suggestions: List<Suggestion>) {
    var section: String? = null
    suggestions.forEachIndexed { index, suggestion ->
        if (suggestion.section != section) {
            section = suggestion.section
            item(key = "section-$index") {
                Text(
                    suggestion.section,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp).semantics { heading() },
                )
            }
        }
        item(key = "suggestion-$index") {
            ListItem(
                headlineContent = { Text(suggestion.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                supportingContent = suggestion.detail?.let { { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
                leadingContent = { Icon(painterResource(suggestion.icon), contentDescription = null) },
                colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                modifier = Modifier.clickable(onClick = suggestion.run),
            )
        }
    }
}
