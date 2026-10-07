package de.kernich.pstviewer.util

import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction

/** Text of an attachment: UTF-8, or Windows-1252 for legacy files; without byte order mark. */
fun decodeText(data: ByteArray, limit: Int = data.size): String {
    val buffer = ByteBuffer.wrap(data, 0, minOf(limit, data.size))
    val text = try {
        Charsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(buffer)
            .toString()
    } catch (_: CharacterCodingException) {
        buffer.rewind()
        Charset.forName("windows-1252").decode(buffer).toString()
    }
    return text.removePrefix("\uFEFF")
}

/** A CSV/TSV table with at most [limit] rows; [more] is set if rows were left out. */
data class CsvTable(val rows: List<List<String>>, val more: Boolean)

/** Splits CSV/TSV text into rows, honouring quoted fields (desktop AttachmentPreview.parseCsv). */
fun parseCsv(text: String, limit: Int): CsvTable {
    val firstLine = text.substringBefore('\n')
    val delimiter = listOf('\t', ';', ',').maxBy { d -> firstLine.count { it == d } }
    val rows = ArrayList<List<String>>()
    var row = ArrayList<String>()
    val field = StringBuilder()
    var quoted = false
    var i = 0
    while (i < text.length) {
        val c = text[i]
        if (quoted) {
            when {
                c == '"' && text.getOrNull(i + 1) == '"' -> {
                    field.append('"')
                    i++
                }
                c == '"' -> quoted = false
                else -> field.append(c)
            }
        } else if (c == '"' && field.isEmpty()) {
            quoted = true
        } else if (c == delimiter) {
            row.add(field.toString())
            field.clear()
        } else if (c == '\n' || c == '\r') {
            if (c == '\r' && text.getOrNull(i + 1) == '\n') i++
            row.add(field.toString())
            rows.add(row)
            row = ArrayList()
            field.clear()
            if (rows.size >= limit) return CsvTable(rows, i < text.length - 1)
        } else {
            field.append(c)
        }
        i++
    }
    if (field.isNotEmpty() || row.isNotEmpty()) {
        row.add(field.toString())
        rows.add(row)
    }
    return CsvTable(rows, false)
}
