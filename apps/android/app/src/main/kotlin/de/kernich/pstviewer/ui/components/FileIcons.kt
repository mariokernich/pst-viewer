package de.kernich.pstviewer.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import de.kernich.pstviewer.R

private val ARCHIVE_EXTENSION = Regex("\\.(pst|ost|msg|eml|emlx|mbox|mbx)$", RegexOption.IGNORE_CASE)

/** Type label and colour of a mail file, like the desktop app's PstFileIcon. */
private fun archiveLabel(name: String): Pair<String, Color> {
    val label = when (val ext = ARCHIVE_EXTENSION.find(name)?.groupValues?.get(1)?.uppercase()) {
        null -> "MAIL"
        "MBX" -> "MBOX"
        "EMLX" -> "EML"
        else -> ext
    }
    val color = when (label) {
        "PST", "OST" -> Color(0xFF4A64FF)
        "MSG" -> Color(0xFF0A84FF)
        "EML" -> Color(0xFF1F9D55)
        "MBOX" -> Color(0xFF8E4EC6)
        else -> Color(0xFF6B7280)
    }
    return label to color
}

/** Document icon with the file type, or a folder for folders of mail files (decorative). */
@Composable
fun ArchiveFileIcon(name: String, isFolder: Boolean, modifier: Modifier = Modifier) {
    if (isFolder) {
        Box(modifier.size(width = 40.dp, height = 48.dp), contentAlignment = Alignment.Center) {
            SymbolIcon(R.drawable.ic_folder_filled, null, Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
        }
        return
    }
    val (label, color) = archiveLabel(name)
    val paper = MaterialTheme.colorScheme.surfaceContainerLowest
    val outline = MaterialTheme.colorScheme.outlineVariant
    Box(modifier.size(width = 40.dp, height = 48.dp).clearAndSetSemantics {}) {
        Canvas(Modifier.matchParentSize()) {
            val fold = size.width * 0.32f
            val radius = 5.dp.toPx()
            val page = Path().apply {
                moveTo(radius, 0f)
                lineTo(size.width - fold, 0f)
                lineTo(size.width, fold)
                lineTo(size.width, size.height - radius)
                quadraticTo(size.width, size.height, size.width - radius, size.height)
                lineTo(radius, size.height)
                quadraticTo(0f, size.height, 0f, size.height - radius)
                lineTo(0f, radius)
                quadraticTo(0f, 0f, radius, 0f)
                close()
            }
            drawPath(page, paper)
            drawPath(page, outline, style = Stroke(1.dp.toPx()))
            val corner = Path().apply {
                moveTo(size.width - fold, 0f)
                lineTo(size.width - fold, fold - radius)
                quadraticTo(size.width - fold, fold, size.width - fold + radius, fold)
                lineTo(size.width, fold)
            }
            drawPath(corner, outline, style = Stroke(1.dp.toPx()))
        }
        Box(
            Modifier
                .align(Alignment.TopCenter)
                .padding(start = 3.dp, end = 3.dp, top = 25.dp)
                .fillMaxWidth()
                .height(14.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(color),
            contentAlignment = Alignment.Center,
        ) {
            val size = fixedSize(if (label.length > 3) 8.dp else 9.dp)
            Text(
                label,
                color = Color.White,
                fontSize = size,
                lineHeight = size,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 1,
            )
        }
    }
}

private val TYPE_COLORS = listOf(
    Regex("\\.pdf$", RegexOption.IGNORE_CASE) to (Color(0xFFE5484D) to "PDF"),
    Regex("\\.(docx?|docm|dotx?|odt|rtf|pages)$", RegexOption.IGNORE_CASE) to (Color(0xFF2F6FE4) to "DOC"),
    Regex("\\.(xlsx?|xlsm|xlsb|csv|ods|numbers)$", RegexOption.IGNORE_CASE) to (Color(0xFF1F9D55) to "XLS"),
    Regex("\\.(pptx?|pptm|ppsx?|odp|key)$", RegexOption.IGNORE_CASE) to (Color(0xFFE8590C) to "PPT"),
    Regex("\\.(png|jpe?g|gif|bmp|tiff?|webp|heic|svg)$", RegexOption.IGNORE_CASE) to (Color(0xFF8E4EC6) to "IMG"),
    Regex("\\.(zip|rar|7z|gz|tgz|tar|bz2)$", RegexOption.IGNORE_CASE) to (Color(0xFF9A6B2F) to "ZIP"),
    Regex("\\.(ics|vcs)$", RegexOption.IGNORE_CASE) to (Color(0xFFD6409F) to "ICS"),
    Regex("\\.vcf$", RegexOption.IGNORE_CASE) to (Color(0xFF0F9D9A) to "VCF"),
    Regex("\\.(txt|log|md)$", RegexOption.IGNORE_CASE) to (Color(0xFF6B7280) to "TXT"),
    Regex("\\.(eml|msg)$", RegexOption.IGNORE_CASE) to (Color(0xFF0A84FF) to "MAIL"),
)
private val EXTENSION = Regex("\\.([a-z0-9]{1,4})$", RegexOption.IGNORE_CASE)

/** Coloured badge with the file type of an attachment (desktop FileBadge; decorative). */
@Composable
fun FileBadge(name: String, modifier: Modifier = Modifier) {
    val match = TYPE_COLORS.firstOrNull { it.first.containsMatchIn(name) }?.second
    val color = match?.first ?: Color(0xFF8E8E93)
    val label = match?.second ?: (EXTENSION.find(name)?.groupValues?.get(1)?.uppercase() ?: "FILE")
    Box(
        modifier = modifier
            .size(width = 36.dp, height = 40.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.14f))
            .clearAndSetSemantics {},
        contentAlignment = Alignment.BottomCenter,
    ) {
        Box(
            Modifier
                .align(Alignment.TopEnd)
                .size(10.dp)
                .clip(RoundedCornerShape(bottomStart = 4.dp))
                .background(color.copy(alpha = 0.4f)),
        )
        Text(label.take(4), color = color, fontSize = fixedSize(9.dp), fontWeight = FontWeight.Bold, maxLines = 1, modifier = Modifier.padding(bottom = 4.dp))
    }
}

/** Text size that ignores the font scale, for labels drawn inside fixed-size icons. */
@Composable
private fun fixedSize(size: Dp): TextUnit = with(LocalDensity.current) { size.toSp() }
