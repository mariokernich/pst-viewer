package de.kernich.pstviewer.ui.message

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.MessageRef
import de.kernich.pstviewer.data.OpenArchive
import de.kernich.pstviewer.ui.MainViewModel
import de.kernich.pstviewer.ui.Route
import de.kernich.pstviewer.ui.components.ActionIcon
import de.kernich.pstviewer.ui.components.EmptyState
import de.kernich.pstviewer.ui.mailbox.DetailState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Loads an attached message (any depth) of the open archive. */
class AttachedMessageViewModel(private val archive: OpenArchive, private val ref: MessageRef) : ViewModel() {
    var state by mutableStateOf<DetailState>(DetailState.Loading)
        private set

    init {
        load()
    }

    fun load() {
        state = DetailState.Loading
        viewModelScope.launch {
            state = try {
                DetailState.Loaded(archive.call { it.message(ref) })
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                DetailState.Failed
            }
        }
    }
}

/** An attached message (Outlook item or .eml) in its own reading view (desktop EmbeddedMessageDialog). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttachedMessageScreen(main: MainViewModel, archive: OpenArchive, ref: MessageRef) {
    val viewModel = viewModel { AttachedMessageViewModel(archive, ref) }
    val state = viewModel.state
    val detail = (state as? DetailState.Loaded)?.detail
    val remoteAllowed by archive.remoteAllowed.collectAsState()
    var headersOpen by rememberSaveable { mutableStateOf(false) }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        detail?.subject?.ifEmpty { null } ?: stringResource(R.string.attached_message),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                navigationIcon = { ActionIcon(R.drawable.ic_arrow_back, stringResource(R.string.back), main::navigateBack) },
                actions = {
                    if (detail != null) {
                        ActionIcon(R.drawable.ic_code, stringResource(R.string.show_headers), { headersOpen = true })
                        ExportMenu(main, detail, null, ref in remoteAllowed)
                    }
                },
            )
        },
    ) { padding ->
        Box(Modifier.padding(top = padding.calculateTopPadding()).fillMaxSize()) {
            when (state) {
                DetailState.Loading, DetailState.None -> LoadingMessage(Modifier.align(Alignment.Center))
                DetailState.Failed -> EmptyState(
                    icon = R.drawable.ic_error,
                    title = stringResource(R.string.message_error),
                    iconTint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center),
                ) {
                    FilledTonalButton(onClick = viewModel::load) { Text(stringResource(R.string.retry)) }
                }
                is DetailState.Loaded -> {
                    val message = state.detail
                    val actions = remember(message) {
                        MessageActions(
                            attachments = attachmentHandler(
                                main = main,
                                ref = message.messageRef,
                                attachments = message.attachments,
                                openAttachments = { at, attachments, start -> main.navigate(Route.Attachments(archive.id, at, attachments, start)) },
                                openAttachedMessage = { main.navigate(Route.AttachedMessage(archive.id, it)) },
                            ),
                            allowRemote = { archive.allowRemote(message.messageRef) },
                            searchPerson = null,
                            linkFailed = { main.message(R.string.link_open_failed) },
                            copied = { main.message(R.string.copied) },
                        )
                    }
                    MessageView(message, emptyList(), null, message.messageRef in remoteAllowed, actions)
                }
            }
        }
    }
    if (headersOpen && detail != null) {
        HeadersSheet(detail.headers, onCopied = { main.message(R.string.copied) }, onDismiss = { headersOpen = false })
    }
}
