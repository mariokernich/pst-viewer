package de.kernich.pstviewer.ui.settings

import android.os.Build
import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.BuildConfig
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.coreVersion
import de.kernich.pstviewer.data.AppLanguage
import de.kernich.pstviewer.data.AppSettings
import de.kernich.pstviewer.data.ThemeMode
import de.kernich.pstviewer.ui.components.ActionIcon
import de.kernich.pstviewer.ui.components.readableWidth

/** Appearance, language, recent files and information about the app. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    settings: AppSettings,
    hasRecentFiles: Boolean,
    onClearRecentFiles: () -> Unit,
    onOpenLicenses: () -> Unit,
    onOpenSearchHelp: () -> Unit,
    onBack: () -> Unit,
) {
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())
    val theme by settings.themeMode.collectAsState()
    val dynamicColor by settings.dynamicColor.collectAsState()
    var language by remember { mutableStateOf(settings.language) }
    Scaffold(
        modifier = Modifier.readableWidth().nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            LargeTopAppBar(
                title = { Text(stringResource(R.string.settings)) },
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
            section(R.string.appearance)
            item {
                Column(Modifier.selectableGroup()) {
                    listOf(ThemeMode.SYSTEM to R.string.appearance_system, ThemeMode.LIGHT to R.string.appearance_light, ThemeMode.DARK to R.string.appearance_dark)
                        .forEach { (mode, label) -> RadioRow(stringResource(label), theme == mode) { settings.setThemeMode(mode) } }
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                item {
                    ListItem(
                        headlineContent = { Text(stringResource(R.string.dynamic_color)) },
                        supportingContent = { Text(stringResource(R.string.dynamic_color_summary)) },
                        leadingContent = { Icon(painterResource(R.drawable.ic_palette), contentDescription = null) },
                        trailingContent = { Switch(checked = dynamicColor, onCheckedChange = null) },
                        modifier = Modifier.toggleable(value = dynamicColor, role = Role.Switch, onValueChange = settings::setDynamicColor),
                    )
                }
            }
            section(R.string.language)
            item {
                Column(Modifier.selectableGroup()) {
                    listOf(
                        AppLanguage.SYSTEM to stringResource(R.string.language_system),
                        AppLanguage.GERMAN to stringResource(R.string.language_german),
                        AppLanguage.ENGLISH to stringResource(R.string.language_english),
                    ).forEach { (option, label) ->
                        RadioRow(label, language == option) {
                            language = option
                            settings.setLanguage(option)
                        }
                    }
                }
            }
            section(R.string.recent_files)
            item {
                ListItem(
                    headlineContent = { Text(stringResource(R.string.clear_recent_files)) },
                    leadingContent = { Icon(painterResource(R.drawable.ic_delete_sweep), contentDescription = null) },
                    modifier = Modifier.clickable(enabled = hasRecentFiles, onClick = onClearRecentFiles),
                )
            }
            section(R.string.about)
            item {
                ListItem(
                    headlineContent = { Text(stringResource(R.string.version)) },
                    supportingContent = { Text(BuildConfig.VERSION_NAME) },
                    leadingContent = { Icon(painterResource(R.drawable.ic_info), contentDescription = null) },
                )
            }
            item {
                ListItem(
                    headlineContent = { Text(stringResource(R.string.core_version)) },
                    supportingContent = { Text(remember { coreVersion() }) },
                    leadingContent = { Icon(painterResource(R.drawable.ic_code), contentDescription = null) },
                )
            }
            item {
                ListItem(
                    headlineContent = { Text(stringResource(R.string.privacy)) },
                    supportingContent = { Text(stringResource(R.string.privacy_text)) },
                    leadingContent = { Icon(painterResource(R.drawable.ic_privacy_tip), contentDescription = null) },
                )
            }
            item {
                ListItem(
                    headlineContent = { Text(stringResource(R.string.search_syntax)) },
                    leadingContent = { Icon(painterResource(R.drawable.ic_help), contentDescription = null) },
                    modifier = Modifier.clickable(onClick = onOpenSearchHelp),
                )
            }
            item {
                ListItem(
                    headlineContent = { Text(stringResource(R.string.licenses)) },
                    supportingContent = { Text(stringResource(R.string.licenses_summary)) },
                    leadingContent = { Icon(painterResource(R.drawable.ic_license), contentDescription = null) },
                    modifier = Modifier.clickable(onClick = onOpenLicenses),
                )
            }
        }
    }
}

private fun LazyListScope.section(@StringRes title: Int) {
    item(key = title) {
        Text(
            stringResource(title),
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier
                .padding(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 8.dp)
                .semantics { heading() },
        )
    }
}

@Composable
private fun RadioRow(label: String, selected: Boolean, onSelect: () -> Unit) {
    ListItem(
        headlineContent = { Text(label) },
        leadingContent = { RadioButton(selected = selected, onClick = null) },
        modifier = Modifier.selectable(selected = selected, role = Role.RadioButton, onClick = onSelect),
    )
}
