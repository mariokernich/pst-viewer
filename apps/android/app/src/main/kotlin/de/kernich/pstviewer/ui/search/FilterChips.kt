package de.kernich.pstviewer.ui.search

import androidx.annotation.DrawableRes
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.DatePreset
import de.kernich.pstviewer.core.ReadState
import de.kernich.pstviewer.core.SearchFilters
import de.kernich.pstviewer.ui.mailbox.MailboxViewModel
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.util.Formatter
import de.kernich.pstviewer.util.attachmentTypeLabel
import de.kernich.pstviewer.util.datePresetLabel
import de.kernich.pstviewer.util.fieldLabel
import de.kernich.pstviewer.util.kindLabel
import de.kernich.pstviewer.util.readStateLabel
import java.time.LocalDate
import java.time.ZoneId

/** An active filter as a removable chip. */
class ActiveFilter(val key: String, val label: String, @param:DrawableRes val icon: Int?, val reset: (SearchFilters) -> SearchFilters)

/** Local midnight of an ISO date (YYYY-MM-DD) of the date filter. */
fun isoDateMillis(iso: String?): Long? = iso?.let {
    runCatching { LocalDate.parse(it).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli() }.getOrNull()
}

/** The active filters in the order of the desktop app's filter chips. */
fun describeFilters(filters: SearchFilters, format: Formatter, string: (Int, Array<out Any>) -> String): List<ActiveFilter> {
    fun s(id: Int, vararg args: Any) = string(id, args)
    val result = ArrayList<ActiveFilter>()
    if (filters.datePreset != DatePreset.ANY) {
        val value = if (filters.datePreset == DatePreset.CUSTOM) {
            listOf(filters.dateFrom, filters.dateTo).joinToString(" – ") { iso -> isoDateMillis(iso)?.let(format::shortDate) ?: "…" }
        } else {
            s(datePresetLabel(filters.datePreset))
        }
        result += ActiveFilter("date", s(R.string.chip_date, value), null) { it.copy(datePreset = DatePreset.ANY, dateFrom = null, dateTo = null) }
    }
    if (filters.from.isNotBlank()) result += ActiveFilter("from", s(R.string.chip_from, filters.from), null) { it.copy(from = "") }
    if (filters.to.isNotBlank()) result += ActiveFilter("to", s(R.string.chip_to, filters.to), null) { it.copy(to = "") }
    if (filters.readState != ReadState.ANY) result += ActiveFilter("read", s(readStateLabel(filters.readState)), null) { it.copy(readState = ReadState.ANY) }
    if (filters.hasAttachments) {
        result += ActiveFilter("att", s(R.string.flag_has_attachments), R.drawable.ic_attach_file) { it.copy(hasAttachments = false) }
    }
    filters.attachmentType?.let { type ->
        result += ActiveFilter("attType", s(R.string.chip_attachment_type, s(attachmentTypeLabel(type))), null) { it.copy(attachmentType = null) }
    }
    if (filters.important) result += ActiveFilter("imp", s(R.string.flag_important), R.drawable.ic_priority_high) { it.copy(important = false) }
    if (filters.flagged) result += ActiveFilter("flag", s(R.string.flag_flagged), R.drawable.ic_flag) { it.copy(flagged = false) }
    filters.minSize?.let { size -> result += ActiveFilter("size", s(R.string.chip_size, format.size(size)), null) { it.copy(minSize = null) } }
    if (filters.kinds.isNotEmpty()) {
        result += ActiveFilter("kinds", s(R.string.chip_kinds, filters.kinds.joinToString(", ") { s(kindLabel(it)) }), null) { it.copy(kinds = emptyList()) }
    }
    if (filters.fields.isNotEmpty()) {
        result += ActiveFilter("fields", s(R.string.chip_fields, filters.fields.joinToString(", ") { s(fieldLabel(it)) }), null) { it.copy(fields = emptyList()) }
    }
    return result
}

/** Chips summarising the active filters; tapping one removes it. */
@Composable
fun FilterChipsRow(viewModel: MailboxViewModel, modifier: Modifier = Modifier) {
    val format = rememberFormatter()
    val resources = LocalResources.current
    val active = describeFilters(viewModel.filters, format) { id, args -> resources.getString(id, *args) }
    if (active.isEmpty()) return
    // A plain row: only a few chips, and it always starts at the first one (a lazy row
    // keeps the first visible chip in place when another one is added before it).
    Row(
        modifier = modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        active.forEach { filter ->
            key(filter.key) {
                InputChip(
                    selected = true,
                    onClick = { viewModel.updateFilters(filter.reset) },
                    label = { Text(filter.label, maxLines = 1) },
                    leadingIcon = filter.icon?.let { { Icon(painterResource(it), contentDescription = null, modifier = Modifier.size(18.dp)) } },
                    trailingIcon = {
                        Icon(painterResource(R.drawable.ic_close), contentDescription = stringResource(R.string.reset_filters), modifier = Modifier.size(18.dp))
                    },
                )
            }
        }
        if (viewModel.activeFilters > 1) {
            TextButton(onClick = viewModel::resetFilters) { Text(stringResource(R.string.reset_all)) }
        }
    }
}
