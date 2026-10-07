package de.kernich.pstviewer.ui.attachments

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.CalendarEvent
import de.kernich.pstviewer.core.CalendarInfo
import de.kernich.pstviewer.core.CalendarPerson
import de.kernich.pstviewer.core.ContactCard
import de.kernich.pstviewer.core.ContactFieldKind
import de.kernich.pstviewer.core.parseCalendar
import de.kernich.pstviewer.core.parseContacts
import de.kernich.pstviewer.ui.components.Avatar
import de.kernich.pstviewer.ui.components.SymbolIcon
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.util.decodeText
import de.kernich.pstviewer.util.displayAddress
import de.kernich.pstviewer.util.vcardFieldLabel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.ZoneId

private val BIRTHDAY = Regex("^(\\d{4})-?(\\d{2})-?(\\d{2})")

/** "Anna <anna@example.com> · Zugesagt" */
private fun attendee(person: CalendarPerson, statuses: Map<String, String>): String {
    val address = displayAddress(person.name, person.email)
    val status = person.status?.uppercase()?.replace('-', '_')?.let(statuses::get)
    return if (status != null) "$address · $status" else address
}

/** Invitations and events of an .ics file as cards (desktop CalendarCards). */
@Composable
fun CalendarPreview(data: ByteArray, modifier: Modifier = Modifier) {
    val calendar by produceState<CalendarInfo?>(null, data) { value = withContext(Dispatchers.Default) { parseCalendar(data) } }
    WithSource(data, modifier) {
        val current = calendar ?: return@WithSource
        if (current.events.isEmpty()) {
            Text(stringResource(R.string.no_events), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        current.events.forEach { EventCard(it, current.method) }
    }
}

@Composable
private fun EventCard(event: CalendarEvent, method: String) {
    val format = rememberFormatter()
    val methodLabel = when (method) {
        "REQUEST" -> R.string.method_request
        "CANCEL" -> R.string.method_cancel
        "REPLY" -> R.string.method_reply
        "PUBLISH" -> R.string.method_publish
        else -> null
    }
    val canceled = method == "CANCEL"
    PreviewCard {
        if (methodLabel != null) {
            Surface(
                color = if (canceled) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.primaryContainer,
                contentColor = if (canceled) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimaryContainer,
                shape = RoundedCornerShape(6.dp),
            ) {
                Text(stringResource(methodLabel), style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
            }
        }
        Text(
            event.summary.ifEmpty { "—" },
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
            textDecoration = if (canceled) TextDecoration.LineThrough else null,
        )
        event.start?.let { start ->
            val range = format.range(start.time, event.end?.time, start.allDay)
            EventRow(R.drawable.ic_event, start.zone?.let { "$range ($it)" } ?: range)
        }
        if (event.recurring) EventRow(R.drawable.ic_repeat, stringResource(R.string.recurring))
        if (event.location.isNotEmpty()) EventRow(R.drawable.ic_location_on, event.location)
        event.organizer?.let { EventRow(R.drawable.ic_person, "${stringResource(R.string.organizer)}: ${displayAddress(it.name, it.email)}") }
        if (event.attendees.isNotEmpty()) {
            val statuses = mapOf(
                "ACCEPTED" to stringResource(R.string.partstat_accepted),
                "DECLINED" to stringResource(R.string.partstat_declined),
                "TENTATIVE" to stringResource(R.string.partstat_tentative),
                "NEEDS_ACTION" to stringResource(R.string.partstat_needs_action),
            )
            EventRow(R.drawable.ic_group, event.attendees.joinToString("\n") { attendee(it, statuses) })
        }
        if (event.description.isNotEmpty()) {
            HorizontalDivider()
            Text(event.description, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun EventRow(icon: Int, text: String) {
    Row {
        SymbolIcon(icon, null, Modifier.padding(top = 2.dp).size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(12.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

/** Contacts of a .vcf file as cards (desktop ContactCards). */
@Composable
fun ContactsPreview(data: ByteArray, modifier: Modifier = Modifier) {
    val contacts by produceState<List<ContactCard>?>(null, data) { value = withContext(Dispatchers.Default) { parseContacts(data) } }
    WithSource(data, modifier) {
        val current = contacts ?: return@WithSource
        if (current.isEmpty()) Text(stringResource(R.string.no_contacts), color = MaterialTheme.colorScheme.onSurfaceVariant)
        current.forEach { ContactCardView(it) }
    }
}

@Composable
private fun ContactCardView(contact: ContactCard) {
    val format = rememberFormatter()
    val photo = remember(contact.photo) {
        contact.photo?.substringAfter("base64,", "")?.takeIf { it.isNotEmpty() }?.let { encoded ->
            runCatching { Base64.decode(encoded, Base64.DEFAULT).let { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } }.getOrNull()
        }
    }
    PreviewCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (photo != null) {
                Image(photo, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(64.dp).clip(CircleShape))
            } else {
                Avatar(contact.name, "", size = 64.dp)
            }
            Spacer(Modifier.width(16.dp))
            Column {
                Text(contact.name.ifEmpty { "—" }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                val subtitle = listOf(contact.title, contact.organization).filter { it.isNotEmpty() }.joinToString(" · ")
                if (subtitle.isNotEmpty()) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (contact.fields.isNotEmpty()) {
            HorizontalDivider()
            contact.fields.forEach { field ->
                Row {
                    Text(
                        stringResource(vcardFieldLabel(field.kind)) + if (field.label.isNotEmpty()) " (${field.label})" else "",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.widthIn(min = 110.dp, max = 150.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    val value = if (field.kind == ContactFieldKind.BIRTHDAY) {
                        BIRTHDAY.find(field.value)?.destructured?.let { (year, month, day) ->
                            runCatching {
                                format.date(LocalDate.of(year.toInt(), month.toInt(), day.toInt()).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli())
                            }.getOrNull()
                        } ?: field.value
                    } else {
                        field.value
                    }
                    Text(value, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun PreviewCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        modifier = Modifier.fillMaxWidth(),
    ) {
        SelectionContainer {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
        }
    }
}

/** A structured view with a toggle to show the raw file. */
@Composable
private fun WithSource(data: ByteArray, modifier: Modifier, content: @Composable ColumnScope.() -> Unit) {
    var source by rememberSaveable { mutableStateOf(false) }
    Column(
        modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 720.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            content()
            TextButton(onClick = { source = !source }, contentPadding = ButtonDefaults.TextButtonWithIconContentPadding) {
                Icon(painterResource(R.drawable.ic_code), contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(if (source) R.string.hide_source else R.string.show_source))
            }
            if (source) {
                val text = remember(data) { decodeText(data, MAX_TEXT_BYTES) }
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = RoundedCornerShape(16.dp)) {
                    SelectionContainer {
                        Text(text, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(16.dp))
                    }
                }
            }
        }
    }
}
