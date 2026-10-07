package de.kernich.pstviewer.ui.attachments

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.AttachmentFile
import de.kernich.pstviewer.core.AttachmentInfo
import de.kernich.pstviewer.core.PreviewKind
import de.kernich.pstviewer.data.OpenArchive
import de.kernich.pstviewer.data.TempFiles
import de.kernich.pstviewer.ui.MainViewModel
import de.kernich.pstviewer.ui.Route
import de.kernich.pstviewer.ui.components.ActionIcon
import de.kernich.pstviewer.ui.components.EmptyState
import de.kernich.pstviewer.ui.components.FileBadge
import de.kernich.pstviewer.ui.components.SymbolIcon
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.ui.theme.AppTheme
import kotlinx.coroutines.launch
import java.io.File

/** Quick Look style preview of the file attachments of a message; swipe to step through them. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttachmentPreviewScreen(main: MainViewModel, archive: OpenArchive, tempFiles: TempFiles, route: Route.Attachments) {
    val viewModel = viewModel { AttachmentPreviewViewModel(archive, tempFiles, route.message, route.attachments) }
    val attachments = viewModel.attachments
    val pager = rememberPagerState(initialPage = route.start) { attachments.size }
    val scope = rememberCoroutineScope()
    var zoomed by remember { mutableStateOf(false) }
    val format = rememberFormatter()
    LaunchedEffect(pager.currentPage) {
        zoomed = false
        viewModel.focus(pager.currentPage)
    }
    val current = attachments[pager.currentPage]
    val step = { delta: Int -> scope.launch { pager.animateScrollToPage((pager.currentPage + delta).mod(attachments.size)) } }

    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Scaffold(
        modifier = Modifier
            .focusRequester(focus)
            .focusable()
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown || attachments.size < 2) return@onKeyEvent false
                when (event.key) {
                    Key.DirectionLeft -> step(-1)
                    Key.DirectionRight -> step(1)
                    else -> return@onKeyEvent false
                }
                true
            },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(current.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
                        Text(format.size(current.size), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = { ActionIcon(R.drawable.ic_close, stringResource(R.string.close), main::navigateBack) },
                actions = {
                    if (current.canOpen) {
                        ActionIcon(R.drawable.ic_open_in_new, stringResource(R.string.open_with), { main.openAttachmentWith(route.message, current) })
                        ActionIcon(R.drawable.ic_share, stringResource(R.string.share), { main.shareAttachment(route.message, current) })
                    }
                    ActionIcon(R.drawable.ic_download, stringResource(R.string.save_as), { main.saveAttachment(route.message, current) })
                },
            )
        },
        bottomBar = {
            if (attachments.size > 1) {
                BottomAppBar {
                    Spacer(Modifier.weight(1f))
                    ActionIcon(R.drawable.ic_chevron_left, stringResource(R.string.previous_attachment), { step(-1) })
                    Text(
                        stringResource(R.string.attachment_position, pager.currentPage + 1, attachments.size),
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                    ActionIcon(R.drawable.ic_chevron_right, stringResource(R.string.next_attachment), { step(1) })
                    Spacer(Modifier.weight(1f))
                }
            }
        },
    ) { padding ->
        HorizontalPager(
            state = pager,
            userScrollEnabled = !zoomed,
            modifier = Modifier.padding(padding).fillMaxSize(),
            key = { attachments[it].index.toLong() },
        ) { page ->
            val attachment = attachments[page]
            if (!attachment.previewKind.hasPreview) {
                NoPreview(
                    attachment = attachment,
                    onOpenWith = { main.openAttachmentWith(route.message, attachment) },
                    onSave = { main.saveAttachment(route.message, attachment) },
                    modifier = Modifier.fillMaxSize(),
                )
                return@HorizontalPager
            }
            when (val state = viewModel.state(attachment.index)) {
                PreviewState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                is PreviewState.Failed -> EmptyState(
                    icon = R.drawable.ic_error,
                    title = stringResource(R.string.preview_failed),
                    text = stringResource(state.code.message),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    FilledTonalButton(onClick = { viewModel.retry(attachment) }) { Text(stringResource(R.string.retry)) }
                }
                is PreviewState.Copied -> FilePreview(
                    kind = attachment.previewKind,
                    file = state.file,
                    onZoomed = { if (page == pager.currentPage) zoomed = it },
                )
                is PreviewState.Loaded -> DataPreview(
                    kind = attachment.previewKind,
                    file = state.file,
                    onZoomed = { if (page == pager.currentPage) zoomed = it },
                    onLinkFailed = { main.message(R.string.link_open_failed) },
                )
            }
        }
    }
}

/** Viewers that read a cache file (PDF, audio, video). */
@Composable
private fun FilePreview(kind: PreviewKind, file: File, onZoomed: (Boolean) -> Unit) {
    val modifier = Modifier.fillMaxSize()
    when (kind) {
        PreviewKind.PDF -> PdfPreview({ file }, onZoomed, modifier)
        PreviewKind.AUDIO -> AudioPreview({ file }, modifier)
        else -> VideoPreview({ file }, modifier)
    }
}

/** Viewers that render the bytes of an attachment. */
@Composable
private fun DataPreview(kind: PreviewKind, file: AttachmentFile, onZoomed: (Boolean) -> Unit, onLinkFailed: () -> Unit) {
    val modifier = Modifier.fillMaxSize()
    when (kind) {
        PreviewKind.IMAGE -> ImagePreview(file, onZoomed, onLinkFailed, modifier)
        PreviewKind.CSV -> CsvPreview(file.data, modifier)
        PreviewKind.HTML -> HtmlPreview(file.data, onLinkFailed, modifier)
        PreviewKind.CALENDAR -> CalendarPreview(file.data, modifier)
        PreviewKind.CONTACT -> ContactsPreview(file.data, modifier)
        else -> TextPreview(file.data, modifier)
    }
}

/** Files without a preview: open them in another app (if safe) or save them. */
@Composable
private fun NoPreview(attachment: AttachmentInfo, onOpenWith: () -> Unit, onSave: () -> Unit, modifier: Modifier) {
    val format = rememberFormatter()
    Column(
        modifier.verticalScroll(rememberScrollState()).padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        FileBadge(attachment.name, Modifier.padding(8.dp))
        Spacer(Modifier.height(16.dp))
        Text(attachment.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Text(
            listOf(format.size(attachment.size), attachment.mimeType).filter { it.isNotEmpty() }.joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(16.dp))
        if (attachment.canOpen) {
            Text(
                "${stringResource(R.string.no_preview)}. ${stringResource(R.string.no_preview_hint)}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 420.dp),
            )
            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onOpenWith, contentPadding = ButtonDefaults.ButtonWithIconContentPadding) {
                    Icon(painterResource(R.drawable.ic_open_in_new), contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.open_with))
                }
                FilledTonalButton(onClick = onSave) { Text(stringResource(R.string.save_as)) }
            }
        } else {
            Surface(
                color = AppTheme.status.warning.copy(alpha = 0.12f),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.widthIn(max = 460.dp).fillMaxWidth(),
            ) {
                Row(Modifier.padding(14.dp)) {
                    SymbolIcon(R.drawable.ic_gpp_maybe, null, Modifier.size(20.dp), tint = AppTheme.status.warning)
                    Spacer(Modifier.width(10.dp))
                    Text(stringResource(R.string.blocked_type), style = MaterialTheme.typography.bodyMedium)
                }
            }
            Spacer(Modifier.height(20.dp))
            FilledTonalButton(onClick = onSave) { Text(stringResource(R.string.save_as)) }
        }
    }
}
