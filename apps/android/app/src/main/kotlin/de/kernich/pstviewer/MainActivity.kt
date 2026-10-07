package de.kernich.pstviewer

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import de.kernich.pstviewer.ui.MainViewModel
import de.kernich.pstviewer.ui.PstViewerApp

/**
 * The only activity. AppCompat applies the per-app language and the chosen
 * light/dark mode; everything else is Compose.
 */
class MainActivity : AppCompatActivity() {
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val container = (application as PstViewerApp).container
        setContent { PstViewerApp(viewModel, container) }
        if (savedInstanceState == null) viewModel.handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        viewModel.handleIntent(intent)
    }
}
