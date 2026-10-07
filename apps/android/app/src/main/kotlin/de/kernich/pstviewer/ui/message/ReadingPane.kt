package de.kernich.pstviewer.ui.message

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.AttachmentInfo
import de.kernich.pstviewer.core.MessageRef
import de.kernich.pstviewer.ui.MainViewModel
import de.kernich.pstviewer.ui.components.ActionIcon
import de.kernich.pstviewer.ui.components.EmptyState
import de.kernich.pstviewer.ui.folderLabel
import de.kernich.pstviewer.ui.mailbox.DetailState
import de.kernich.pstviewer.ui.mailbox.MailboxNavigation
import de.kernich.pstviewer.ui.mailbox.MailboxViewModel

/** Attachment actions of a message: previews and attached messages open as screens, files go through the main view model. */
fun attachmentHandler(
    main: MainViewModel,
    ref: MessageRef,
    attachments: List<AttachmentInfo>,
    openAttachments: (MessageRef, List<AttachmentInfo>, Int) -> Unit,
    openAttachedMessage: (MessageRef) -> Unit,
) = AttachmentHandler(
    preview = { attachment ->
        if (attachment.isMessage) {
            openAttachedMessage(MessageRef(ref.id, ref.path + attachment.index))
        } else {
            // Files can be stepped through; attached messages and inline images are left out.
            val files = attachments.filter { !it.isInline && !it.isMessage }
            openAttachments(ref, files, files.indexOfFirst { it.index == attachment.index }.coerceAtLeast(0))
        }
    },
    save = { main.saveAttachment(ref, it) },
    share = { main.shareAttachment(ref, it) },
    openWith = { main.openAttachmentWith(ref, it) },
    saveAll = { main.saveAttachments(ref) },
)

/** The message selected in the mailbox, with navigation, headers and export. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReadingPane(main: MainViewModel, viewModel: MailboxViewModel, navigation: MailboxNavigation, showBack: Boolean, onBack: () -> Unit) {
    val state = viewModel.detail
    val detail = (state as? DetailState.Loaded)?.detail
    val remoteAllowed by viewModel.remoteAllowed.collectAsState()
    var headersOpen by rememberSaveable { mutableStateOf(false) }
    val folderName = detail?.folderId?.let { viewModel.tree[it] }?.let { folderLabel(it) }
    val total = viewModel.result?.total ?: 0

    Scaffold(
        topBar = {
            TopAppBar(
                title = {},
                navigationIcon = { if (showBack) ActionIcon(R.drawable.ic_arrow_back, stringResource(R.string.back), onBack) },
                actions = {
                    if (total > 1 && viewModel.selectedIndex >= 0) {
                        ActionIcon(R.drawable.ic_keyboard_arrow_up, stringResource(R.string.previous_message), { viewModel.moveSelection(-1) }, enabled = viewModel.selectedIndex > 0)
                        ActionIcon(R.drawable.ic_keyboard_arrow_down, stringResource(R.string.next_message), { viewModel.moveSelection(1) }, enabled = viewModel.selectedIndex < total - 1)
                    }
                    if (detail != null) {
                        ActionIcon(R.drawable.ic_code, stringResource(R.string.show_headers), { headersOpen = true })
                        ExportMenu(main, detail, folderName, detail.messageRef in remoteAllowed)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
    ) { padding ->
        Box(Modifier.padding(top = padding.calculateTopPadding()).fillMaxSize()) {
            when (state) {
                DetailState.None -> EmptyState(
                    icon = R.drawable.ic_drafts,
                    title = stringResource(R.string.no_selection),
                    text = stringResource(R.string.no_selection_hint),
                    modifier = Modifier.align(Alignment.Center),
                )
                DetailState.Loading -> LoadingMessage(Modifier.align(Alignment.Center))
                DetailState.Failed -> EmptyState(
                    icon = R.drawable.ic_error,
                    title = stringResource(R.string.message_error),
                    iconTint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center),
                ) {
                    FilledTonalButton(onClick = viewModel::reloadDetail) { Text(stringResource(R.string.retry)) }
                }
                is DetailState.Loaded -> key(state.detail.messageRef) {
                    val message = state.detail
                    val actions = remember(message, showBack) {
                        MessageActions(
                            attachments = attachmentHandler(main, message.messageRef, message.attachments, navigation.openAttachments, navigation.openAttachedMessage),
                            allowRemote = { viewModel.allowRemote(message.messageRef) },
                            searchPerson = { key, sender ->
                                viewModel.searchPerson(key, sender)
                                if (showBack) onBack()
                            },
                            linkFailed = { main.message(R.string.link_open_failed) },
                            copied = { main.message(R.string.copied) },
                        )
                    }
                    MessageView(
                        detail = message,
                        terms = viewModel.result?.terms.orEmpty(),
                        folderName = folderName,
                        remoteAllowed = message.messageRef in remoteAllowed,
                        actions = actions,
                    )
                }
            }
        }
    }
    if (headersOpen && detail != null) {
        HeadersSheet(detail.headers, onCopied = { main.message(R.string.copied) }, onDismiss = { headersOpen = false })
    }
}

@Composable
fun LoadingMessage(modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        Spacer(Modifier.width(12.dp))
        Text(stringResource(R.string.loading_message), color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
