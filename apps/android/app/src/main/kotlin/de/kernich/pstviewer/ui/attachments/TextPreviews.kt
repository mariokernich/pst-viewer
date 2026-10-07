package de.kernich.pstviewer.ui.attachments

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.prepareMailDocument
import de.kernich.pstviewer.ui.message.MailCss
import de.kernich.pstviewer.ui.message.MailWebView
import de.kernich.pstviewer.ui.rememberFormatter
import de.kernich.pstviewer.util.CsvTable
import de.kernich.pstviewer.util.decodeText
import de.kernich.pstviewer.util.parseCsv
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Larger text files are shown up to this size (like the desktop app). */
const val MAX_TEXT_BYTES = 2 * 1024 * 1024
private const val MAX_CSV_ROWS = 2000
private const val LINES_PER_BLOCK = 200

/** Notice that only the beginning of a large file is shown. */
@Composable
fun TruncatedNotice(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        color = MaterialTheme.colorScheme.onTertiaryContainer,
    )
}

@Composable
private fun Loading(modifier: Modifier) = Box(modifier, contentAlignment = Alignment.Center) { CircularProgressIndicator() }

/** Plain text in a monospace font. */
@Composable
fun TextPreview(data: ByteArray, modifier: Modifier = Modifier) {
    val format = rememberFormatter()
    val blocks by produceState<List<String>?>(null, data) {
        value = withContext(Dispatchers.Default) {
            decodeText(data, MAX_TEXT_BYTES).lines().chunked(LINES_PER_BLOCK) { it.joinToString("\n") }
        }
    }
    val current = blocks ?: return Loading(modifier)
    Column(modifier) {
        if (data.size > MAX_TEXT_BYTES) TruncatedNotice(stringResource(R.string.preview_truncated, format.size(MAX_TEXT_BYTES.toLong())))
        LazyColumn(Modifier.fillMaxWidth().weight(1f)) {
            items(current) { block ->
                SelectionContainer {
                    Text(
                        block,
                        fontFamily = FontFamily.Monospace,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }
        }
    }
}

/** CSV and TSV files as a table with a fixed header row. */
@Composable
fun CsvPreview(data: ByteArray, modifier: Modifier = Modifier) {
    val table by produceState<CsvTable?>(null, data) {
        value = withContext(Dispatchers.Default) { parseCsv(decodeText(data, MAX_TEXT_BYTES), MAX_CSV_ROWS) }
    }
    val current = table ?: return Loading(modifier)
    if (current.rows.isEmpty()) return
    val columns = current.rows.maxOf { it.size }
    // Column widths from the longest cell, within limits.
    val widths: List<Dp> = List(columns) { column ->
        val chars = current.rows.maxOf { it.getOrNull(column)?.length ?: 0 }
        (chars * 8 + 24).coerceIn(64, 280).dp
    }
    val header = current.rows.first()
    val body = current.rows.drop(1)
    Column(modifier) {
        if (current.more) TruncatedNotice(stringResource(R.string.preview_rows_truncated, MAX_CSV_ROWS.toString()))
        Box(Modifier.weight(1f).horizontalScroll(rememberScrollState()).padding(12.dp)) {
            LazyColumn(Modifier.width(widths.fold(0.dp) { sum, width -> sum + width }).fillMaxHeight()) {
                stickyHeader { CsvRow(header, widths, isHeader = true) }
                itemsIndexed(body) { index, row -> CsvRow(row, widths, isHeader = false, shaded = index % 2 == 1) }
            }
        }
    }
}

@Composable
private fun CsvRow(cells: List<String>, widths: List<Dp>, isHeader: Boolean, shaded: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    Row(Modifier.background(if (isHeader) colors.surfaceContainerHighest else if (shaded) colors.surfaceContainerLow else colors.surface)) {
        widths.forEachIndexed { column, width ->
            Text(
                cells.getOrNull(column).orEmpty(),
                style = MaterialTheme.typography.bodySmall,
                fontWeight = if (isHeader) FontWeight.SemiBold else null,
                maxLines = if (isHeader) 1 else 3,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .width(width)
                    .border(0.5.dp, colors.outlineVariant)
                    .padding(horizontal = 8.dp, vertical = 6.dp),
            )
        }
    }
}

/** HTML attachments, sanitised like mail bodies (no scripts, no remote content). */
@Composable
fun HtmlPreview(data: ByteArray, onLinkFailed: () -> Unit, modifier: Modifier = Modifier) {
    val document by produceState<String?>(null, data) {
        value = withContext(Dispatchers.Default) { prepareMailDocument(decodeText(data, MAX_TEXT_BYTES), emptyMap(), false, MailCss.HTML).html }
    }
    val current = document ?: return Loading(modifier)
    MailWebView(current, allowRemote = false, transparent = false, wrapContent = false, onLinkFailed = onLinkFailed, modifier = modifier)
}
