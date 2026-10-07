package de.kernich.pstviewer.data

import android.content.ContentResolver
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import java.io.File

/** A mail file or folder the user opened. */
sealed interface ArchiveSource {
    /** Identity in the recent files list. */
    val key: String
    val name: String
    val isFolder: Boolean

    /** A single document of the Storage Access Framework (ACTION_OPEN_DOCUMENT, VIEW, SEND). */
    data class Document(val uri: Uri, override val name: String, val size: Long) : ArchiveSource {
        override val key: String get() = uri.toString()
        override val isFolder: Boolean get() = false
    }

    /** A document tree (ACTION_OPEN_DOCUMENT_TREE): a folder of mail files. */
    data class Tree(val uri: Uri, override val name: String) : ArchiveSource {
        override val key: String get() = uri.toString()
        override val isFolder: Boolean get() = true

        /** Document URI of the tree's root directory. */
        val rootUri: Uri get() = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
    }

    /** A file in the app's own storage, opened by path (debug builds). */
    data class Path(val path: String) : ArchiveSource {
        override val key: String get() = path
        override val name: String get() = File(path).name
        override val isFolder: Boolean get() = File(path).isDirectory
    }

    companion object {
        /** Reads the display name and size of a single document. */
        fun document(resolver: ContentResolver, uri: Uri): Document {
            var name: String? = null
            var size = -1L
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    if (!cursor.isNull(0)) name = cursor.getString(0)
                    if (!cursor.isNull(1)) size = cursor.getLong(1)
                }
            }
            return Document(uri, name ?: uri.lastPathSegment.orEmpty(), size)
        }

        /** Reads the display name of a document tree. */
        fun tree(resolver: ContentResolver, uri: Uri): Tree {
            val root = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
            var name: String? = null
            resolver.query(root, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst() && !cursor.isNull(0)) name = cursor.getString(0)
            }
            return Tree(uri, name ?: DocumentsContract.getTreeDocumentId(uri).substringAfterLast('/').substringAfterLast(':'))
        }
    }
}

private const val EXTERNAL_STORAGE = "com.android.externalstorage.documents"

/**
 * Where a document lives, for the recent files list: its folder on the
 * device's storage if the provider reveals it, otherwise the provider's name
 * (e.g. "Downloads" or "Drive").
 */
fun describeLocation(context: Context, source: ArchiveSource): String {
    val uri = when (source) {
        is ArchiveSource.Document -> source.uri
        is ArchiveSource.Tree -> source.uri
        is ArchiveSource.Path -> return File(source.path).parent.orEmpty()
    }
    val authority = uri.authority ?: return ""
    if (authority == EXTERNAL_STORAGE) {
        val documentId = runCatching {
            if (source is ArchiveSource.Tree) DocumentsContract.getTreeDocumentId(uri) else DocumentsContract.getDocumentId(uri)
        }.getOrNull()
        val folder = documentId?.substringAfter(':', "")?.substringBeforeLast('/', "")
        if (!folder.isNullOrEmpty()) return folder
    }
    return runCatching {
        val pm = context.packageManager
        val provider = if (Build.VERSION.SDK_INT >= 33) {
            pm.resolveContentProvider(authority, PackageManager.ComponentInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            pm.resolveContentProvider(authority, 0)
        }
        provider?.loadLabel(pm)?.toString()
    }.getOrNull().orEmpty()
}
