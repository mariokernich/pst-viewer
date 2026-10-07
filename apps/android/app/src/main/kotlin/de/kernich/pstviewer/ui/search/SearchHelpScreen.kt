package de.kernich.pstviewer.ui.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringArrayResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.ui.components.ActionIcon
import de.kernich.pstviewer.ui.components.readableWidth

/** The search syntax of the desktop app; examples can be tried while an archive is open. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchHelpScreen(canTry: Boolean, onTry: (String) -> Unit, onBack: () -> Unit) {
    val examples = stringArrayResource(R.array.help_examples)
    val descriptions = stringArrayResource(R.array.help_descriptions)
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())
    Scaffold(
        modifier = Modifier.readableWidth().nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            LargeTopAppBar(
                title = { Text(stringResource(R.string.help_title)) },
                navigationIcon = { ActionIcon(R.drawable.ic_arrow_back, stringResource(R.string.back), onBack) },
                scrollBehavior = scrollBehavior,
            )
        },
        contentWindowInsets = WindowInsets(0),
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxSize(),
            contentPadding = WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal).asPaddingValues(),
        ) {
            item {
                Text(
                    stringResource(R.string.help_intro),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                if (canTry) {
                    Text(
                        stringResource(R.string.help_try),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
            }
            examples.forEachIndexed { index, example ->
                item(key = example) {
                    if (index > 0) HorizontalDivider(Modifier.padding(horizontal = 16.dp))
                    ListItem(
                        headlineContent = { Text(example, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.primary) },
                        supportingContent = { Text(descriptions.getOrElse(index) { "" }) },
                        modifier = if (canTry) Modifier.clickable { onTry(example) } else Modifier,
                    )
                }
            }
            item {
                Text(
                    stringResource(R.string.help_english),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }
    }
}
