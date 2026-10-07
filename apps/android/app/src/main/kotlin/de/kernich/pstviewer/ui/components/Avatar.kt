package de.kernich.pstviewer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import de.kernich.pstviewer.util.avatarHues
import de.kernich.pstviewer.util.initials

/** Initials on a gradient that is stable per person (decorative). */
@Composable
fun Avatar(name: String, email: String, modifier: Modifier = Modifier, size: Dp = 40.dp) {
    val brush = remember(name, email) {
        val (start, end) = avatarHues(email.ifEmpty { name }.ifEmpty { "?" })
        Brush.linearGradient(listOf(Color.hsl(start.toFloat(), 0.75f, 0.62f), Color.hsl(end.toFloat(), 0.70f, 0.48f)))
    }
    val fontSize = with(LocalDensity.current) { (size * 0.38f).toSp() }
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(brush)
            .clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        Text(initials(name, email), color = Color.White, fontSize = fontSize, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}
