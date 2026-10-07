package de.kernich.pstviewer.util

/** Class of the `<mark>` elements around search matches (styled by MailCss). */
const val HIGHLIGHT_CLASS = "pst-hl"

private val TAG = Regex("""<!--.*?-->|<(?:[^>"']|"[^"]*"|'[^']*')*>""", RegexOption.DOT_MATCHES_ALL)
private val TAG_NAME = Regex("""^</?([a-zA-Z][a-zA-Z0-9-]*)""")
private val BODY = Regex("""<body\b""", RegexOption.IGNORE_CASE)
private val ENTITY = Regex("""&(?:#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);""")

/** Elements whose content is not text of the message. */
private val RAW_TEXT = setOf("script", "style", "textarea", "title")

/** Joins the text runs for a single search; never part of a search term. */
private const val SEPARATOR = '\u0000'

/**
 * Wraps the search matches in the text of a mail document's body in
 * `<mark class="pst-hl">` (the desktop app's highlightDocument, without scripts).
 *
 * The documents come from the core (sanitised and serialised by html5ever), so a
 * small scanner suffices: text between tags, outside raw text elements, split at
 * character references so that they stay intact. [find] returns the matches in a
 * text as UTF-16 ranges (end exclusive); it is called once for the whole body.
 */
fun highlightHtml(html: String, find: (String) -> List<IntRange>): String {
    val runs = textRuns(html)
    if (runs.isEmpty()) return html
    val joined = StringBuilder()
    val offsets = IntArray(runs.size)
    runs.forEachIndexed { index, run ->
        if (index > 0) joined.append(SEPARATOR)
        offsets[index] = joined.length
        joined.append(html, run.first, run.last + 1)
    }
    // Matches as positions in the document, each within one text run.
    val marks = find(joined.toString()).mapNotNull { range ->
        if (range.isEmpty()) return@mapNotNull null
        val index = offsets.binarySearch(range.first).let { if (it >= 0) it else -it - 2 }
        if (index < 0) return@mapNotNull null
        val run = runs[index]
        val start = run.first + range.first - offsets[index]
        val end = minOf(run.first + range.last + 1 - offsets[index], run.last + 1)
        if (start < end) start until end else null
    }.sortedBy { it.first }
    if (marks.isEmpty()) return html
    val out = StringBuilder(html.length + marks.size * 32)
    var position = 0
    for (mark in marks) {
        if (mark.first < position) continue
        out.append(html, position, mark.first)
        out.append("<mark class=\"").append(HIGHLIGHT_CLASS).append("\">")
        out.append(html, mark.first, mark.last + 1)
        out.append("</mark>")
        position = mark.last + 1
    }
    out.append(html, position, html.length)
    return out.toString()
}

/** Ranges of the document that are text of the body, without character references. */
private fun textRuns(html: String): List<IntRange> {
    val runs = ArrayList<IntRange>()
    var position = BODY.find(html)?.range?.first ?: 0
    while (position < html.length) {
        val tag = TAG.find(html, position)
        val textEnd = tag?.range?.first ?: html.length
        if (textEnd > position) addPlainRuns(html, position, textEnd, runs)
        if (tag == null) break
        position = tag.range.last + 1
        val name = TAG_NAME.find(tag.value)?.groupValues?.get(1)?.lowercase()
        if (name in RAW_TEXT && !tag.value.startsWith("</") && !tag.value.endsWith("/>")) {
            val close = html.indexOf("</$name", position, ignoreCase = true)
            position = if (close < 0) html.length else close
        }
    }
    return runs
}

private fun addPlainRuns(html: String, start: Int, end: Int, runs: MutableList<IntRange>) {
    var position = start
    for (entity in ENTITY.findAll(html.subSequence(start, end))) {
        val entityStart = start + entity.range.first
        if (entityStart > position) runs.add(position until entityStart)
        position = start + entity.range.last + 1
    }
    if (end > position) runs.add(position until end)
}
