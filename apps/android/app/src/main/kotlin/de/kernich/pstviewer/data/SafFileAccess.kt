package de.kernich.pstviewer.data

import android.content.ContentResolver
import android.provider.DocumentsContract
import androidx.core.net.toUri
import de.kernich.pstviewer.core.CoreException
import de.kernich.pstviewer.core.DirEntry
import de.kernich.pstviewer.core.FileAccess
import java.io.FileNotFoundException

/**
 * Lets the core read content URIs of the Storage Access Framework in place:
 * document trees are listed with DocumentsContract (ids are document URIs) and
 * files are handed over as read-only file descriptors, which the core owns.
 */
class SafFileAccess(private val resolver: ContentResolver) : FileAccess {
    override fun list(directory: String): List<DirEntry> {
        val directoryUri = directory.toUri()
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(directoryUri, DocumentsContract.getDocumentId(directoryUri))
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
        )
        val cursor = guarded { resolver.query(children, projection, null, null, null) }
            ?: throw CoreException.NotFound("Cannot list $directory")
        return cursor.use {
            buildList {
                while (it.moveToNext()) {
                    val id = it.getString(0) ?: continue
                    add(
                        DirEntry(
                            id = DocumentsContract.buildDocumentUriUsingTree(directoryUri, id).toString(),
                            name = it.getString(1).orEmpty(),
                            isDirectory = it.getString(2) == DocumentsContract.Document.MIME_TYPE_DIR,
                            size = if (it.isNull(3)) 0 else it.getLong(3),
                        ),
                    )
                }
            }
        }
    }

    override fun openFd(file: String): Int {
        val descriptor = guarded { resolver.openFileDescriptor(file.toUri(), "r") }
            ?: throw CoreException.NotFound("Cannot open $file")
        return descriptor.detachFd()
    }

    /** Maps provider failures to the core's errors. */
    private inline fun <T> guarded(block: () -> T): T = try {
        block()
    } catch (e: FileNotFoundException) {
        throw CoreException.NotFound(e.message.orEmpty())
    } catch (e: SecurityException) {
        throw CoreException.NotFound(e.message.orEmpty())
    } catch (e: IllegalArgumentException) {
        throw CoreException.NotFound(e.message.orEmpty())
    } catch (e: RuntimeException) {
        throw CoreException.ReadFailed(e.message.orEmpty())
    }
}
