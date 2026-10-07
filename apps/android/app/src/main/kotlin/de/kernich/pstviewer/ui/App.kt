package de.kernich.pstviewer.ui

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import de.kernich.pstviewer.AppContainer
import de.kernich.pstviewer.R
import de.kernich.pstviewer.ui.attachments.AttachmentPreviewScreen
import de.kernich.pstviewer.ui.mailbox.MailboxScreen
import de.kernich.pstviewer.ui.mailbox.MailboxViewModel
import de.kernich.pstviewer.ui.message.AttachedMessageScreen
import de.kernich.pstviewer.ui.search.SearchHelpScreen
import de.kernich.pstviewer.ui.settings.LicensesScreen
import de.kernich.pstviewer.ui.settings.SettingsScreen
import de.kernich.pstviewer.ui.theme.PstViewerTheme
import de.kernich.pstviewer.ui.welcome.WelcomeScreen
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** ACTION_CREATE_DOCUMENT with the file name and MIME type chosen per request. */
private class CreateDocument : ActivityResultContract<Pair<String, String>, Uri?>() {
    override fun createIntent(context: Context, input: Pair<String, String>): Intent =
        Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(input.second)
            .putExtra(Intent.EXTRA_TITLE, input.first)

    override fun parseResult(resultCode: Int, intent: Intent?): Uri? = intent?.data.takeIf { resultCode == Activity.RESULT_OK }
}

/** The app: theme, back stack, pickers and messages. */
@Composable
fun PstViewerApp(main: MainViewModel, container: AppContainer) {
    val dynamicColor by container.settings.dynamicColor.collectAsState()
    PstViewerTheme(dynamicColor) {
        Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxSize()) {
            val snackbar = remember { SnackbarHostState() }
            Effects(main, container, snackbar)
            Box(Modifier.fillMaxSize()) {
                Screens(main, container)
                SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).windowInsetsPadding(WindowInsets.safeDrawing))
            }
        }
    }
}

@Composable
private fun Screens(main: MainViewModel, container: AppContainer) {
    NavDisplay(
        backStack = main.backStack,
        onBack = main::navigateBack,
        entryDecorators = listOf(rememberSaveableStateHolderNavEntryDecorator(), rememberViewModelStoreNavEntryDecorator()),
        entryProvider = entryProvider {
            entry<Route.Welcome> {
                WelcomeScreen(main, onOpenSettings = { main.navigate(Route.Settings) })
            }
            entry<Route.Mailbox> { route ->
                val archive = main.archive?.takeIf { it.id == route.archive } ?: return@entry
                val viewModel = viewModel { MailboxViewModel(archive, container.settings) }
                MailboxScreen(main, viewModel, archive.id)
            }
            entry<Route.Settings> {
                val recent by main.recentFiles.collectAsState()
                SettingsScreen(
                    settings = container.settings,
                    hasRecentFiles = recent.isNotEmpty(),
                    onClearRecentFiles = {
                        main.clearRecentFiles()
                        main.message(R.string.recent_files_cleared)
                    },
                    onOpenLicenses = { main.navigate(Route.Licenses) },
                    onOpenSearchHelp = { main.navigate(Route.SearchHelp) },
                    onBack = main::navigateBack,
                )
            }
            entry<Route.Licenses> { LicensesScreen(onBack = main::navigateBack) }
            entry<Route.SearchHelp> {
                SearchHelpScreen(canTry = main.archive != null, onTry = main::trySearch, onBack = main::navigateBack)
            }
            entry<Route.Attachments> { route ->
                val archive = main.archive?.takeIf { it.id == route.archive } ?: return@entry
                AttachmentPreviewScreen(main, archive, container.tempFiles, route)
            }
            entry<Route.AttachedMessage> { route ->
                val archive = main.archive?.takeIf { it.id == route.archive } ?: return@entry
                AttachedMessageScreen(main, archive, route.message)
            }
        },
    )
}

/** Carries out the effects of the main view model: pickers, other apps, printing, snackbars. */
@Composable
private fun Effects(main: MainViewModel, container: AppContainer, snackbar: SnackbarHostState) {
    val context = LocalContext.current
    val resources = LocalResources.current
    val activity = LocalActivity.current
    val openFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { main.openDocument(it, persist = true) }
    }
    val openFolder = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri -> uri?.let(main::openTree) }
    val createDocument = rememberLauncherForActivityResult(CreateDocument(), main::onDocumentCreated)
    val chooseFolder = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree(), main::onFolderChosen)
    LaunchedEffect(main) {
        main.effects.collect { effect ->
            when (effect) {
                is UiEffect.Message -> launch {
                    snackbar.showSnackbar(resources.getString(effect.text, *effect.args.toTypedArray()))
                }
                is UiEffect.CountMessage -> launch {
                    snackbar.showSnackbar(resources.getQuantityString(effect.text, effect.count, effect.count))
                }
                // Any type, so that MBOX files without an extension can be picked.
                is UiEffect.OpenDocument -> if (effect.folder) openFolder.launch(null) else openFile.launch(arrayOf("*/*"))
                is UiEffect.CreateDocument -> createDocument.launch(effect.name to effect.mimeType)
                UiEffect.ChooseFolder -> chooseFolder.launch(null)
                is UiEffect.Launch -> try {
                    context.startActivity(effect.intent)
                } catch (_: ActivityNotFoundException) {
                    main.message(R.string.error_open_failed)
                }
                is UiEffect.Print -> if (activity != null) {
                    launch {
                        try {
                            container.renderer.print(activity, effect.export.printDocument, effect.export.allowRemote, effect.export.paper, effect.export.baseName)
                        } catch (e: CancellationException) {
                            throw e
                        } catch (_: Exception) {
                            main.message(R.string.print_failed)
                        }
                    }
                }
            }
        }
    }
}
