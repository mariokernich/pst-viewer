package de.kernich.pstviewer.ui.message

import android.content.ClipData
import android.os.Build
import androidx.annotation.DrawableRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.Importance
import de.kernich.pstviewer.core.ItemKind
import de.kernich.pstviewer.core.MailDocument
import de.kernich.pstviewer.core.MessageDetail
import de.kernich.pstviewer.core.Recipient
import de.kernich.pstviewer.core.RecipientKind
import de.kernich.pstviewer.core.SecurityKind
import de.kernich.pstviewer.core.findMatches
import de.kernich.pstviewer.core.prepareMailDocument
import de.kernich.pstviewer.core.prepareTextDocument
import de.kernich.pstviewer.ui.components.Avatar
import de.kernich.pstviewer.ui.components.SymbolIcon
import de.kernich.pstviewer.ui.components.rememberHighlighted
import de.kernich.pstviewer.ui.mailbox.BodyView
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.ui.theme.AppTheme
import de.kernich.pstviewer.util.highlightHtml
import de.kernich.pstviewer.util.kindLabel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Callbacks of a message on screen. */
class MessageActions(
    val attachments: AttachmentHandler,
    val allowRemote: () -> Unit,
    /** Searches the archive for messages from (sender = true) or to a person; null where not offered. */
    val searchPerson: ((key: String, sender: Boolean) -> Unit)?,
    val linkFailed: () -> Unit,
    val copied: () -> Unit,
)

private const val COLLAPSED_RECIPIENTS = 4

/** Header, cards, attachments and body of a message (desktop MessageView). */
@Composable
fun MessageView(
    detail: MessageDetail,
    terms: List<String>,
    folderName: String?,
    remoteAllowed: Boolean,
    actions: MessageActions,
    modifier: Modifier = Modifier,
) {
    var view by rememberSaveable(detail.messageRef.toString()) { mutableStateOf(BodyView.HTML) }
    Column(modifier.verticalScroll(rememberScrollState())) {
        MessageHeader(detail, terms, folderName, actions)
        val cardModifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
        detail.appointment?.let { AppointmentCard(it, cardModifier) }
        detail.task?.let { TaskCard(it, cardModifier) }
        detail.contact?.takeIf { it.isNotEmpty() }?.let { ContactCard(it, cardModifier) }
        if (detail.security == SecurityKind.ENCRYPTED && detail.html == null && detail.text.isEmpty()) {
            InfoCard(cardModifier) {
                Row {
                    SymbolIcon(R.drawable.ic_key, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(12.dp))
                    Text(stringResource(R.string.encrypted_hint), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        AttachmentStrip(detail.attachments, actions.attachments, Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
        MessageBody(detail, terms, view, { view = it }, remoteAllowed, actions)
        Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MessageHeader(detail: MessageDetail, terms: List<String>, folderName: String?, actions: MessageActions) {
    val format = rememberFormatter()
    val status = AppTheme.status
    val colors = MaterialTheme.colorScheme
    Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (detail.kind != ItemKind.MAIL) Tag(stringResource(kindLabel(detail.kind, single = true)))
            if (folderName != null) Tag(folderName)
            if (detail.importance == Importance.HIGH) Tag(stringResource(R.string.importance_high), R.drawable.ic_priority_high, colors.errorContainer, colors.onErrorContainer)
            if (detail.flagged) Tag(stringResource(R.string.flagged), R.drawable.ic_flag_filled, colors.errorContainer, colors.onErrorContainer)
            when (detail.security) {
                SecurityKind.SIGNED -> Tag(stringResource(R.string.signed), R.drawable.ic_verified_user, status.success.copy(alpha = 0.14f), status.success)
                SecurityKind.ENCRYPTED -> Tag(stringResource(R.string.encrypted), R.drawable.ic_key)
                null -> Unit
            }
            detail.categories.forEach { Tag(it, container = colors.primaryContainer, content = colors.onPrimaryContainer) }
        }
        Spacer(Modifier.height(8.dp))
        SelectionContainer {
            if (detail.subject.isEmpty()) {
                Text(stringResource(R.string.no_subject), style = MaterialTheme.typography.headlineSmall, fontStyle = FontStyle.Italic, color = colors.onSurfaceVariant)
            } else {
                Text(rememberHighlighted(detail.subject, terms), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            }
        }
        if (detail.kind != ItemKind.APPOINTMENT && detail.kind != ItemKind.CONTACT) {
            Row(Modifier.padding(top = 16.dp)) {
                Avatar(detail.from.name, detail.from.email, Modifier.padding(top = 2.dp))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                        PersonName(Recipient(detail.from.name, detail.from.email, RecipientKind.TO), terms, actions, strong = true)
                        if (detail.from.email.isNotEmpty() && detail.from.email != detail.from.name) {
                            SelectionContainer {
                                Text(rememberHighlighted(detail.from.email, terms), style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
                            }
                        }
                    }
                    detail.sender?.let { sender ->
                        Text(
                            stringResource(
                                R.string.on_behalf_of,
                                sender.name.ifEmpty { sender.email },
                                detail.from.name.ifEmpty { detail.from.email },
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.onSurfaceVariant,
                        )
                    }
                    RecipientLine(stringResource(R.string.to), detail.recipients.filter { it.kind == RecipientKind.TO }, terms, actions)
                    RecipientLine(stringResource(R.string.cc), detail.recipients.filter { it.kind == RecipientKind.CC }, terms, actions)
                    RecipientLine(stringResource(R.string.bcc), detail.recipients.filter { it.kind == RecipientKind.BCC }, terms, actions)
                    if (detail.replyTo.isNotEmpty() && detail.replyTo != detail.from.name) {
                        Row(Modifier.padding(top = 4.dp)) {
                            Text(stringResource(R.string.reply_to), style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
                            Spacer(Modifier.width(8.dp))
                            SelectionContainer { Text(detail.replyTo, style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                    Text(
                        listOfNotNull(format.fullDate(detail.date).ifEmpty { null }, detail.size.takeIf { it > 0 }?.let(format::size)).joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
        }
    }
}

/** Small label in the header (item type, folder, importance, …). */
@Composable
private fun Tag(
    text: String,
    @DrawableRes icon: Int? = null,
    container: Color = MaterialTheme.colorScheme.surfaceContainerHigh,
    content: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Surface(color = container, contentColor = content, shape = RoundedCornerShape(8.dp)) {
        Row(Modifier.padding(horizontal = 8.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                SymbolIcon(icon, null, Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
            }
            Text(text, style = MaterialTheme.typography.labelMedium)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecipientLine(label: String, people: List<Recipient>, terms: List<String>, actions: MessageActions) {
    if (people.isEmpty()) return
    var expanded by rememberSaveable { mutableStateOf(false) }
    val shown = if (expanded) people else people.take(COLLAPSED_RECIPIENTS)
    val hidden = people.size - shown.size
    Row(Modifier.padding(top = 4.dp)) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(32.dp).padding(top = 1.dp),
        )
        FlowRow(Modifier.weight(1f), itemVerticalAlignment = Alignment.CenterVertically) {
            shown.forEachIndexed { index, person ->
                PersonName(person, terms, actions, strong = false, separator = index < shown.size - 1)
            }
            if (hidden > 0) {
                Text(
                    stringResource(R.string.more_recipients, hidden),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.clickable(role = Role.Button) { expanded = true }.padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
            if (expanded && people.size > COLLAPSED_RECIPIENTS) {
                Text(
                    stringResource(R.string.show_less),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.clickable(role = Role.Button) { expanded = false }.padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
        }
    }
}

/** A person with a menu to search for their messages and to copy the address. */
@Composable
private fun PersonName(person: Recipient, terms: List<String>, actions: MessageActions, strong: Boolean, separator: Boolean = false) {
    val label = person.name.ifEmpty { person.email }
    val key = person.email.ifEmpty { person.name }
    var open by remember { mutableStateOf(false) }
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    Box {
        Text(
            rememberHighlighted(if (separator) "$label," else label, terms),
            style = if (strong) MaterialTheme.typography.titleSmall else MaterialTheme.typography.bodySmall,
            fontWeight = if (strong) FontWeight.SemiBold else null,
            modifier = Modifier
                .clickable(role = Role.Button, onClickLabel = label) { open = true }
                .padding(end = 4.dp, top = 2.dp, bottom = 2.dp),
        )
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Text(
                if (person.email.isNotEmpty() && person.email != label) "$label <${person.email}>" else label,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
            actions.searchPerson?.let { search ->
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.suggestion_from, label)) },
                    leadingIcon = { Icon(painterResource(R.drawable.ic_search), null) },
                    onClick = {
                        open = false
                        search(key, true)
                    },
                )
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.chip_to, label)) },
                    leadingIcon = { Icon(painterResource(R.drawable.ic_alternate_email), null) },
                    onClick = {
                        open = false
                        search(key, false)
                    },
                )
            }
            if (person.email.isNotEmpty()) {
                HorizontalDivider()
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.copy)) },
                    leadingIcon = { Icon(painterResource(R.drawable.ic_content_copy), null) },
                    onClick = {
                        open = false
                        scope.launch {
                            clipboard.setClipEntry(ClipEntry(ClipData.newPlainText(label, person.email)))
                            // Android 13+ confirms copies itself.
                            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) actions.copied()
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun MessageBody(
    detail: MessageDetail,
    terms: List<String>,
    view: BodyView,
    onViewChange: (BodyView) -> Unit,
    remoteAllowed: Boolean,
    actions: MessageActions,
) {
    val html = detail.html
    // Calendar items and drafts often carry an empty HTML skeleton.
    val htmlHasContent = html != null && (detail.text.isNotBlank() || html.contains("<img", ignoreCase = true))
    val showHtml = htmlHasContent && view == BodyView.HTML
    val colors = MaterialTheme.colorScheme
    val status = AppTheme.status
    val textCss = remember(colors, status) { MailCss.text(colors, status) }
    val document by produceState<MailDocument?>(null, detail.messageRef, showHtml, remoteAllowed, textCss, terms) {
        value = withContext(Dispatchers.Default) {
            val prepared = when {
                showHtml -> prepareMailDocument(html, detail.inlineImages, remoteAllowed, MailCss.HTML)
                detail.text.isNotBlank() -> prepareTextDocument(detail.text, textCss)
                else -> null
            }
            // Search matches are marked in the document itself (no scripts in the WebView).
            if (prepared == null || terms.isEmpty()) {
                prepared
            } else {
                prepared.copy(html = highlightHtml(prepared.html) { text -> findMatches(text, terms).map { it.start.toInt() until it.end.toInt() } })
            }
        }
    }
    if (htmlHasContent && detail.text.isNotBlank()) {
        SingleChoiceSegmentedButtonRow(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
            listOf(BodyView.HTML to R.string.view_html, BodyView.TEXT to R.string.view_text).forEachIndexed { index, (option, label) ->
                SegmentedButton(
                    selected = view == option,
                    onClick = { onViewChange(option) },
                    shape = SegmentedButtonDefaults.itemShape(index, 2),
                ) { Text(stringResource(label)) }
            }
        }
    }
    val current = document
    if (showHtml && current?.hasRemote == true && !remoteAllowed) {
        Surface(
            color = colors.surfaceContainerHigh,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        ) {
            Row(Modifier.padding(start = 14.dp, end = 8.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                SymbolIcon(R.drawable.ic_hide_image, null, Modifier.size(20.dp), tint = colors.onSurfaceVariant)
                Spacer(Modifier.width(12.dp))
                Text(stringResource(R.string.remote_blocked), style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                OutlinedButton(onClick = actions.allowRemote) { Text(stringResource(R.string.load_remote)) }
            }
        }
    }
    when {
        current != null && showHtml -> Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            MailWebView(current.html, remoteAllowed, transparent = false, wrapContent = true, onLinkFailed = actions.linkFailed)
        }
        current != null -> MailWebView(
            current.html,
            allowRemote = false,
            transparent = true,
            wrapContent = true,
            onLinkFailed = actions.linkFailed,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
        !showHtml && detail.text.isBlank() && (detail.kind == ItemKind.MAIL || detail.kind == ItemKind.MEETING) -> Text(
            stringResource(R.string.body_empty),
            style = MaterialTheme.typography.bodyMedium,
            fontStyle = FontStyle.Italic,
            color = colors.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
        )
    }
}
