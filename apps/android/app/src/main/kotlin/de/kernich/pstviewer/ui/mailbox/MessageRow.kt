package de.kernich.pstviewer.ui.mailbox

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.Importance
import de.kernich.pstviewer.core.ItemKind
import de.kernich.pstviewer.core.MessageSummary
import de.kernich.pstviewer.core.SecurityKind
import de.kernich.pstviewer.ui.components.Avatar
import de.kernich.pstviewer.ui.components.SymbolIcon
import de.kernich.pstviewer.ui.components.rememberHighlighted
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.util.kindIcon
import de.kernich.pstviewer.util.kindLabel

/** A message in the list: avatar, sender (or recipients in sent folders), date, subject, flags and preview. */
@Composable
fun MessageRow(
    summary: MessageSummary,
    selected: Boolean,
    terms: List<String>,
    folderName: String?,
    outgoing: Boolean,
    onClick: () -> Unit,
) {
    val format = rememberFormatter()
    val unread = !summary.isRead && (summary.kind == ItemKind.MAIL || summary.kind == ItemKind.MEETING)
    val person = if (outgoing) summary.toLine.ifEmpty { summary.fromName } else summary.fromName.ifEmpty { summary.fromEmail }
    val showRecipients = outgoing && summary.toLine.isNotEmpty()
    val colors = MaterialTheme.colorScheme
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 1.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(if (selected) colors.secondaryContainer else Color.Transparent)
            .selectable(selected = selected, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 12.dp),
    ) {
        Avatar(name = person, email = if (showRecipients) "" else summary.fromEmail)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (unread) {
                    val label = stringResource(R.string.unread)
                    Box(
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(colors.primary)
                            .semantics { contentDescription = label },
                    )
                    Spacer(Modifier.width(6.dp))
                }
                val name = rememberHighlighted(person, terms)
                Text(
                    text = when {
                        person.isEmpty() -> AnnotatedString(stringResource(R.string.no_sender))
                        showRecipients -> buildAnnotatedString {
                            append(stringResource(R.string.to))
                            append(": ")
                            append(name)
                        }
                        else -> name
                    },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (unread) FontWeight.Bold else FontWeight.Medium,
                    fontStyle = if (person.isEmpty()) FontStyle.Italic else null,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    format.listDate(summary.date),
                    style = MaterialTheme.typography.labelMedium,
                    color = if (unread) colors.primary else colors.onSurfaceVariant,
                    maxLines = 1,
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                kindIcon(summary.kind)?.let { icon ->
                    SymbolIcon(icon, stringResource(kindLabel(summary.kind, single = true)), Modifier.size(16.dp), tint = colors.onSurfaceVariant)
                }
                val subject = rememberHighlighted(summary.subject, terms)
                Text(
                    text = if (summary.subject.isEmpty()) AnnotatedString(stringResource(R.string.no_subject)) else subject,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (unread) FontWeight.SemiBold else null,
                    fontStyle = if (summary.subject.isEmpty()) FontStyle.Italic else null,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (folderName != null) Pill(folderName, Modifier.widthIn(max = 110.dp))
                RowIcons(summary)
            }
            if (summary.preview.isNotEmpty()) {
                Text(
                    rememberHighlighted(summary.preview, terms),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

@Composable
private fun RowIcons(summary: MessageSummary) {
    val colors = MaterialTheme.colorScheme
    val small = Modifier.size(16.dp)
    if (summary.importance == Importance.HIGH) SymbolIcon(R.drawable.ic_priority_high, stringResource(R.string.importance_high), small, tint = colors.error)
    if (summary.flagged) SymbolIcon(R.drawable.ic_flag_filled, stringResource(R.string.flagged), small, tint = colors.error)
    when (summary.security) {
        SecurityKind.SIGNED -> SymbolIcon(R.drawable.ic_verified_user, stringResource(R.string.signed), small, tint = colors.onSurfaceVariant)
        SecurityKind.ENCRYPTED -> SymbolIcon(R.drawable.ic_key, stringResource(R.string.encrypted), small, tint = colors.onSurfaceVariant)
        null -> Unit
    }
    if (summary.attachmentCount > 0u) {
        val count = summary.attachmentCount.toInt()
        SymbolIcon(R.drawable.ic_attach_file, pluralStringResource(R.plurals.attachments, count, count.toString()), small, tint = colors.onSurfaceVariant)
    }
}
