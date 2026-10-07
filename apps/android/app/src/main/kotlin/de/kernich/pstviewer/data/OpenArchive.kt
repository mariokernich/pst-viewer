package de.kernich.pstviewer.data

import android.content.ContentResolver
import de.kernich.pstviewer.core.ArchiveListener
import de.kernich.pstviewer.core.ArchiveSession
import de.kernich.pstviewer.core.CancelToken
import de.kernich.pstviewer.core.DirEntry
import de.kernich.pstviewer.core.IndexProgress
import de.kernich.pstviewer.core.MessageRef
import de.kernich.pstviewer.core.OpenProgress
import de.kernich.pstviewer.core.OpenResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Receives the core's progress reports (on the archive's worker thread). */
class ProgressRelay : ArchiveListener {
    val openProgress = MutableStateFlow<OpenProgress?>(null)
    val indexProgress = MutableStateFlow<IndexProgress?>(null)

    override fun onOpenProgress(progress: OpenProgress) {
        openProgress.value = progress
    }

    override fun onIndexProgress(progress: IndexProgress) {
        indexProgress.value = progress
    }
}

/**
 * An archive opened by the core plus the state that lives as long as it is
 * open. Session calls block until the archive's worker answers, so they run on
 * the IO dispatcher.
 */
class OpenArchive(
    /** Distinguishes archives opened one after another (e.g. the same file twice). */
    val id: Long,
    private val session: ArchiveSession,
    val source: ArchiveSource,
    info: OpenResult,
    relay: ProgressRelay,
) {
    private val _info = MutableStateFlow(info)

    /** Store, folders and senders; refreshed once the content is indexed. */
    val info: StateFlow<OpenResult> = _info.asStateFlow()

    /** Background indexing of bodies and attachments. */
    val indexProgress: StateFlow<IndexProgress?> = relay.indexProgress

    private val _remoteAllowed = MutableStateFlow<Set<MessageRef>>(emptySet())

    /** Messages whose remote images the user allowed while the archive is open. */
    val remoteAllowed: StateFlow<Set<MessageRef>> = _remoteAllowed.asStateFlow()

    suspend fun <T> call(block: (ArchiveSession) -> T): T = withContext(Dispatchers.IO) { block(session) }

    suspend fun refreshInfo(): OpenResult = call { it.info() }.also { _info.value = it }

    fun allowRemote(ref: MessageRef) = _remoteAllowed.update { it + ref }

    /** Stops the worker and releases the files in the background. */
    fun close(scope: CoroutineScope) {
        scope.launch(Dispatchers.IO) {
            runCatching { session.closeArchive() }
            session.destroy()
        }
    }

    companion object {
        /** Opens a source; blocks until the item list is built. */
        fun open(resolver: ContentResolver, source: ArchiveSource, relay: ProgressRelay, cancel: CancelToken): ArchiveSession = when (source) {
            is ArchiveSource.Document -> ArchiveSession.openWithAccess(
                DirEntry(source.uri.toString(), source.name, false, source.size.coerceAtLeast(0)),
                SafFileAccess(resolver),
                relay,
                cancel,
            )
            is ArchiveSource.Tree -> ArchiveSession.openWithAccess(
                DirEntry(source.rootUri.toString(), source.name, true, 0),
                SafFileAccess(resolver),
                relay,
                cancel,
            )
            is ArchiveSource.Path -> ArchiveSession.open(source.path, relay, cancel)
        }
    }
}
