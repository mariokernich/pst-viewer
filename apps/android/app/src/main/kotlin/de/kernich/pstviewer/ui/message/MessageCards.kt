package de.kernich.pstviewer.ui.message

import androidx.annotation.DrawableRes
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.stringArrayResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.AppointmentInfo
import de.kernich.pstviewer.core.ContactField
import de.kernich.pstviewer.core.TaskInfo
import de.kernich.pstviewer.data.export.MessageDocuments
import de.kernich.pstviewer.ui.components.SymbolIcon
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.util.contactFieldLabel
import kotlin.math.roundToInt

/** Rounded, tinted card for structured item data. */
@Composable
fun InfoCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        shape = RoundedCornerShape(20.dp),
        modifier = modifier.fillMaxWidth(),
    ) {
        SelectionContainer {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
        }
    }
}

/** Row with an icon and label above its value. */
@Composable
fun InfoRow(@DrawableRes icon: Int, label: String, value: String) {
    Row(verticalAlignment = Alignment.Top) {
        SymbolIcon(icon, null, Modifier.padding(top = 2.dp).size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(12.dp))
        Column {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun AppointmentCard(appointment: AppointmentInfo, modifier: Modifier = Modifier) {
    if (appointment.start == null && appointment.location.isEmpty() && appointment.attendees.isEmpty()) return
    val format = rememberFormatter()
    InfoCard(modifier) {
        appointment.start?.let { start ->
            val range = format.range(start, appointment.end, appointment.isAllDay)
            InfoRow(
                R.drawable.ic_event,
                stringResource(R.string.appointment_when),
                if (appointment.isAllDay) "$range (${stringResource(R.string.all_day)})" else range,
            )
        }
        if (appointment.location.isNotEmpty()) InfoRow(R.drawable.ic_location_on, stringResource(R.string.appointment_where), appointment.location)
        if (appointment.isRecurring) InfoRow(R.drawable.ic_repeat, stringResource(R.string.recurring), appointment.recurrence.ifEmpty { "—" })
        if (appointment.attendees.isNotEmpty()) InfoRow(R.drawable.ic_group, stringResource(R.string.attendees), appointment.attendees)
    }
}

@Composable
fun TaskCard(task: TaskInfo, modifier: Modifier = Modifier) {
    val format = rememberFormatter()
    val statuses = stringArrayResource(R.array.task_status_values)
    InfoCard(modifier) {
        val status = statuses.getOrNull(task.status) ?: "—"
        InfoRow(
            R.drawable.ic_checklist,
            stringResource(R.string.task_status),
            "$status · ${stringResource(R.string.percent_complete, (task.percentComplete * 100).roundToInt())}",
        )
        task.startDate?.let { InfoRow(R.drawable.ic_event, stringResource(R.string.task_start), format.date(it)) }
        task.dueDate?.let { InfoRow(R.drawable.ic_event, stringResource(R.string.task_due), format.date(it)) }
        if (task.owner.isNotEmpty()) InfoRow(R.drawable.ic_group, stringResource(R.string.task_owner), task.owner)
    }
}

@Composable
fun ContactCard(fields: List<ContactField>, modifier: Modifier = Modifier) {
    val format = rememberFormatter()
    val resources = LocalResources.current
    val documents = remember(resources, format) { MessageDocuments(resources, format) }
    InfoCard(modifier) {
        fields.forEach { field ->
            Row {
                Text(
                    contactFieldLabel(field.key)?.let { stringResource(it) } ?: field.key,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.widthIn(min = 120.dp, max = 160.dp).padding(top = 2.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(documents.contactValue(field.key, field.value), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
