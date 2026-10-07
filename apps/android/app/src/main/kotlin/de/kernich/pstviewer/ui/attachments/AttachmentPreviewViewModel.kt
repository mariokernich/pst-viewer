package de.kernich.pstviewer.ui.attachments

import androidx.compose.runtime.mutableStateMapOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.kernich.pstviewer.core.ArchiveSession
import de.kernich.pstviewer.core.AttachmentFile
import de.kernich.pstviewer.core.AttachmentInfo
import de.kernich.pstviewer.core.MessageRef
import de.kernich.pstviewer.core.PreviewKind
import de.kernich.pstviewer.data.ErrorCode
import de.kernich.pstviewer.data.OpenArchive
import de.kernich.pstviewer.data.TempFiles
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.io.File

sealed interface PreviewState {
    data object Loading : PreviewState

    /** The attachment's bytes, for viewers that render from memory. */
    data class Loaded(val file: AttachmentFile) : PreviewState

    /** A read-only copy in the cache, for viewers that need a file (PDF, audio, video). */
    data class Copied(val file: File) : PreviewState

    data class Failed(val code: ErrorCode) : PreviewState
}

/** Viewers that read a file instead of bytes in memory. */
private val FILE_VIEWERS = setOf(PreviewKind.PDF, PreviewKind.AUDIO, PreviewKind.VIDEO)

/** Kinds without a preview: name, type and size come from the attachment list. */
val PreviewKind.hasPreview: Boolean get() = this != PreviewKind.NONE && this != PreviewKind.MESSAGE

/**
 * Loads the attachments of one message for previews. The core tells the
 * preview kind up front, so files without a preview are never read, and large
 * media go straight from the archive into a cache file. Only the attachment on
 * screen and its neighbours are kept; their copies are deleted when they are
 * released or the preview is closed.
 */
class AttachmentPreviewViewModel(
    private val archive: OpenArchive,
    private val tempFiles: TempFiles,
    val message: MessageRef,
    val attachments: List<AttachmentInfo>,
) : ViewModel() {
    private val states = mutableStateMapOf<UInt, PreviewState>()

    fun state(index: UInt): PreviewState = states[index] ?: PreviewState.Loading

    /** Loads the attachment at [position] and its neighbours, releasing the others. */
    fun focus(position: Int) {
        val keep = (position - 1..position + 1).mapNotNull { attachments.getOrNull(it) }
        val indices = keep.map { it.index }.toSet()
        states.keys.filter { it !in indices }.forEach { release(it) }
        keep.filter { it.previewKind.hasPreview }.forEach(::load)
    }

    fun retry(attachment: AttachmentInfo) {
        release(attachment.index)
        load(attachment)
    }

    private fun load(attachment: AttachmentInfo) {
        val index = attachment.index
        if (index in states) return
        states[index] = PreviewState.Loading
        viewModelScope.launch {
            val state = try {
                if (attachment.previewKind in FILE_VIEWERS) {
                    PreviewState.Copied(archive.call { session -> copy(session, index) })
                } else {
                    PreviewState.Loaded(archive.call { it.attachment(message, index) })
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                PreviewState.Failed(ErrorCode.of(e))
            }
            // Released while loading: the copy is not needed any more.
            if (states[index] == PreviewState.Loading) states[index] = state else (state as? PreviewState.Copied)?.let { tempFiles.delete(it.file) }
        }
    }

    /** Lets the core write the attachment into a new read-only cache file (blocking). */
    private fun copy(session: ArchiveSession, index: UInt): File {
        val file = tempFiles.newPreview(session.attachmentMeta(message, index).fileName)
        try {
            session.saveAttachment(message, index, file.absolutePath)
            file.setReadOnly()
            return file
        } catch (e: Exception) {
            tempFiles.delete(file)
            throw e
        }
    }

    private fun release(index: UInt) {
        (states.remove(index) as? PreviewState.Copied)?.let { tempFiles.delete(it.file) }
    }

    override fun onCleared() {
        states.values.filterIsInstance<PreviewState.Copied>().forEach { tempFiles.delete(it.file) }
    }
}
