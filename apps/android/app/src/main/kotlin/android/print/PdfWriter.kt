package android.print

import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Runs a print adapter (e.g. a WebView's) into a PDF file without the print
 * dialog. Lives in android.print because the result callbacks can only be
 * subclassed from this package.
 */
object PdfWriter {
    suspend fun write(adapter: PrintDocumentAdapter, attributes: PrintAttributes, output: ParcelFileDescriptor) {
        val cancellation = CancellationSignal()
        try {
            adapter.onStart()
            suspendCancellableCoroutine { continuation ->
                continuation.invokeOnCancellation { cancellation.cancel() }
                adapter.onLayout(null, attributes, cancellation, LayoutCallback(adapter, output, cancellation, continuation), null)
            }
        } finally {
            adapter.onFinish()
        }
    }

    private class LayoutCallback(
        private val adapter: PrintDocumentAdapter,
        private val output: ParcelFileDescriptor,
        private val cancellation: CancellationSignal,
        private val continuation: CancellableContinuation<Unit>,
    ) : PrintDocumentAdapter.LayoutResultCallback() {
        override fun onLayoutFinished(info: PrintDocumentInfo, changed: Boolean) {
            adapter.onWrite(arrayOf(PageRange.ALL_PAGES), output, cancellation, WriteCallback(continuation))
        }

        override fun onLayoutFailed(error: CharSequence?) {
            continuation.resumeWithException(IOException("Layout failed: $error"))
        }

        override fun onLayoutCancelled() {
            continuation.cancel()
        }
    }

    private class WriteCallback(private val continuation: CancellableContinuation<Unit>) :
        PrintDocumentAdapter.WriteResultCallback() {
        override fun onWriteFinished(pages: Array<out PageRange>) {
            continuation.resume(Unit)
        }

        override fun onWriteFailed(error: CharSequence?) {
            continuation.resumeWithException(IOException("Write failed: $error"))
        }

        override fun onWriteCancelled() {
            continuation.cancel()
        }
    }
}
