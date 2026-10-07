package de.kernich.pstviewer.ui.attachments

import android.graphics.Color as AndroidColor
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.core.graphics.createBitmap
import de.kernich.pstviewer.R
import de.kernich.pstviewer.ui.components.EmptyState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.roundToInt

private const val MAX_ZOOM = 4f
private const val MAX_RENDER_WIDTH = 2200
private val MAX_PAGE_WIDTH = 720.dp

/** An open PDF; pages are rendered one at a time (PdfRenderer is not thread-safe). */
private class PdfPages(private val descriptor: ParcelFileDescriptor, private val renderer: PdfRenderer) {
    private val mutex = Mutex()
    private var closed = false
    val sizes: List<IntSize> = List(renderer.pageCount) { index -> renderer.openPage(index).use { IntSize(it.width, it.height) } }

    suspend fun render(index: Int, width: Int): ImageBitmap? = mutex.withLock {
        withContext(Dispatchers.IO) {
            if (closed) return@withContext null
            renderer.openPage(index).use { page ->
                val height = (width.toLong() * page.height / page.width).toInt().coerceAtLeast(1)
                val bitmap = createBitmap(width, height)
                bitmap.eraseColor(AndroidColor.WHITE)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                bitmap.asImageBitmap()
            }
        }
    }

    fun close(scope: CoroutineScope) {
        scope.launch(Dispatchers.IO) {
            mutex.withLock {
                closed = true
                renderer.close()
                descriptor.close()
            }
        }
    }

    companion object {
        suspend fun open(file: File): PdfPages = withContext(Dispatchers.IO) {
            val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            try {
                PdfPages(descriptor, PdfRenderer(descriptor))
            } catch (e: Exception) {
                descriptor.close()
                throw e
            }
        }
    }
}

private sealed interface PdfState {
    data object Loading : PdfState

    data class Ready(val pages: PdfPages) : PdfState

    data object Failed : PdfState
}

/** Pages of a PDF, rendered on the device; pinch, double tap or the buttons zoom. */
@Composable
fun PdfPreview(copy: suspend () -> File, onZoomed: (Boolean) -> Unit, modifier: Modifier = Modifier) {
    val state by produceState<PdfState>(PdfState.Loading) {
        val pages = runCatching { PdfPages.open(copy()) }.getOrNull()
        value = if (pages != null) PdfState.Ready(pages) else PdfState.Failed
        awaitDispose { pages?.close(CoroutineScope(Dispatchers.IO)) }
    }
    when (val current = state) {
        PdfState.Loading -> Box(modifier, contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        PdfState.Failed -> EmptyState(R.drawable.ic_error, stringResource(R.string.preview_failed), modifier)
        is PdfState.Ready -> PdfPagesView(current.pages, onZoomed, modifier)
    }
}

@Composable
private fun PdfPagesView(pages: PdfPages, onZoomed: (Boolean) -> Unit, modifier: Modifier) {
    var scale by remember { mutableFloatStateOf(1f) }
    LaunchedEffect(scale > 1.01f) { onZoomed(scale > 1.01f) }
    val transform = rememberTransformableState { _, zoom, _, _ -> scale = (scale * zoom).coerceIn(1f, MAX_ZOOM) }
    BoxWithConstraints(modifier.background(MaterialTheme.colorScheme.surfaceContainerHigh)) {
        val viewport = constraints.maxWidth
        val density = LocalDensity.current
        // Pages fill the width of phones and stay at a readable width on tablets.
        val pageWidth = minOf(viewport, with(density) { MAX_PAGE_WIDTH.roundToPx() })
        val zoomedWidth = (pageWidth * scale).roundToInt()
        // Pages are laid out wider when zoomed; sharper renderings follow in steps.
        val renderWidth = (pageWidth * if (scale > 1.5f) 2 else 1).coerceAtMost(MAX_RENDER_WIDTH)
        val currentWidth = rememberUpdatedState(renderWidth)
        Box(
            Modifier
                .fillMaxSize()
                .transformable(transform, canPan = { false })
                .pointerInput(Unit) { detectTapGestures(onDoubleTap = { scale = if (scale > 1f) 1f else 2f }) }
                .horizontalScroll(rememberScrollState()),
        ) {
            // The list spans at least the viewport (so it scrolls anywhere); narrower pages are centred.
            val side = with(density) { (maxOf(viewport - zoomedWidth, 0) / 2).toDp() } + 12.dp
            LazyColumn(
                modifier = Modifier.width(with(density) { maxOf(viewport, zoomedWidth).toDp() }).fillMaxHeight(),
                contentPadding = PaddingValues(horizontal = side, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(pages.sizes.size) { index ->
                    val size = pages.sizes[index]
                    val bitmap by produceState<ImageBitmap?>(null, index) {
                        snapshotFlow { currentWidth.value }.collectLatest { width -> value = pages.render(index, width) }
                    }
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .aspectRatio(size.width.toFloat() / size.height.coerceAtLeast(1))
                            .background(Color.White),
                    ) {
                        bitmap?.let {
                            Image(
                                it,
                                contentDescription = stringResource(R.string.pdf_page, index + 1, pages.sizes.size),
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.FillBounds,
                            )
                        }
                    }
                }
            }
        }
        Column(
            Modifier.align(Alignment.BottomEnd).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SmallFloatingActionButton(onClick = { scale = (scale * 1.5f).coerceAtMost(MAX_ZOOM) }) {
                Icon(painterResource(R.drawable.ic_zoom_in), contentDescription = stringResource(R.string.zoom_in))
            }
            SmallFloatingActionButton(onClick = { scale = (scale / 1.5f).coerceAtLeast(1f) }) {
                Icon(painterResource(R.drawable.ic_zoom_out), contentDescription = stringResource(R.string.zoom_out))
            }
        }
    }
}
