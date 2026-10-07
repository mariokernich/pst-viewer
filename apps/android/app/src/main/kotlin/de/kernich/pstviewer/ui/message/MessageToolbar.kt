package de.kernich.pstviewer.ui.message

import android.content.ClipData
import android.os.Build
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.MessageDetail
import de.kernich.pstviewer.data.export.MessageDocuments
import de.kernich.pstviewer.ui.ExportFormat
import de.kernich.pstviewer.ui.MainViewModel
import de.kernich.pstviewer.ui.components.ActionIcon
import de.kernich.pstviewer.ui.rememberFormatter
import kotlinx.coroutines.launch

/** Export and print actions for a message (desktop ExportMenu). */
@Composable
fun ExportMenu(main: MainViewModel, detail: MessageDetail, folderName: String?, allowRemote: Boolean) {
    val resources = LocalResources.current
    val format = rememberFormatter()
    val documents = remember(resources, format) { MessageDocuments(resources, format) }
    var open by remember { mutableStateOf(false) }
    Box {
        if (main.exporting) {
            val preparing = stringResource(R.string.preparing_export)
            Box(
                Modifier.size(48.dp).semantics {
                    contentDescription = preparing
                    liveRegion = LiveRegionMode.Polite
                },
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            }
        } else {
            ActionIcon(R.drawable.ic_share, stringResource(R.string.export_menu), { open = true })
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Text(
                stringResource(R.string.export_menu),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
            fun export() = documents.export(detail, folderName, allowRemote)
            ExportItem(R.drawable.ic_picture_as_pdf, R.string.export_pdf) {
                open = false
                main.export(export(), ExportFormat.PDF)
            }
            ExportItem(R.drawable.ic_mail, R.string.export_eml) {
                open = false
                main.export(export(), ExportFormat.EML)
            }
            ExportItem(R.drawable.ic_description, R.string.export_text) {
                open = false
                main.export(export(), ExportFormat.TEXT)
            }
            HorizontalDivider()
            ExportItem(R.drawable.ic_print, R.string.print) {
                open = false
                main.print(export())
            }
            ExportItem(R.drawable.ic_share, R.string.share_pdf) {
                open = false
                main.sharePdf(export())
            }
        }
    }
}

@Composable
private fun ExportItem(@DrawableRes icon: Int, label: Int, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(stringResource(label)) },
        leadingIcon = { Icon(painterResource(icon), contentDescription = null) },
        onClick = onClick,
    )
}

/** Internet headers of a message with a copy button (desktop HeadersDialog). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeadersSheet(headers: String, onCopied: () -> Unit, onDismiss: () -> Unit) {
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val title = stringResource(R.string.headers_title)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding()) {
            Row(Modifier.padding(start = 24.dp, end = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f).semantics { heading() })
                if (headers.isNotEmpty()) {
                    TextButton(onClick = {
                        scope.launch {
                            clipboard.setClipEntry(ClipEntry(ClipData.newPlainText(title, headers)))
                            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) onCopied()
                        }
                    }) {
                        Icon(painterResource(R.drawable.ic_content_copy), contentDescription = null, modifier = Modifier.size(18.dp))
                        Text(stringResource(R.string.copy), modifier = Modifier.padding(start = 8.dp))
                    }
                }
            }
            if (headers.isEmpty()) {
                Text(
                    stringResource(R.string.no_headers),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(24.dp),
                )
            } else {
                SelectionContainer(
                    Modifier
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .verticalScroll(rememberScrollState()),
                ) {
                    Text(headers, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace, modifier = Modifier.padding(8.dp))
                }
            }
        }
    }
}
