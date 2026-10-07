package de.kernich.pstviewer.ui.attachments

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.os.Build
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.AttachmentFile
import de.kernich.pstviewer.core.prepareMailDocument
import de.kernich.pstviewer.ui.components.EmptyState
import de.kernich.pstviewer.ui.message.MailCss
import de.kernich.pstviewer.ui.message.MailWebView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.nio.ByteBuffer

private const val MAX_IMAGE_SIDE = 4096

private sealed interface ImageState {
    data object Loading : ImageState

    data class Raster(val image: ImageBitmap) : ImageState

    /** Vector images (SVG) are shown by the WebView as a sanitised image. */
    data class Vector(val document: String) : ImageState

    data object Failed : ImageState
}

/** Decodes an image, scaled down so that no side exceeds [MAX_IMAGE_SIDE]. */
private fun decodeImage(data: ByteArray): Bitmap? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        return runCatching {
            ImageDecoder.decodeBitmap(ImageDecoder.createSource(ByteBuffer.wrap(data))) { decoder, info, _ ->
                val side = maxOf(info.size.width, info.size.height)
                if (side > MAX_IMAGE_SIDE) decoder.setTargetSampleSize((side + MAX_IMAGE_SIDE - 1) / MAX_IMAGE_SIDE)
            }
        }.getOrNull()
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(data, 0, data.size, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > MAX_IMAGE_SIDE) sample *= 2
    return BitmapFactory.decodeByteArray(data, 0, data.size, BitmapFactory.Options().apply { inSampleSize = sample })
}

/** An image attachment; pinch or double tap to zoom. */
@Composable
fun ImagePreview(file: AttachmentFile, onZoomed: (Boolean) -> Unit, onLinkFailed: () -> Unit, modifier: Modifier = Modifier) {
    val state by produceState<ImageState>(ImageState.Loading, file) {
        value = withContext(Dispatchers.Default) {
            decodeImage(file.data)?.let { ImageState.Raster(it.asImageBitmap()) }
                ?: if (file.mimeType.contains("svg") || file.fileName.endsWith(".svg", ignoreCase = true)) {
                    val source = "data:image/svg+xml;base64," + Base64.encodeToString(file.data, Base64.NO_WRAP)
                    ImageState.Vector(prepareMailDocument("<img src=\"$source\" style=\"max-width:100%;height:auto\">", emptyMap(), false, MailCss.HTML).html)
                } else {
                    ImageState.Failed
                }
        }
    }
    when (val current = state) {
        ImageState.Loading -> Box(modifier, contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        ImageState.Failed -> EmptyState(R.drawable.ic_error, stringResource(R.string.preview_failed), modifier)
        is ImageState.Vector -> MailWebView(current.document, allowRemote = false, transparent = false, wrapContent = false, onLinkFailed = onLinkFailed, modifier = modifier)
        is ImageState.Raster -> ZoomableImage(current.image, file.fileName, onZoomed, modifier)
    }
}

@Composable
private fun ZoomableImage(image: ImageBitmap, description: String, onZoomed: (Boolean) -> Unit, modifier: Modifier) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    LaunchedEffect(scale > 1.01f) { onZoomed(scale > 1.01f) }
    val transform = rememberTransformableState { _, zoom, pan, _ ->
        scale = (scale * zoom).coerceIn(1f, 6f)
        offset = if (scale == 1f) Offset.Zero else offset + pan * scale
    }
    Box(
        modifier
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .transformable(transform, canPan = { scale > 1f })
            .pointerInput(Unit) {
                detectTapGestures(onDoubleTap = {
                    scale = if (scale > 1f) 1f else 2.5f
                    offset = Offset.Zero
                })
            },
        contentAlignment = Alignment.Center,
    ) {
        Image(
            bitmap = image,
            contentDescription = description,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offset.x
                    translationY = offset.y
                },
        )
    }
}
