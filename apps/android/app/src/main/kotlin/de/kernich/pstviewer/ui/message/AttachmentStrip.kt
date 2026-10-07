package de.kernich.pstviewer.ui.message

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.AttachmentInfo
import de.kernich.pstviewer.ui.components.FileBadge
import de.kernich.pstviewer.ui.components.SymbolIcon
import de.kernich.pstviewer.ui.rememberFormatter

/** What can be done with the attachments of a message. */
class AttachmentHandler(
    val preview: (AttachmentInfo) -> Unit,
    val save: (AttachmentInfo) -> Unit,
    val share: (AttachmentInfo) -> Unit,
    val openWith: (AttachmentInfo) -> Unit,
    val saveAll: () -> Unit,
)

/** The visible attachments of a message as cards (desktop AttachmentBar). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AttachmentStrip(attachments: List<AttachmentInfo>, handler: AttachmentHandler, modifier: Modifier = Modifier) {
    val visible = attachments.filter { !it.isInline }
    if (visible.isEmpty()) return
    Column(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                pluralStringResource(R.plurals.attachments, visible.size, visible.size.toString()),
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                // Lines up with the text of the message header above the cards.
                modifier = Modifier.weight(1f).padding(start = 4.dp),
            )
            if (visible.size > 1) {
                TextButton(onClick = handler.saveAll, contentPadding = ButtonDefaults.TextButtonWithIconContentPadding) {
                    Icon(painterResource(R.drawable.ic_download), contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.save_all))
                }
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            visible.forEach { AttachmentCard(it, handler) }
        }
    }
}

@Composable
private fun AttachmentCard(attachment: AttachmentInfo, handler: AttachmentHandler) {
    val format = rememberFormatter()
    // Attached messages open in the app; types that could run code can only be saved.
    val canOpen = !attachment.isMessage && attachment.canOpen
    var menuOpen by remember { mutableStateOf(false) }
    OutlinedCard(
        onClick = { handler.preview(attachment) },
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.widthIn(min = 160.dp, max = 300.dp),
    ) {
        Row(Modifier.padding(start = 8.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            if (attachment.isMessage) {
                Box(
                    Modifier
                        .size(width = 36.dp, height = 40.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center,
                ) {
                    SymbolIcon(R.drawable.ic_mail, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer)
                }
            } else {
                FileBadge(attachment.name)
            }
            Column(Modifier.weight(1f, fill = false).padding(start = 10.dp)) {
                Text(attachment.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    if (attachment.isMessage) stringResource(R.string.attached_message) else format.size(attachment.size),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
            Box {
                IconButton(onClick = { menuOpen = true }) {
                    Icon(painterResource(R.drawable.ic_more_vert), contentDescription = stringResource(R.string.more_options))
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    val run = { action: (AttachmentInfo) -> Unit ->
                        menuOpen = false
                        action(attachment)
                    }
                    if (attachment.isMessage) {
                        MenuEntry(R.string.open_attached_message, R.drawable.ic_mail) { run(handler.preview) }
                    } else {
                        MenuEntry(R.string.preview, R.drawable.ic_visibility) { run(handler.preview) }
                        if (canOpen) {
                            MenuEntry(R.string.open_with, R.drawable.ic_open_in_new) { run(handler.openWith) }
                            MenuEntry(R.string.share, R.drawable.ic_share) { run(handler.share) }
                        }
                        HorizontalDivider()
                    }
                    MenuEntry(R.string.save_as, R.drawable.ic_download) { run(handler.save) }
                }
            }
        }
    }
}

@Composable
private fun MenuEntry(label: Int, icon: Int, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(stringResource(label)) },
        leadingIcon = { Icon(painterResource(icon), contentDescription = null) },
        onClick = onClick,
    )
}
