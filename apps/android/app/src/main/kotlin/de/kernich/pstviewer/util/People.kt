package de.kernich.pstviewer.util

import kotlin.math.abs

private val NAME_TAIL = Regex("[\"'(<].*$")
private val WHITESPACE = Regex("\\s+")
private val HUES = intArrayOf(211, 262, 330, 14, 32, 145, 172, 190, 238, 290)

/** Initials for an avatar: "Anna Müller" -> "AM", "Müller, Anna" -> "AM", "info@shop.de" -> "I". */
fun initials(name: String, email: String = ""): String {
    val source = name.ifEmpty { email }.replace(NAME_TAIL, "").trim()
    if (source.isEmpty()) return "?"
    if (name.isEmpty() && email.isNotEmpty()) return email.first().uppercase()
    val parts = if (',' in source) source.split(',').map(String::trim).reversed() else source.split(WHITESPACE)
    val letters = parts.mapNotNull { part -> part.firstOrNull(Char::isLetter)?.uppercase() }
    return when {
        letters.isEmpty() -> source.first().uppercase()
        letters.size == 1 -> letters.first()
        else -> letters.first() + letters.last()
    }
}

/**
 * Stable hue pair (start, end) of a person's avatar gradient, the same as the
 * desktop app's avatarGradient: hsl(hue 75% 62%) to hsl(hue+25 70% 48%).
 */
fun avatarHues(key: String): Pair<Int, Int> {
    var hash = 0
    for (char in key.lowercase()) hash = 31 * hash + char.code
    val hue = HUES[(abs(hash.toLong()) % HUES.size).toInt()]
    return hue to (hue + 25) % 360
}

/** "Anna <anna@example.com>", or whichever of both is known. */
fun displayAddress(name: String, email: String): String =
    if (name.isNotEmpty() && email.isNotEmpty() && name != email) "$name <$email>" else name.ifEmpty { email }
