package de.kernich.pstviewer.data

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import java.io.ByteArrayInputStream

/**
 * Network and feature policy for WebViews showing mail content (documents
 * prepared by the core with a strict Content Security Policy).
 */
object MailWeb {
    /** Disables everything mail content does not need: scripts, file and content access, storage. */
    fun lockDown(webView: WebView, allowRemote: Boolean) {
        with(webView.settings) {
            javaScriptEnabled = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            allowFileAccess = false
            allowContentAccess = false
            domStorageEnabled = false
            setGeolocationEnabled(false)
            mediaPlaybackRequiresUserGesture = true
            safeBrowsingEnabled = true
            blockNetworkLoads = !allowRemote
        }
    }

    /**
     * Only embedded data loads; remote content only for a message whose images
     * the user allowed. Returns null to let a request through.
     */
    fun intercept(request: WebResourceRequest, allowRemote: Boolean): WebResourceResponse? {
        val scheme = request.url.scheme?.lowercase()
        if (scheme == "data" || scheme == "about") return null
        if (allowRemote && (scheme == "https" || scheme == "http") && request.method == "GET") return null
        return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
    }
}
