package de.kernich.pstviewer.ui.search

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.AttachmentType
import de.kernich.pstviewer.core.DatePreset
import de.kernich.pstviewer.core.ItemKind
import de.kernich.pstviewer.core.ReadState
import de.kernich.pstviewer.core.SearchField
import de.kernich.pstviewer.ui.mailbox.MailboxViewModel
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.util.attachmentTypeLabel
import de.kernich.pstviewer.util.datePresetLabel
import de.kernich.pstviewer.util.fieldLabel
import de.kernich.pstviewer.util.kindLabel
import de.kernich.pstviewer.util.readStateLabel
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

private val KINDS = listOf(ItemKind.MAIL, ItemKind.MEETING, ItemKind.APPOINTMENT, ItemKind.CONTACT, ItemKind.TASK, ItemKind.NOTE)
private val SIZES = listOf<Long?>(null, 100L * 1024, 1024L * 1024, 10L * 1024 * 1024)

/** UTC midnight of an ISO date, as the date pickers use. */
private fun utcMillis(iso: String?): Long? = iso?.let { runCatching { LocalDate.parse(it).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull() }

private fun isoDate(utcMillis: Long?): String? = utcMillis?.let { Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString() }

/** All search filters of the desktop filter panel in a bottom sheet. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FilterSheet(viewModel: MailboxViewModel, onDismiss: () -> Unit, onOpenHelp: () -> Unit) {
    val filters = viewModel.filters
    val format = rememberFormatter()
    var pickRange by rememberSaveable { mutableStateOf(false) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .navigationBarsPadding(),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.filters),
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.weight(1f).semantics { heading() },
                )
                if (viewModel.activeFilters > 0) {
                    Text(
                        stringResource(R.string.filters_active, viewModel.activeFilters),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }

            Section(R.string.filter_search_in) {
                val fields = filters.fields.ifEmpty { SearchField.entries }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SearchField.entries.forEach { field ->
                        FilterChip(
                            selected = field in fields,
                            onClick = {
                                val next = if (field in fields) fields - field else fields + field
                                viewModel.updateFilters { it.copy(fields = if (next.isEmpty() || next.size == SearchField.entries.size) emptyList() else next) }
                            },
                            label = { Text(stringResource(fieldLabel(field))) },
                        )
                    }
                }
            }

            Section(R.string.filter_date) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DatePreset.entries.forEach { preset ->
                        FilterChip(
                            selected = filters.datePreset == preset,
                            onClick = {
                                if (preset == DatePreset.CUSTOM) {
                                    pickRange = true
                                } else {
                                    viewModel.updateFilters { it.copy(datePreset = preset, dateFrom = null, dateTo = null) }
                                }
                            },
                            label = { Text(stringResource(datePresetLabel(preset))) },
                        )
                    }
                }
                if (filters.datePreset == DatePreset.CUSTOM) {
                    val range = listOf(filters.dateFrom, filters.dateTo).joinToString(" – ") { iso -> isoDateMillis(iso)?.let(format::date) ?: "…" }
                    OutlinedButton(onClick = { pickRange = true }, contentPadding = ButtonDefaults.ButtonWithIconContentPadding) {
                        Icon(painterResource(R.drawable.ic_date_range), contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(range)
                    }
                }
            }

            Section(R.string.filter_people) {
                SenderField(viewModel)
                Spacer(Modifier.height(8.dp))
                DebouncedField(
                    value = filters.to,
                    label = stringResource(R.string.field_to),
                    placeholder = stringResource(R.string.filter_to_placeholder),
                    onChange = { value -> viewModel.updateFilters { it.copy(to = value) } },
                )
            }

            Section(R.string.filter_status) {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    ReadState.entries.forEachIndexed { index, state ->
                        SegmentedButton(
                            selected = filters.readState == state,
                            onClick = { viewModel.updateFilters { it.copy(readState = state) } },
                            shape = SegmentedButtonDefaults.itemShape(index, ReadState.entries.size),
                        ) { Text(stringResource(readStateLabel(state)), maxLines = 1) }
                    }
                }
                Spacer(Modifier.height(8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FlagChip(R.string.flag_has_attachments, R.drawable.ic_attach_file, filters.hasAttachments) {
                        viewModel.updateFilters { it.copy(hasAttachments = !it.hasAttachments) }
                    }
                    FlagChip(R.string.flag_important, R.drawable.ic_priority_high, filters.important) {
                        viewModel.updateFilters { it.copy(important = !it.important) }
                    }
                    FlagChip(R.string.flag_flagged, R.drawable.ic_flag, filters.flagged) {
                        viewModel.updateFilters { it.copy(flagged = !it.flagged) }
                    }
                }
            }

            Section(R.string.filter_attachment_type) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AttachmentType.entries.forEach { type ->
                        FilterChip(
                            selected = filters.attachmentType == type,
                            onClick = { viewModel.updateFilters { it.copy(attachmentType = if (it.attachmentType == type) null else type) } },
                            label = { Text(stringResource(attachmentTypeLabel(type))) },
                        )
                    }
                }
            }

            Section(R.string.filter_kinds) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KINDS.forEach { kind ->
                        FilterChip(
                            selected = kind in filters.kinds,
                            onClick = { viewModel.updateFilters { it.copy(kinds = if (kind in it.kinds) it.kinds - kind else it.kinds + kind) } },
                            label = { Text(stringResource(kindLabel(kind))) },
                        )
                    }
                }
            }

            Section(R.string.filter_size) {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    SIZES.forEachIndexed { index, size ->
                        SegmentedButton(
                            selected = filters.minSize == size,
                            onClick = { viewModel.updateFilters { it.copy(minSize = size) } },
                            shape = SegmentedButtonDefaults.itemShape(index, SIZES.size),
                        ) {
                            Text(
                                if (size == null) stringResource(R.string.size_any) else stringResource(R.string.size_at_least, format.size(size)),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }

            Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onOpenHelp, contentPadding = ButtonDefaults.TextButtonWithIconContentPadding) {
                    Icon(painterResource(R.drawable.ic_help), contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.search_syntax))
                }
                Spacer(Modifier.weight(1f))
                FilledTonalButton(
                    onClick = viewModel::resetFilters,
                    enabled = viewModel.activeFilters > 0,
                    contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
                ) {
                    Icon(painterResource(R.drawable.ic_restart_alt), contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.reset_filters))
                }
            }
        }
    }

    if (pickRange) {
        val state = rememberDateRangePickerState(
            initialSelectedStartDateMillis = utcMillis(filters.dateFrom),
            initialSelectedEndDateMillis = utcMillis(filters.dateTo),
        )
        DatePickerDialog(
            onDismissRequest = { pickRange = false },
            confirmButton = {
                TextButton(
                    enabled = state.selectedStartDateMillis != null,
                    onClick = {
                        val start = isoDate(state.selectedStartDateMillis)
                        val end = isoDate(state.selectedEndDateMillis) ?: start
                        viewModel.updateFilters { it.copy(datePreset = DatePreset.CUSTOM, dateFrom = start, dateTo = end) }
                        pickRange = false
                    },
                ) { Text(stringResource(R.string.ok)) }
            },
            dismissButton = { TextButton(onClick = { pickRange = false }) { Text(stringResource(R.string.cancel)) } },
        ) {
            DateRangePicker(
                state = state,
                title = { Text(stringResource(R.string.date_range_title), modifier = Modifier.padding(start = 24.dp, end = 12.dp, top = 16.dp)) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun Section(title: Int, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.padding(top = 20.dp)) {
        Text(
            stringResource(title),
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 8.dp).semantics { heading() },
        )
        content()
    }
}

@Composable
private fun FlagChip(label: Int, icon: Int, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(stringResource(label)) },
        leadingIcon = { Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(18.dp)) },
    )
}

/** Text field that applies its value a moment after typing stops. */
@Composable
private fun DebouncedField(value: String, label: String, placeholder: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    var text by remember { mutableStateOf(value) }
    LaunchedEffect(value) { if (text != value) text = value }
    LaunchedEffect(text) {
        delay(250)
        if (text != value) onChange(text)
    }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it },
        label = { Text(label) },
        placeholder = { Text(placeholder, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
    )
}

/** Sender filter with suggestions from the archive's senders. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SenderField(viewModel: MailboxViewModel) {
    val value = viewModel.filters.from
    var text by remember { mutableStateOf(value) }
    var expanded by remember { mutableStateOf(false) }
    LaunchedEffect(value) { if (text != value) text = value }
    LaunchedEffect(text) {
        delay(250)
        if (text != value) viewModel.updateFilters { it.copy(from = text) }
    }
    val matches = remember(text, viewModel.senders) { if (text.isBlank()) emptyList() else viewModel.matchingSenders(text, 6) }
    ExposedDropdownMenuBox(expanded = expanded && matches.isNotEmpty(), onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = text,
            onValueChange = {
                text = it
                expanded = true
            },
            label = { Text(stringResource(R.string.field_from)) },
            placeholder = { Text(stringResource(R.string.filter_from_placeholder), maxLines = 1, overflow = TextOverflow.Ellipsis) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryEditable),
        )
        ExposedDropdownMenu(expanded = expanded && matches.isNotEmpty(), onDismissRequest = { expanded = false }) {
            matches.forEach { sender ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(sender.name.ifEmpty { sender.email }, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (sender.name.isNotEmpty() && sender.email.isNotEmpty()) {
                                Text(sender.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                            }
                        }
                    },
                    onClick = {
                        text = sender.email.ifEmpty { sender.name }
                        expanded = false
                    },
                )
            }
        }
    }
}
