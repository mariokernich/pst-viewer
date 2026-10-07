package de.kernich.pstviewer.ui.welcome

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.data.ErrorCode
import de.kernich.pstviewer.data.RecentFile
import de.kernich.pstviewer.ui.MainViewModel
import de.kernich.pstviewer.ui.OpenState
import de.kernich.pstviewer.ui.components.ActionIcon
import de.kernich.pstviewer.ui.components.ArchiveFileIcon
import de.kernich.pstviewer.ui.components.SymbolIcon
import de.kernich.pstviewer.ui.rememberFormatter

/** Start screen: open a file or folder, reopen a recent one; shows the progress while opening. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WelcomeScreen(viewModel: MainViewModel, onOpenSettings: () -> Unit) {
    val state = viewModel.openState
    BackHandler(enabled = state is OpenState.Opening) { viewModel.cancelOpen() }
    LaunchedEffect(Unit) { viewModel.checkRecentFiles() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {},
                actions = {
                    if (state !is OpenState.Opening) ActionIcon(R.drawable.ic_settings, stringResource(R.string.settings), onOpenSettings)
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
    ) { padding ->
        AnimatedContent(
            targetState = state as? OpenState.Opening,
            contentKey = { it != null },
            transitionSpec = { fadeIn() togetherWith fadeOut() },
            label = "welcome",
            modifier = Modifier.padding(padding),
        ) { opening ->
            if (opening != null) {
                OpeningProgress(opening, onCancel = viewModel::cancelOpen)
            } else {
                Welcome(viewModel)
            }
        }
    }
}

@Composable
private fun Welcome(viewModel: MainViewModel) {
    val recent by viewModel.recentFiles.collectAsState()
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val twoColumns = maxWidth >= 840.dp
        val scroll = rememberScrollState()
        if (twoColumns) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scroll)
                    .padding(horizontal = 32.dp, vertical = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(48.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Intro(viewModel, Modifier.width(420.dp))
                RecentSection(viewModel, recent, Modifier.width(460.dp))
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scroll)
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Intro(viewModel, Modifier.widthIn(max = 560.dp))
                Spacer(Modifier.height(28.dp))
                RecentSection(viewModel, recent, Modifier.widthIn(max = 560.dp))
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Intro(viewModel: MainViewModel, modifier: Modifier) {
    Column(modifier) {
        Image(painterResource(R.drawable.app_logo), contentDescription = null, modifier = Modifier.size(80.dp))
        Spacer(Modifier.height(20.dp))
        Text(
            stringResource(R.string.app_name),
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(8.dp))
        Text(stringResource(R.string.tagline), style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)

        (viewModel.openState as? OpenState.Failed)?.let { failed ->
            Spacer(Modifier.height(20.dp))
            OpenErrorBanner(
                failed = failed,
                inRecentFiles = viewModel.recentFiles.collectAsState().value.any { it.key == failed.source.key },
                onRemove = { viewModel.removeRecentFile(failed.source.key) },
                onDismiss = viewModel::dismissError,
            )
        }

        Spacer(Modifier.height(24.dp))
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(20.dp)) {
                Button(
                    onClick = { viewModel.requestOpen(folder = false) },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
                ) {
                    Icon(painterResource(R.drawable.ic_file_open), contentDescription = null)
                    Spacer(Modifier.width(ButtonDefaults.IconSpacing))
                    Text(stringResource(R.string.open_file), style = MaterialTheme.typography.titleMedium)
                }
                Spacer(Modifier.height(10.dp))
                FilledTonalButton(
                    onClick = { viewModel.requestOpen(folder = true) },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
                ) {
                    Icon(painterResource(R.drawable.ic_folder_open), contentDescription = null)
                    Spacer(Modifier.width(ButtonDefaults.IconSpacing))
                    Text(stringResource(R.string.open_folder), style = MaterialTheme.typography.titleMedium)
                }
                Spacer(Modifier.height(16.dp))
                Text(stringResource(R.string.open_hint), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                val formats = stringResource(R.string.supported_formats)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.semantics { contentDescription = "$formats: PST, MSG, EML, MBOX" },
                ) {
                    listOf("PST", "MSG", "EML", "MBOX").forEach { format ->
                        Text(
                            format,
                            style = MaterialTheme.typography.labelMedium,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(MaterialTheme.colorScheme.secondaryContainer)
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            SymbolIcon(R.drawable.ic_lock, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.read_only_note), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun OpenErrorBanner(failed: OpenState.Failed, inRecentFiles: Boolean, onRemove: () -> Unit, onDismiss: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(start = 16.dp, top = 14.dp, bottom = 14.dp, end = 4.dp)) {
            SymbolIcon(R.drawable.ic_error, null, Modifier.padding(top = 2.dp).size(20.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.error_title), style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(2.dp))
                Text(stringResource(failed.code.message), style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(4.dp))
                Text(failed.source.name, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (failed.code == ErrorCode.NOT_FOUND && inRecentFiles) {
                    OutlinedButton(onClick = onRemove, modifier = Modifier.padding(top = 8.dp)) { Text(stringResource(R.string.remove_from_list)) }
                }
            }
            ActionIcon(R.drawable.ic_close, stringResource(R.string.dismiss), onDismiss)
        }
    }
}

@Composable
private fun RecentSection(viewModel: MainViewModel, recent: List<RecentFile>, modifier: Modifier) {
    Card(
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        modifier = modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 8.dp, bottom = 4.dp).height(48.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SymbolIcon(R.drawable.ic_schedule, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(10.dp))
            Text(
                stringResource(R.string.recent_files),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            if (recent.isNotEmpty()) TextButton(onClick = viewModel::clearRecentFiles) { Text(stringResource(R.string.clear_list)) }
        }
        if (recent.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(start = 32.dp, end = 32.dp, top = 12.dp, bottom = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(stringResource(R.string.no_recent_files), style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(4.dp))
                Text(
                    stringResource(R.string.no_recent_files_hint),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        } else {
            Column(Modifier.padding(bottom = 8.dp)) {
                recent.forEachIndexed { index, file ->
                    if (index > 0) HorizontalDivider(Modifier.padding(start = 76.dp, end = 16.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                    RecentRow(
                        file = file,
                        missing = file.key in viewModel.missingFiles,
                        onOpen = { viewModel.open(file.toSource()) },
                        onRemove = { viewModel.removeRecentFile(file.key) },
                    )
                }
            }
        }
    }
}

@Composable
private fun RecentRow(file: RecentFile, missing: Boolean, onOpen: () -> Unit, onRemove: () -> Unit) {
    val format = rememberFormatter()
    val details = listOfNotNull(
        file.location.ifEmpty { null },
        if (file.isFolder) null else file.size.takeIf { it >= 0 }?.let(format::size),
        file.itemCount?.let { pluralStringResource(R.plurals.item_count, it, format.number(it.toLong())) },
    ).joinToString(" · ")
    val opened = stringResource(R.string.opened_ago, remember(file.lastOpened) { format.relative(file.lastOpened) })
    ListItem(
        modifier = Modifier
            .clickable(onClick = onOpen)
            .alpha(if (missing) 0.6f else 1f),
        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        leadingContent = { ArchiveFileIcon(file.name, file.isFolder) },
        headlineContent = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(file.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f, fill = false))
                if (missing) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        stringResource(R.string.file_missing),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(MaterialTheme.colorScheme.errorContainer)
                            .padding(horizontal = 6.dp, vertical = 1.dp),
                    )
                }
            }
        },
        supportingContent = {
            Column {
                if (details.isNotEmpty()) Text(details, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(opened, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
            }
        },
        trailingContent = { ActionIcon(R.drawable.ic_close, stringResource(R.string.remove_from_list), onRemove) },
    )
}
