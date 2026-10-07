package de.kernich.pstviewer.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

/** Colours beyond the Material roles, shared with the desktop app. */
@Immutable
data class StatusColors(
    /** Search matches (like a marker). */
    val highlight: Color,
    val onHighlight: Color,
    /** Digitally signed messages. */
    val success: Color,
    /** Warnings such as blocked file types. */
    val warning: Color,
)

private val LightStatus = StatusColors(Color(0xFFFFE168), Color(0xFF1D1D1F), Color(0xFF1B7F37), Color(0xFF9A5B00))
private val DarkStatus = StatusColors(Color(0xFFB8901A), Color(0xFFFFFFFF), Color(0xFF6DD58C), Color(0xFFFFB95C))

private val LocalStatusColors = staticCompositionLocalOf { LightStatus }

/** Accessor for [StatusColors], like MaterialTheme.colorScheme. */
object AppTheme {
    val status: StatusColors
        @Composable @ReadOnlyComposable get() = LocalStatusColors.current
}

/**
 * Material 3 theme: dynamic colour (Material You) where available and enabled,
 * the brand scheme otherwise. Light or dark follows the configuration, which
 * AppCompat sets from the user's choice.
 */
@Composable
fun PstViewerTheme(dynamicColor: Boolean, content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val colors = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> BrandDarkColors
        else -> BrandLightColors
    }
    CompositionLocalProvider(LocalStatusColors provides if (dark) DarkStatus else LightStatus) {
        MaterialTheme(colorScheme = colors, content = content)
    }
}
