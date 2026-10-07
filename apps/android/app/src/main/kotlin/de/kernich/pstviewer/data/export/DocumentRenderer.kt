package de.kernich.pstviewer.data.export

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PdfWriter
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.MainThread
import de.kernich.pstviewer.data.MailWeb
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.Locale
import kotlin.coroutines.resume

/** Paper of exported and printed messages: Letter in North America, A4 elsewhere (like the desktop app). */
enum class PaperSize(val css: String, val media: PrintAttributes.MediaSize) {
    A4("A4", PrintAttributes.MediaSize.ISO_A4),
    LETTER("letter", PrintAttributes.MediaSize.NA_LETTER);

    companion object {
        private val LETTER_REGIONS = setOf("US", "CA", "MX", "PH", "CL", "CO", "VE")

        fun forLocale(locale: Locale = Locale.getDefault(Locale.Category.FORMAT)): PaperSize =
            if (locale.country in LETTER_REGIONS) LETTER else A4
    }
}

/**
 * Adds the page layout to a print document of the core: margins and a footer
 * with the subject and page numbers (CSS page margin boxes, as in the desktop
 * app's PDF footer).
 */
fun withPageLayout(document: String, footer: String, paper: PaperSize): String {
    val text = if (footer.length > FOOTER_LENGTH) footer.take(FOOTER_LENGTH).trimEnd() + "…" else footer
    val box = "font:7.5pt sans-serif;color:#8e8e93"
    val css = "@page{size:${paper.css};margin:0.55in 0.55in 0.65in;" +
        "@bottom-left{content:\"${cssString(text)}\";$box}" +
        "@bottom-right{content:counter(page) \" / \" counter(pages);$box}}"
    val head = document.indexOf("</head>")
    return if (head < 0) document else document.substring(0, head) + "<style>$css</style>" + document.substring(head)
}

private const val FOOTER_LENGTH = 90

private fun cssString(text: String): String = buildString {
    for (c in text) {
        when (c) {
            '\\' -> append("\\\\")
            '"' -> append("\\\"")
            '<' -> append("\\3C ")
            '\n', '\r', '\t' -> append(' ')
            else -> append(c)
        }
    }
}

/**
 * Renders print documents in an offscreen, locked down WebView: into a PDF
 * file, or through the system print dialog.
 */
class DocumentRenderer(private val context: Context) {
    private var printing: WebView? = null

    @MainThread
    suspend fun writePdf(html: String, allowRemote: Boolean, paper: PaperSize, jobName: String, output: ParcelFileDescriptor) {
        val webView = load(html, allowRemote)
        try {
            PdfWriter.write(webView.createPrintDocumentAdapter(jobName), attributes(paper), output)
        } finally {
            webView.destroy()
        }
    }

    @MainThread
    suspend fun print(activity: Activity, html: String, allowRemote: Boolean, paper: PaperSize, jobName: String) {
        printing?.destroy()
        val webView = load(html, allowRemote)
        printing = webView
        val adapter = FinishingAdapter(webView.createPrintDocumentAdapter(jobName)) {
            if (printing === webView) printing = null
            webView.destroy()
        }
        activity.getSystemService(PrintManager::class.java).print(jobName, adapter, attributes(paper))
    }

    private fun attributes(paper: PaperSize): PrintAttributes = PrintAttributes.Builder()
        .setMediaSize(paper.media)
        .setResolution(PrintAttributes.Resolution("pdf", "pdf", 600, 600))
        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
        .build()

    private suspend fun load(html: String, allowRemote: Boolean): WebView = suspendCancellableCoroutine { continuation ->
        val webView = WebView(context)
        MailWeb.lockDown(webView, allowRemote)
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                MailWeb.intercept(request, allowRemote)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true

            override fun onPageFinished(view: WebView, url: String?) {
                if (continuation.isActive) continuation.resume(view)
            }
        }
        continuation.invokeOnCancellation { webView.post { webView.destroy() } }
        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }

    /** Destroys the print WebView once the print dialog is done with the document. */
    private class FinishingAdapter(private val inner: PrintDocumentAdapter, private val onDone: () -> Unit) : PrintDocumentAdapter() {
        override fun onStart() = inner.onStart()

        override fun onLayout(
            oldAttributes: PrintAttributes?,
            newAttributes: PrintAttributes,
            cancellationSignal: CancellationSignal?,
            callback: LayoutResultCallback,
            extras: Bundle?,
        ) = inner.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras)

        override fun onWrite(
            pages: Array<out PageRange>,
            destination: ParcelFileDescriptor,
            cancellationSignal: CancellationSignal?,
            callback: WriteResultCallback,
        ) = inner.onWrite(pages, destination, cancellationSignal, callback)

        override fun onFinish() {
            inner.onFinish()
            onDone()
        }
    }
}
