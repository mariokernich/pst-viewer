package de.kernich.pstviewer.ui

import android.text.format.DateFormat
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import de.kernich.pstviewer.core.FolderInfo
import de.kernich.pstviewer.util.Formatter
import de.kernich.pstviewer.util.folderName

/** Formatter for the UI language and the user's 12/24-hour setting. */
@Composable
fun rememberFormatter(): Formatter {
    val locale = LocalConfiguration.current.locales[0]
    val is24Hour = DateFormat.is24HourFormat(LocalContext.current)
    return remember(locale, is24Hour) { Formatter(locale, is24Hour) }
}

/** Display name of a folder in the UI language. */
@Composable
@ReadOnlyComposable
fun folderLabel(folder: FolderInfo): String = folderName(folder, LocalResources.current)
