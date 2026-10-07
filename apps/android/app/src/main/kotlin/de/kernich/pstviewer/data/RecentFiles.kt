package de.kernich.pstviewer.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.core.content.edit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import androidx.core.net.toUri
import java.io.File

/** An entry of the recent files list: metadata only, never mail content. */
data class RecentFile(
    val key: String,
    val name: String,
    val location: String,
    val isFolder: Boolean,
    val size: Long,
    val itemCount: Int?,
    val lastOpened: Long,
) {
    fun toSource(): ArchiveSource = when {
        !key.startsWith(CONTENT_SCHEME) -> ArchiveSource.Path(key)
        isFolder -> ArchiveSource.Tree(key.toUri(), name)
        else -> ArchiveSource.Document(key.toUri(), name, size)
    }
}

private const val CONTENT_SCHEME = "content:"

/**
 * Recently opened files and folders, kept in private preferences together with
 * the persisted read permission of their content URIs.
 */
class RecentFiles(private val context: Context) {
    private val preferences = context.getSharedPreferences("recent_files", Context.MODE_PRIVATE)
    private val _files = MutableStateFlow(load())
    val files: StateFlow<List<RecentFile>> = _files.asStateFlow()

    fun add(source: ArchiveSource, location: String, itemCount: Int) {
        val size = (source as? ArchiveSource.Document)?.size ?: (source as? ArchiveSource.Path)?.let { File(it.path).length() } ?: 0
        val entry = RecentFile(source.key, source.name, location, source.isFolder, size, itemCount, System.currentTimeMillis())
        save(listOf(entry) + _files.value.filter { it.key != source.key }.take(MAX_RECENT - 1))
    }

    fun remove(key: String) {
        release(key)
        save(_files.value.filter { it.key != key })
    }

    fun clear() {
        _files.value.forEach { release(it.key) }
        save(emptyList())
    }

    /** Whether a recent file can still be opened (permission and document present). */
    suspend fun exists(file: RecentFile): Boolean = withContext(Dispatchers.IO) {
        when (val source = file.toSource()) {
            is ArchiveSource.Path -> File(source.path).exists()
            is ArchiveSource.Document -> canQuery(source.uri)
            is ArchiveSource.Tree -> canQuery(source.rootUri)
        }
    }

    private fun canQuery(uri: Uri): Boolean = runCatching {
        context.contentResolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null)?.use { it.moveToFirst() } == true
    }.getOrDefault(false)

    private fun release(key: String) {
        if (!key.startsWith(CONTENT_SCHEME)) return
        val uri = key.toUri()
        val held = context.contentResolver.persistedUriPermissions.any { it.uri == uri }
        if (held) runCatching { context.contentResolver.releasePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
    }

    private fun load(): List<RecentFile> = runCatching {
        val array = JSONArray(preferences.getString(KEY, "[]"))
        List(array.length()) { index ->
            val o = array.getJSONObject(index)
            RecentFile(
                key = o.getString("key"),
                name = o.getString("name"),
                location = o.optString("location"),
                isFolder = o.optBoolean("isFolder"),
                size = o.optLong("size"),
                itemCount = if (o.has("itemCount")) o.getInt("itemCount") else null,
                lastOpened = o.optLong("lastOpened"),
            )
        }
    }.getOrDefault(emptyList())

    private fun save(files: List<RecentFile>) {
        _files.value = files
        val array = JSONArray()
        files.forEach { file ->
            array.put(
                JSONObject()
                    .put("key", file.key)
                    .put("name", file.name)
                    .put("location", file.location)
                    .put("isFolder", file.isFolder)
                    .put("size", file.size)
                    .put("lastOpened", file.lastOpened)
                    .apply { file.itemCount?.let { put("itemCount", it) } },
            )
        }
        preferences.edit { putString(KEY, array.toString()) }
    }

    private companion object {
        const val KEY = "files"
        const val MAX_RECENT = 12
    }
}
