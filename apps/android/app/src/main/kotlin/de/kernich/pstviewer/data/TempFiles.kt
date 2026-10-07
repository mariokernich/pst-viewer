package de.kernich.pstviewer.data

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import de.kernich.pstviewer.core.sanitizeFileName
import java.io.File
import java.util.UUID

/**
 * Temporary files in the cache: read-only copies of attachments that are
 * previewed or handed to other apps, and exports to share. Each copy lives in
 * its own directory; everything is removed when the app starts.
 */
class TempFiles(private val context: Context) {
    private val previews = File(context.cacheDir, "previews")
    private val exports = File(context.cacheDir, "exports")

    fun clear() {
        previews.deleteRecursively()
        exports.deleteRecursively()
    }

    /** A path in a new directory for a copy of an attachment, which the core writes (then made read-only). */
    fun newPreview(name: String): File = File(newDirectory(previews), sanitizeFileName(name, "attachment"))

    /** A path in a new directory for an export that is written later (e.g. a PDF). */
    fun newExport(name: String): File = File(newDirectory(exports), sanitizeFileName(name, "export"))

    /** Removes a file made by [newPreview] or [newExport] together with its directory. */
    fun delete(file: File) {
        file.parentFile?.takeIf { it.parentFile == previews || it.parentFile == exports }?.deleteRecursively()
    }

    fun uri(file: File): Uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)

    private fun newDirectory(root: File): File = File(root, UUID.randomUUID().toString()).apply { mkdirs() }
}
