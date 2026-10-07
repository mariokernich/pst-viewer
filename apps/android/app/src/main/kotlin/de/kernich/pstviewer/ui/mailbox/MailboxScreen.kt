package de.kernich.pstviewer.ui.mailbox

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.PermanentDrawerSheet
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.WindowAdaptiveInfo
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.layout.AnimatedPane
import androidx.compose.material3.adaptive.layout.ListDetailPaneScaffoldRole
import androidx.compose.material3.adaptive.layout.PaneAdaptedValue
import androidx.compose.material3.adaptive.layout.PaneScaffoldDirective
import androidx.compose.material3.adaptive.layout.calculatePaneScaffoldDirective
import androidx.compose.material3.adaptive.navigation.NavigableListDetailPaneScaffold
import androidx.compose.material3.adaptive.navigation.rememberListDetailPaneScaffoldNavigator
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isAltPressed
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import de.kernich.pstviewer.core.AttachmentInfo
import de.kernich.pstviewer.core.MessageRef
import de.kernich.pstviewer.ui.MainViewModel
import de.kernich.pstviewer.ui.Route
import de.kernich.pstviewer.ui.message.ReadingPane
import de.kernich.pstviewer.ui.search.FilterSheet
import kotlinx.coroutines.launch

/**
 * The default pane layout for the window, without moving the focus into a pane
 * when it is shown: in the list that would open the search field and the keyboard.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
private fun paneDirective(adaptiveInfo: WindowAdaptiveInfo): PaneScaffoldDirective {
    val defaults = calculatePaneScaffoldDirective(adaptiveInfo)
    return PaneScaffoldDirective(
        maxHorizontalPartitions = defaults.maxHorizontalPartitions,
        horizontalPartitionSpacerSize = defaults.horizontalPartitionSpacerSize,
        maxVerticalPartitions = defaults.maxVerticalPartitions,
        verticalPartitionSpacerSize = defaults.verticalPartitionSpacerSize,
        defaultPanePreferredWidth = defaults.defaultPanePreferredWidth,
        defaultPanePreferredHeight = defaults.defaultPanePreferredHeight,
        excludedBounds = defaults.excludedBounds,
        shouldAutoFocusCurrentDestination = false,
    )
}

/** Navigation requests of the mailbox to the rest of the app. */
class MailboxNavigation(
    val openSettings: () -> Unit,
    val openSearchHelp: () -> Unit,
    val openAttachments: (MessageRef, List<AttachmentInfo>, Int) -> Unit,
    val openAttachedMessage: (MessageRef) -> Unit,
    val openOtherFile: () -> Unit,
    val closeFile: () -> Unit,
)

/**
 * Folders, message list and reading pane, adapted to the window: phones show
 * one pane at a time with the folders in a drawer; wide windows show list and
 * message side by side, very wide ones the folders as well.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun MailboxScreen(main: MainViewModel, viewModel: MailboxViewModel, archive: Long) {
    val navigation = remember(main, archive) {
        MailboxNavigation(
            openSettings = { main.navigate(Route.Settings) },
            openSearchHelp = { main.navigate(Route.SearchHelp) },
            openAttachments = { ref, attachments, start -> main.navigate(Route.Attachments(archive, ref, attachments, start)) },
            openAttachedMessage = { ref -> main.navigate(Route.AttachedMessage(archive, ref)) },
            openOtherFile = { main.requestOpen(folder = false) },
            closeFile = main::closeArchive,
        )
    }
    val adaptiveInfo = currentWindowAdaptiveInfoV2()
    val permanentFolders = adaptiveInfo.windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_LARGE_LOWER_BOUND)
    val navigator = rememberListDetailPaneScaffoldNavigator(scaffoldDirective = paneDirective(adaptiveInfo))
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var filtersOpen by rememberSaveable { mutableStateOf(false) }
    // Set by the search shortcut until the search bar has expanded (it may first have to return to the list).
    var searchRequested by remember { mutableStateOf(false) }
    var foldersHidden by rememberSaveable { mutableStateOf(false) }

    val singlePane = navigator.scaffoldDirective.maxHorizontalPartitions == 1
    val detailVisible = navigator.scaffoldValue[ListDetailPaneScaffoldRole.Detail] == PaneAdaptedValue.Expanded

    fun openMessage(index: Int) {
        viewModel.select(index)
        if (singlePane) scope.launch { navigator.navigateTo(ListDetailPaneScaffoldRole.Detail) }
    }

    // A single message (EML/MSG file) opens right away.
    LaunchedEffect(viewModel.openedSingleMessage) {
        if (viewModel.openedSingleMessage && singlePane && !detailVisible) navigator.navigateTo(ListDetailPaneScaffoldRole.Detail)
    }
    // An example picked in the search syntax help.
    main.pendingQuery?.let { query ->
        LaunchedEffect(query) {
            viewModel.setQuery(query, immediate = true)
            viewModel.commitQuery()
            main.pendingQuery = null
        }
    }
    // Back on the list first ends a search.
    BackHandler(enabled = viewModel.isSearching && !(singlePane && detailVisible) && drawerState.isClosed) {
        if (viewModel.query.isNotEmpty()) viewModel.setQuery("", immediate = true) else viewModel.resetFilters()
    }

    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    val shortcuts = Modifier
        .focusRequester(focus)
        .focusable()
        .onKeyEvent { event ->
            if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
            val command = event.isCtrlPressed || event.isMetaPressed
            when {
                command && event.isAltPressed && event.key == Key.F -> filtersOpen = true
                command && event.key == Key.F || event.key == Key.Slash -> {
                    searchRequested = true
                    if (singlePane && detailVisible) scope.launch { navigator.navigateBack() }
                }
                command && event.isShiftPressed && event.key == Key.S -> foldersHidden = !foldersHidden
                command && event.isShiftPressed && event.key == Key.W -> main.closeArchive()
                command && event.key == Key.O -> main.requestOpen(folder = event.isShiftPressed)
                event.key == Key.DirectionDown || event.key == Key.J -> viewModel.moveSelection(1)
                event.key == Key.DirectionUp || event.key == Key.K -> viewModel.moveSelection(-1)
                event.key == Key.PageDown -> viewModel.moveSelection(10)
                event.key == Key.PageUp -> viewModel.moveSelection(-10)
                event.key == Key.Enter && singlePane && viewModel.selectedIndex >= 0 -> openMessage(viewModel.selectedIndex)
                else -> return@onKeyEvent false
            }
            true
        }

    val showEmpty by viewModel.showEmptyFolders.collectAsState()
    val folderPane = @Composable { modal: Boolean ->
        FolderPane(
            viewModel = viewModel,
            showEmpty = showEmpty,
            navigation = navigation,
            onSelect = { id ->
                viewModel.selectFolder(id)
                if (modal) scope.launch { drawerState.close() }
                if (singlePane && detailVisible) scope.launch { navigator.navigateBack() }
            },
        )
    }

    val listDetail = @Composable {
        NavigableListDetailPaneScaffold(
            navigator = navigator,
            listPane = {
                AnimatedPane {
                    MessageListPane(
                        viewModel = viewModel,
                        navigation = navigation,
                        drawerButton = !permanentFolders || foldersHidden,
                        onOpenDrawer = {
                            if (permanentFolders) foldersHidden = false else scope.launch { drawerState.open() }
                        },
                        onOpenFilters = { filtersOpen = true },
                        searchRequested = searchRequested,
                        onSearchRequestHandled = { searchRequested = false },
                        fullScreenSearch = singlePane,
                        highlightSelection = !singlePane || !detailVisible,
                        onOpenMessage = ::openMessage,
                    )
                }
            },
            detailPane = {
                AnimatedPane {
                    ReadingPane(
                        main = main,
                        viewModel = viewModel,
                        navigation = navigation,
                        showBack = singlePane,
                        onBack = { scope.launch { navigator.navigateBack() } },
                    )
                }
            },
        )
    }

    if (permanentFolders) {
        Row(Modifier.fillMaxSize().then(shortcuts)) {
            if (!foldersHidden) {
                PermanentDrawerSheet(Modifier.width(300.dp).fillMaxHeight()) { folderPane(false) }
                VerticalDivider()
            }
            listDetail()
        }
    } else {
        ModalNavigationDrawer(
            drawerState = drawerState,
            gesturesEnabled = drawerState.isOpen,
            // With the drawer state, back (and predictive back) closes the drawer first.
            drawerContent = { ModalDrawerSheet(drawerState, Modifier.width(320.dp)) { folderPane(true) } },
            modifier = Modifier.fillMaxSize().then(shortcuts),
        ) {
            listDetail()
        }
    }

    if (filtersOpen) {
        FilterSheet(
            viewModel = viewModel,
            onDismiss = { filtersOpen = false },
            onOpenHelp = {
                filtersOpen = false
                navigation.openSearchHelp()
            },
        )
    }
}
