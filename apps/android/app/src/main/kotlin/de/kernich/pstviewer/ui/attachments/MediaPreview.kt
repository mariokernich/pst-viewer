package de.kernich.pstviewer.ui.attachments

import android.media.MediaPlayer
import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import de.kernich.pstviewer.R
import de.kernich.pstviewer.ui.components.EmptyState
import de.kernich.pstviewer.ui.components.SymbolIcon
import kotlinx.coroutines.delay
import java.io.File
import java.util.Locale

/** Loads the file copy that the media players need. */
@Composable
private fun rememberCopy(copy: suspend () -> File): Result<File>? {
    val file by produceState<Result<File>?>(null) { value = runCatching { copy() } }
    return file
}

/** Audio attachments with play/pause and a seek bar. */
@Composable
fun AudioPreview(copy: suspend () -> File, modifier: Modifier = Modifier) {
    val file = rememberCopy(copy)
    when {
        file == null -> Box(modifier, contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        file.isFailure -> EmptyState(R.drawable.ic_error, stringResource(R.string.preview_failed), modifier)
        else -> AudioPlayer(file.getOrThrow(), modifier)
    }
}

@Composable
private fun AudioPlayer(file: File, modifier: Modifier) {
    var prepared by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var playing by remember { mutableStateOf(false) }
    var duration by remember { mutableIntStateOf(0) }
    var position by remember { mutableFloatStateOf(0f) }
    val player = remember(file) {
        MediaPlayer().apply {
            setOnPreparedListener {
                duration = it.duration
                prepared = true
            }
            setOnCompletionListener { playing = false }
            setOnErrorListener { _, _, _ ->
                failed = true
                true
            }
            runCatching {
                setDataSource(file.path)
                prepareAsync()
            }.onFailure { failed = true }
        }
    }
    DisposableEffect(player) { onDispose { player.release() } }
    LaunchedEffect(playing) {
        while (playing) {
            position = player.currentPosition.toFloat()
            delay(250)
        }
    }
    if (failed) return EmptyState(R.drawable.ic_error, stringResource(R.string.preview_failed), modifier)
    Column(modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        SymbolIcon(R.drawable.ic_music_note, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(24.dp))
        Slider(
            value = position,
            onValueChange = {
                position = it
                player.seekTo(it.toInt())
            },
            valueRange = 0f..maxOf(1, duration).toFloat(),
            enabled = prepared,
            modifier = Modifier.widthIn(max = 560.dp).fillMaxWidth(),
        )
        Row(Modifier.widthIn(max = 560.dp).fillMaxWidth()) {
            Text(time(position.toInt()), style = MaterialTheme.typography.labelMedium)
            Spacer(Modifier.weight(1f))
            Text(time(duration), style = MaterialTheme.typography.labelMedium)
        }
        Spacer(Modifier.height(16.dp))
        FilledIconButton(
            onClick = {
                if (playing) player.pause() else player.start()
                playing = !playing
            },
            enabled = prepared,
            modifier = Modifier.size(64.dp),
        ) {
            Icon(
                painterResource(if (playing) R.drawable.ic_pause else R.drawable.ic_play_arrow),
                contentDescription = stringResource(if (playing) R.string.pause else R.string.play),
                modifier = Modifier.size(32.dp),
            )
        }
    }
}

private fun time(millis: Int): String {
    val seconds = millis / 1000
    return String.format(Locale.ROOT, "%d:%02d", seconds / 60, seconds % 60)
}

/** Video attachments with the platform's media controls. */
@Composable
fun VideoPreview(copy: suspend () -> File, modifier: Modifier = Modifier) {
    val file = rememberCopy(copy)
    when {
        file == null -> Box(modifier, contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        file.isFailure -> EmptyState(R.drawable.ic_error, stringResource(R.string.preview_failed), modifier)
        else -> Box(modifier.background(Color.Black), contentAlignment = Alignment.Center) {
            val path = file.getOrThrow().path
            AndroidView(
                factory = { context ->
                    VideoView(context).apply {
                        val controller = MediaController(context)
                        controller.setAnchorView(this)
                        setMediaController(controller)
                        setOnPreparedListener { controller.show() }
                        setVideoPath(path)
                    }
                },
                onRelease = VideoView::stopPlayback,
            )
        }
    }
}
