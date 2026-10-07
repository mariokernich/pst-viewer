package de.kernich.pstviewer.ui.message

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.material3.ColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.viewinterop.AndroidView
import de.kernich.pstviewer.data.MailWeb
import de.kernich.pstviewer.ui.theme.StatusColors
import de.kernich.pstviewer.util.HIGHLIGHT_CLASS
import java.util.Locale
import kotlin.math.roundToInt

/** Styles that adapt mail documents of the core to the app's typography. */
object MailCss {
    private const val BASE = "body{margin:0;padding:16px;font-family:sans-serif;font-size:16px;line-height:1.5}"
    private const val MARK = "mark.$HIGHLIGHT_CLASS{border-radius:2px;padding:0 1px;box-decoration-break:clone;-webkit-box-decoration-break:clone}"

    /** HTML mails keep their own colours on white paper; search matches as on the desktop. */
    const val HTML = "$BASE $MARK mark.$HIGHLIGHT_CLASS{background:#FFE168;color:#1D1D1F}"

    /** Plain text follows the app theme. */
    fun text(colors: ColorScheme, status: StatusColors): String =
        "$BASE $MARK body{color:${css(colors.onSurface)};background:transparent}a{color:${css(colors.primary)}}" +
            "mark.$HIGHLIGHT_CLASS{background:${css(status.highlight)};color:${css(status.onHighlight)}}" +
            // Quoted lines ("> …"), marked by the core.
            ".pst-quote{border-left-color:${css(colors.outlineVariant)};color:${css(colors.onSurfaceVariant)}}"

    private fun css(color: androidx.compose.ui.graphics.Color) = String.format(Locale.ROOT, "#%06X", color.toArgb() and 0xFFFFFF)
}

/**
 * Shows a mail document prepared by the core (sanitised, CSP locked) in a
 * WebView without JavaScript, storage or file access. Network requests are
 * blocked unless the user allowed remote images; links open in other apps.
 * With [wrapContent] the view takes the height of its content so that it
 * scrolls together with the message header.
 */
@Composable
fun MailWebView(
    html: String,
    allowRemote: Boolean,
    transparent: Boolean,
    wrapContent: Boolean,
    onLinkFailed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val fontScale = LocalDensity.current.fontScale
    val linkFailed by rememberUpdatedState(onLinkFailed)
    AndroidView(
        factory = { context ->
            WebView(context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    if (wrapContent) ViewGroup.LayoutParams.WRAP_CONTENT else ViewGroup.LayoutParams.MATCH_PARENT,
                )
                isVerticalScrollBarEnabled = !wrapContent
                settings.builtInZoomControls = !wrapContent
                settings.displayZoomControls = false
                webViewClient = MailClient { linkFailed() }
            }
        },
        update = { view ->
            MailWeb.lockDown(view, allowRemote)
            view.settings.textZoom = (fontScale * 100).roundToInt()
            view.setBackgroundColor(if (transparent) Color.TRANSPARENT else Color.WHITE)
            val client = view.webViewClient as MailClient
            client.allowRemote = allowRemote
            val key = html.hashCode() to allowRemote
            if (view.tag != key) {
                view.tag = key
                view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
            }
        },
        onRelease = WebView::destroy,
        modifier = modifier,
    )
}

private class MailClient(private val onLinkFailed: () -> Unit) : WebViewClient() {
    var allowRemote = false

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
        MailWeb.intercept(request, allowRemote)

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val url = request.url
        val intent = when (url.scheme?.lowercase()) {
            "http", "https" -> Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE)
            "mailto" -> Intent(Intent.ACTION_SENDTO, url)
            "tel" -> Intent(Intent.ACTION_DIAL, url)
            // Anchors within the document.
            "about" -> return false
            else -> null
        }
        if (intent != null) open(view.context, intent)
        return true
    }

    private fun open(context: Context, intent: Intent) {
        try {
            context.startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            onLinkFailed()
        }
    }
}
