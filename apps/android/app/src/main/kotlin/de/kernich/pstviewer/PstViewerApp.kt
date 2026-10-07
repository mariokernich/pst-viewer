package de.kernich.pstviewer

import android.app.Application
import de.kernich.pstviewer.data.AppSettings
import de.kernich.pstviewer.data.RecentFiles
import de.kernich.pstviewer.data.TempFiles
import de.kernich.pstviewer.data.export.DocumentRenderer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Application-wide objects, created once per process. */
class AppContainer(app: Application) {
    /** Work that must finish even if the screen that started it is gone (e.g. closing an archive). */
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val settings = AppSettings(app)
    val recentFiles = RecentFiles(app)
    val tempFiles = TempFiles(app)
    val renderer = DocumentRenderer(app)
}

class PstViewerApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        container.settings.applyTheme()
        // Stale copies of attachments and exports from the last run.
        container.scope.launch(Dispatchers.IO) { container.tempFiles.clear() }
    }
}
