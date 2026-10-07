package de.kernich.pstviewer.ui

import android.app.Application
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import androidx.annotation.PluralsRes
import androidx.annotation.StringRes
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import de.kernich.pstviewer.BuildConfig
import de.kernich.pstviewer.PstViewerApp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.ArchiveSession
import de.kernich.pstviewer.core.AttachmentInfo
import de.kernich.pstviewer.core.AttachmentMeta
import de.kernich.pstviewer.core.CancelToken
import de.kernich.pstviewer.core.MessageRef
import de.kernich.pstviewer.core.OpenProgress
import de.kernich.pstviewer.data.ArchiveSource
import de.kernich.pstviewer.data.ErrorCode
import de.kernich.pstviewer.data.OpenArchive
import de.kernich.pstviewer.data.ProgressRelay
import de.kernich.pstviewer.data.describeLocation
import de.kernich.pstviewer.data.export.MessageExport
import java.io.File
import java.io.FileNotFoundException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface OpenState {
    data object Idle : OpenState

    data class Opening(val source: ArchiveSource, val progress: OpenProgress?) : OpenState

    data class Failed(val source: ArchiveSource, val code: ErrorCode) : OpenState
}

enum class ExportFormat(val mimeType: String, val extension: String) {
    PDF("application/pdf", "pdf"),
    EML("message/rfc822", "eml"),
    TEXT("text/plain", "txt"),
}

/** One-off effects the activity carries out (pickers, other apps, snackbars). */
sealed interface UiEffect {
    data class Message(@param:StringRes val text: Int, val args: List<Any> = emptyList()) : UiEffect

    /** A message with a count, from a plurals resource. */
    data class CountMessage(@param:PluralsRes val text: Int, val count: Int) : UiEffect

    data class OpenDocument(val folder: Boolean) : UiEffect

    data class CreateDocument(val name: String, val mimeType: String) : UiEffect

    data object ChooseFolder : UiEffect

    data class Launch(val intent: Intent) : UiEffect

    data class Print(val export: MessageExport) : UiEffect
}

/**
 * The app's top level: opening files (recent files, progress, errors), the open
 * archive, the back stack, and actions that write files or start other apps.
 */
class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val container = (app as PstViewerApp).container
    private val resolver get() = getApplication<Application>().contentResolver

    val backStack = mutableStateListOf<Route>(Route.Welcome)
    val recentFiles = container.recentFiles.files

    /** Keys of recent files that can no longer be opened. */
    var missingFiles by mutableStateOf(emptySet<String>())
        private set
    var openState by mutableStateOf<OpenState>(OpenState.Idle)
        private set
    var archive by mutableStateOf<OpenArchive?>(null)
        private set
    var exporting by mutableStateOf(false)
        private set

    /** Example query picked in the search syntax help, applied by the mailbox. */
    var pendingQuery by mutableStateOf<String?>(null)

    private val effectChannel = Channel<UiEffect>(Channel.BUFFERED)
    val effects: Flow<UiEffect> = effectChannel.receiveAsFlow()

    private sealed interface PendingSave {
        data class Export(val export: MessageExport, val format: ExportFormat) : PendingSave

        data class Attachment(val ref: MessageRef, val index: UInt) : PendingSave
    }

    private var pendingSave: PendingSave? = null
    private var pendingSaveAll: MessageRef? = null
    private var cancelToken: CancelToken? = null
    private var openCount = 0L

    /** Guards archives that finish opening while the view model is cleared. */
    private val lock = Any()
    private var cleared = false
    private var inFlight: OpenArchive? = null

    /** Copies of attachments handed to other apps; removed with the archive. */
    private val sharedCopies = ArrayList<File>()

    init {
        checkRecentFiles()
    }

    fun checkRecentFiles() {
        viewModelScope.launch {
            missingFiles = recentFiles.value.filterNot { container.recentFiles.exists(it) }.map { it.key }.toSet()
        }
    }

    fun removeRecentFile(key: String) {
        container.recentFiles.remove(key)
        val failed = openState
        if (failed is OpenState.Failed && failed.source.key == key) openState = OpenState.Idle
    }

    fun clearRecentFiles() = container.recentFiles.clear()

    // Opening and closing

    fun requestOpen(folder: Boolean) = send(UiEffect.OpenDocument(folder))

    /** A document from the picker or another app; [persist] keeps the read permission for the recent files. */
    fun openDocument(uri: Uri, persist: Boolean) {
        val remembered = persist && takePermission(uri)
        val source = runCatching { ArchiveSource.document(resolver, uri) }.getOrElse { ArchiveSource.Document(uri, uri.lastPathSegment.orEmpty(), -1) }
        open(source, remembered)
    }

    fun openTree(uri: Uri) {
        val remembered = takePermission(uri)
        val source = runCatching { ArchiveSource.tree(resolver, uri) }.getOrElse { ArchiveSource.Tree(uri, DocumentsContract.getTreeDocumentId(uri)) }
        open(source, remembered)
    }

    /** Opens an intent of another app (VIEW, SEND) or, in debug builds, a demo file. */
    fun handleIntent(intent: Intent) {
        when (intent.action) {
            Intent.ACTION_VIEW -> intent.data?.let { openDocument(it, persist = true) }
            Intent.ACTION_SEND -> intent.streamUri()?.let { openDocument(it, persist = true) }
        }
        if (BuildConfig.DEBUG) intent.getStringExtra(DEMO_OPEN)?.let { open(ArchiveSource.Path(it), remember = true) }
    }

    fun open(source: ArchiveSource, remember: Boolean = true) {
        if (openState is OpenState.Opening) return
        closeArchive()
        val relay = ProgressRelay()
        val token = CancelToken()
        val id = ++openCount
        cancelToken = token
        openState = OpenState.Opening(source, null)
        viewModelScope.launch {
            val progress = launch {
                relay.openProgress.collect { if (it != null && openState is OpenState.Opening) openState = OpenState.Opening(source, it) }
            }
            try {
                val opened = withContext(Dispatchers.IO) { openBlocking(id, source, relay, token) }
                synchronized(lock) { inFlight = null }
                archive = opened
                openState = OpenState.Idle
                missingFiles = missingFiles - source.key
                if (remember) {
                    container.recentFiles.add(source, describeLocation(getApplication(), source), opened.info.value.store.itemCount.toInt())
                }
                backStack.add(Route.Mailbox(opened.id))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                val code = ErrorCode.of(e)
                openState = if (code == ErrorCode.CANCELED) OpenState.Idle else OpenState.Failed(source, code)
                if (code == ErrorCode.NOT_FOUND) missingFiles = missingFiles + source.key
            } finally {
                progress.cancel()
                cancelToken = null
                token.destroy()
            }
        }
    }

    private fun openBlocking(id: Long, source: ArchiveSource, relay: ProgressRelay, token: CancelToken): OpenArchive {
        val session = OpenArchive.open(resolver, source, relay, token)
        val opened = try {
            OpenArchive(id, session, source, session.info(), relay)
        } catch (e: Exception) {
            session.destroy()
            throw e
        }
        synchronized(lock) {
            if (cleared) {
                opened.close(container.scope)
                throw CancellationException("Closed while opening")
            }
            inFlight = opened
        }
        return opened
    }

    fun cancelOpen() {
        cancelToken?.cancel()
    }

    fun dismissError() {
        if (openState is OpenState.Failed) openState = OpenState.Idle
    }

    /** Closes the archive and returns to the welcome screen. */
    fun closeArchive() {
        archive?.close(container.scope)
        archive = null
        pendingQuery = null
        sharedCopies.forEach(container.tempFiles::delete)
        sharedCopies.clear()
        if (backStack.size > 1) backStack.removeRange(1, backStack.size)
    }

    // Navigation

    fun navigate(route: Route) {
        backStack.add(route)
    }

    fun navigateBack() {
        if (backStack.lastOrNull() is Route.Mailbox) {
            closeArchive()
        } else if (backStack.size > 1) {
            backStack.removeAt(backStack.lastIndex)
        }
    }

    /** Applies an example of the search syntax help to the mailbox. */
    fun trySearch(query: String) {
        pendingQuery = query
        while (backStack.size > 1 && backStack.last() !is Route.Mailbox) backStack.removeAt(backStack.lastIndex)
    }

    // Exports

    fun export(export: MessageExport, format: ExportFormat) {
        pendingSave = PendingSave.Export(export, format)
        send(UiEffect.CreateDocument("${export.baseName}.${format.extension}", format.mimeType))
    }

    fun print(export: MessageExport) = send(UiEffect.Print(export))

    fun sharePdf(export: MessageExport) {
        if (exporting) return
        exporting = true
        viewModelScope.launch {
            try {
                val file = container.tempFiles.newExport("${export.baseName}.pdf")
                ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_CREATE or ParcelFileDescriptor.MODE_TRUNCATE or ParcelFileDescriptor.MODE_WRITE_ONLY).use {
                    container.renderer.writePdf(export.printDocument, export.allowRemote, export.paper, export.baseName, it)
                }
                send(UiEffect.Launch(shareIntent(file, ExportFormat.PDF.mimeType, export.subject)))
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                message(R.string.export_failed)
            } finally {
                exporting = false
            }
        }
    }

    // Attachments

    fun saveAttachment(ref: MessageRef, attachment: AttachmentInfo) {
        val open = archive ?: return
        viewModelScope.launch {
            try {
                // Name and type as the core writes the file (attached messages as .eml).
                val meta = open.call { it.attachmentMeta(ref, attachment.index) }
                pendingSave = PendingSave.Attachment(ref, attachment.index)
                send(UiEffect.CreateDocument(meta.fileName, meta.mimeType.ifEmpty { OCTET_STREAM }))
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                message(R.string.save_failed)
            }
        }
    }

    fun saveAttachments(ref: MessageRef) {
        pendingSaveAll = ref
        send(UiEffect.ChooseFolder)
    }

    /** Opens an attachment in another app as a read-only copy; types that could run code never. */
    fun openAttachmentWith(ref: MessageRef, attachment: AttachmentInfo) = withCopy(ref, attachment) { copy, meta ->
        val uri = container.tempFiles.uri(copy)
        val view = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, meta.mimeType.ifEmpty { OCTET_STREAM })
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        send(UiEffect.Launch(Intent.createChooser(view, null).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)))
    }

    fun shareAttachment(ref: MessageRef, attachment: AttachmentInfo) = withCopy(ref, attachment) { copy, meta ->
        send(UiEffect.Launch(shareIntent(copy, meta.mimeType.ifEmpty { OCTET_STREAM }, meta.fileName)))
    }

    /** Hands a read-only copy of an attachment in the cache to [action]; it is removed with the archive. */
    private fun withCopy(ref: MessageRef, attachment: AttachmentInfo, action: (File, AttachmentMeta) -> Unit) {
        if (!attachment.canOpen) return message(R.string.error_blocked)
        val open = archive ?: return
        viewModelScope.launch {
            try {
                val (copy, meta) = open.call { session -> saveCopy(session, ref, attachment.index) }
                sharedCopies.add(copy)
                action(copy, meta)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                message(R.string.preview_failed)
            }
        }
    }

    /** Writes an attachment into a new read-only file in the cache (blocking). */
    private fun saveCopy(session: ArchiveSession, ref: MessageRef, index: UInt): Pair<File, AttachmentMeta> {
        val file = container.tempFiles.newPreview(session.attachmentMeta(ref, index).fileName)
        try {
            val meta = session.saveAttachment(ref, index, file.absolutePath)
            file.setReadOnly()
            return file to meta
        } catch (e: Exception) {
            container.tempFiles.delete(file)
            throw e
        }
    }

    // Results of the pickers

    fun onDocumentCreated(uri: Uri?) {
        val pending = pendingSave ?: return
        pendingSave = null
        if (uri == null) return
        when (pending) {
            is PendingSave.Export -> writeExport(pending.export, pending.format, uri)
            is PendingSave.Attachment -> writeAttachment(pending.ref, pending.index, uri)
        }
    }

    fun onFolderChosen(tree: Uri?) {
        val ref = pendingSaveAll ?: return
        pendingSaveAll = null
        val open = archive ?: return
        if (tree == null) return
        viewModelScope.launch {
            try {
                val (saved, total) = open.call { session ->
                    val parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
                    val attachments = session.message(ref).attachments.filter { !it.isInline }
                    attachments.count { attachment ->
                        val meta = session.attachmentMeta(ref, attachment.index)
                        // The provider picks a unique name; existing files are never replaced.
                        val target = DocumentsContract.createDocument(resolver, parent, meta.mimeType.ifEmpty { OCTET_STREAM }, meta.fileName)
                        target != null && writeDocument(target) { fd -> session.saveAttachmentFd(ref, attachment.index, fd) }
                    } to attachments.size
                }
                if (saved == 0 && total > 0) message(R.string.save_failed) else send(UiEffect.CountMessage(R.plurals.files_saved, saved))
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                message(R.string.save_failed)
            }
        }
    }

    private fun writeExport(export: MessageExport, format: ExportFormat, uri: Uri) {
        exporting = true
        viewModelScope.launch {
            try {
                val written = when (format) {
                    ExportFormat.PDF -> {
                        val output = withContext(Dispatchers.IO) { runCatching { openForWriting(uri) }.getOrNull() }
                        output != null && try {
                            output.use { container.renderer.writePdf(export.printDocument, export.allowRemote, export.paper, export.baseName, it) }
                            true
                        } catch (e: Exception) {
                            withContext(NonCancellable + Dispatchers.IO) { deleteDocument(uri) }
                            if (e is CancellationException) throw e
                            false
                        }
                    }
                    ExportFormat.EML -> {
                        val open = archive ?: error("No archive")
                        open.call { session -> writeDocument(uri) { fd -> session.saveEmlFd(export.detail.messageRef, fd) } }
                    }
                    ExportFormat.TEXT -> withContext(Dispatchers.IO) {
                        writeDocument(uri) { fd -> ParcelFileDescriptor.AutoCloseOutputStream(ParcelFileDescriptor.adoptFd(fd)).use { it.write(export.text.toByteArray()) } }
                    }
                }
                message(if (written) R.string.exported else R.string.export_failed)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                message(R.string.export_failed)
            } finally {
                exporting = false
            }
        }
    }

    private fun writeAttachment(ref: MessageRef, index: UInt, uri: Uri) {
        val open = archive ?: return
        viewModelScope.launch {
            try {
                val saved = open.call { session -> writeDocument(uri) { fd -> session.saveAttachmentFd(ref, index, fd) } }
                message(if (saved) R.string.saved else R.string.save_failed)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                message(R.string.save_failed)
            }
        }
    }

    /**
     * Writes a document the user created (blocking): [write] gets a file
     * descriptor opened for writing ("wt" truncates) and must close it; the
     * core's save functions take it over. Once truncated, a document that
     * could not be written completely is removed.
     */
    private fun writeDocument(uri: Uri, write: (Int) -> Unit): Boolean {
        val fd = runCatching { openForWriting(uri).detachFd() }.getOrElse { return false }
        return try {
            write(fd)
            true
        } catch (_: Exception) {
            deleteDocument(uri)
            false
        }
    }

    private fun deleteDocument(uri: Uri) {
        runCatching { DocumentsContract.deleteDocument(resolver, uri) }
    }

    /** Opens a document the user created for writing (truncated); the caller closes it. */
    private fun openForWriting(uri: Uri): ParcelFileDescriptor =
        resolver.openFileDescriptor(uri, "wt") ?: throw FileNotFoundException(uri.toString())

    private fun shareIntent(file: File, mimeType: String, title: String): Intent {
        val uri = container.tempFiles.uri(file)
        val send = Intent(Intent.ACTION_SEND)
            .setType(mimeType)
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        send.clipData = ClipData.newRawUri(file.name, uri)
        return Intent.createChooser(send, title)
    }

    private fun takePermission(uri: Uri): Boolean = try {
        resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        true
    } catch (_: SecurityException) {
        false
    }

    fun message(@StringRes text: Int, vararg args: Any) = send(UiEffect.Message(text, args.toList()))

    private fun send(effect: UiEffect) {
        effectChannel.trySend(effect)
    }

    override fun onCleared() {
        cancelToken?.cancel()
        synchronized(lock) {
            cleared = true
            inFlight?.close(container.scope)
        }
        archive?.close(container.scope)
        sharedCopies.forEach(container.tempFiles::delete)
    }

    companion object {
        /** Debug builds: absolute path of a file in the app's storage to open (adb shell am start -e demoOpen …). */
        const val DEMO_OPEN = "demoOpen"

        private const val OCTET_STREAM = "application/octet-stream"
    }
}

@Suppress("DEPRECATION")
private fun Intent.streamUri(): Uri? =
    if (android.os.Build.VERSION.SDK_INT >= 33) getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java) else getParcelableExtra(Intent.EXTRA_STREAM)
