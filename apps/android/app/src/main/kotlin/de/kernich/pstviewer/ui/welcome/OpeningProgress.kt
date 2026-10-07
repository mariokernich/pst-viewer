package de.kernich.pstviewer.ui.welcome

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.OpenPhase
import de.kernich.pstviewer.ui.OpenState
import de.kernich.pstviewer.ui.components.ArchiveFileIcon
import de.kernich.pstviewer.ui.rememberFormatter

/** Progress while a file is opened (desktop LoadingScreen). */
@Composable
fun OpeningProgress(state: OpenState.Opening, onCancel: () -> Unit) {
    val format = rememberFormatter()
    val progress = state.progress
    // Indexing counts items; scanning an MBOX counts bytes.
    val determinate = progress != null && progress.total > 0 && (progress.phase == OpenPhase.INDEXING || progress.phase == OpenPhase.SCANNING)
    val fraction = if (determinate) (progress.done.toFloat() / progress.total).coerceIn(0f, 1f) else 0f
    val status = stringResource(
        when (progress?.phase) {
            OpenPhase.INDEXING -> R.string.loading_indexing
            OpenPhase.SCANNING -> R.string.loading_scanning
            OpenPhase.FINISHING -> R.string.loading_finishing
            else -> R.string.loading_opening
        },
    )
    val detail = when {
        progress == null -> ""
        progress.phase == OpenPhase.INDEXING && progress.total > 0 ->
            stringResource(R.string.loading_progress, format.number(progress.done), format.number(progress.total))
        progress.phase == OpenPhase.SCANNING && progress.total > 0 ->
            stringResource(R.string.loading_scan_bytes, format.size(progress.done), format.size(progress.total))
        progress.phase == OpenPhase.SCANNING && progress.done > 0 -> stringResource(R.string.loading_found, format.number(progress.done))
        else -> ""
    }

    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
            modifier = Modifier.widthIn(max = 480.dp).fillMaxWidth(),
        ) {
            Column(Modifier.padding(24.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ArchiveFileIcon(state.source.name, state.source.isFolder)
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            stringResource(R.string.loading_title, state.source.name),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            status,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        )
                    }
                }
                Spacer(Modifier.height(24.dp))
                if (determinate) {
                    LinearProgressIndicator(progress = { fraction }, modifier = Modifier.fillMaxWidth())
                } else {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        progress?.folderName?.let { stringResource(R.string.loading_folder, it) }.orEmpty(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                }
                Spacer(Modifier.height(20.dp))
                OutlinedButton(onClick = onCancel, modifier = Modifier.align(Alignment.End)) { Text(stringResource(R.string.cancel)) }
            }
        }
    }
}
