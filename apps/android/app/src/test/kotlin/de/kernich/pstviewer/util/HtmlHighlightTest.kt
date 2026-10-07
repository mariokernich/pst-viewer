package de.kernich.pstviewer.util

import org.junit.Assert.assertEquals
import org.junit.Test

class HtmlHighlightTest {
    /** Case-insensitive matcher standing in for the core's findMatches. */
    private fun matcher(vararg terms: String): (String) -> List<IntRange> = { text ->
        terms.flatMap { term ->
            Regex(Regex.escape(term), RegexOption.IGNORE_CASE).findAll(text).map { it.range }.toList()
        }
    }

    private fun mark(text: String) = "<mark class=\"$HIGHLIGHT_CLASS\">$text</mark>"

    @Test
    fun marksMatchesInBodyText() {
        val html = "<html><head><title>Rechnung</title><style>.rechnung{}</style></head><body><p>Ihre Rechnung</p></body></html>"
        assertEquals(
            "<html><head><title>Rechnung</title><style>.rechnung{}</style></head><body><p>Ihre ${mark("Rechnung")}</p></body></html>",
            highlightHtml(html, matcher("rechnung")),
        )
    }

    @Test
    fun leavesTagsAttributesAndReferencesIntact() {
        val html = """<body><a href="https://x.de/rechnung" title="a > rechnung">Rechnung &amp; Mahnung</a></body>"""
        assertEquals(
            """<body><a href="https://x.de/rechnung" title="a > rechnung">${mark("Rechnung")} &amp; Mahnung</a></body>""",
            highlightHtml(html, matcher("rechnung")),
        )
        assertEquals(html, highlightHtml(html, matcher("amp")))
    }

    @Test
    fun skipsRawTextElementsAndComments() {
        val html = "<body><!-- offer --><style>p{content:'offer'}</style><p>offer</p></body>"
        assertEquals(
            "<body><!-- offer --><style>p{content:'offer'}</style><p>${mark("offer")}</p></body>",
            highlightHtml(html, matcher("offer")),
        )
    }

    @Test
    fun marksEveryTermAndRunSeparately() {
        val html = "<body>Grüße aus Köln<br>Köln am Rhein</body>"
        assertEquals(
            "<body>Grüße aus ${mark("Köln")}<br>${mark("Köln")} am ${mark("Rhein")}</body>",
            highlightHtml(html, matcher("köln", "rhein")),
        )
    }

    @Test
    fun withoutMatchesReturnsTheDocument() {
        val html = "<body><p>Nothing here</p></body>"
        assertEquals(html, highlightHtml(html, matcher("rechnung")))
        assertEquals(html, highlightHtml(html) { emptyList() })
    }
}
