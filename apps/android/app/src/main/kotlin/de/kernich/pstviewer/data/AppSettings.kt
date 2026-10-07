package de.kernich.pstviewer.data

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.content.edit
import androidx.core.os.LocaleListCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ThemeMode(val nightMode: Int) {
    SYSTEM(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM),
    LIGHT(AppCompatDelegate.MODE_NIGHT_NO),
    DARK(AppCompatDelegate.MODE_NIGHT_YES),
}

enum class AppLanguage(val tag: String) {
    SYSTEM(""),
    GERMAN("de"),
    ENGLISH("en"),
}

/**
 * User preferences. The theme is applied through AppCompat so that windows,
 * system bars and WebViews follow it; the language is a per-app locale that
 * the system (Android 13+) or AppCompat stores.
 */
class AppSettings(context: Context) {
    private val preferences = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    private val _themeMode = MutableStateFlow(
        ThemeMode.entries.firstOrNull { it.name == preferences.getString(KEY_THEME, null) } ?: ThemeMode.SYSTEM,
    )
    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    private val _dynamicColor = MutableStateFlow(preferences.getBoolean(KEY_DYNAMIC_COLOR, true))
    val dynamicColor: StateFlow<Boolean> = _dynamicColor.asStateFlow()

    private val _showEmptyFolders = MutableStateFlow(preferences.getBoolean(KEY_EMPTY_FOLDERS, false))
    val showEmptyFolders: StateFlow<Boolean> = _showEmptyFolders.asStateFlow()

    /** Applies the stored theme; called before the first activity is created. */
    fun applyTheme() = AppCompatDelegate.setDefaultNightMode(_themeMode.value.nightMode)

    fun setThemeMode(mode: ThemeMode) {
        _themeMode.value = mode
        preferences.edit { putString(KEY_THEME, mode.name) }
        applyTheme()
    }

    fun setDynamicColor(enabled: Boolean) {
        _dynamicColor.value = enabled
        preferences.edit { putBoolean(KEY_DYNAMIC_COLOR, enabled) }
    }

    fun setShowEmptyFolders(show: Boolean) {
        _showEmptyFolders.value = show
        preferences.edit { putBoolean(KEY_EMPTY_FOLDERS, show) }
    }

    val language: AppLanguage
        get() {
            val tag = AppCompatDelegate.getApplicationLocales()[0]?.language ?: return AppLanguage.SYSTEM
            return AppLanguage.entries.firstOrNull { it.tag == tag } ?: AppLanguage.SYSTEM
        }

    fun setLanguage(language: AppLanguage) {
        val locales = if (language == AppLanguage.SYSTEM) LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(language.tag)
        AppCompatDelegate.setApplicationLocales(locales)
    }

    private companion object {
        const val KEY_THEME = "theme"
        const val KEY_DYNAMIC_COLOR = "dynamic_color"
        const val KEY_EMPTY_FOLDERS = "show_empty_folders"
    }
}
