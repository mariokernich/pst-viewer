package de.kernich.pstviewer.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TextFilesTest {
    @Test
    fun decodesUtf8WithoutByteOrderMark() {
        assertEquals("Grüße", decodeText("﻿Grüße".toByteArray()))
    }

    @Test
    fun fallsBackToWindows1252() {
        assertEquals("Grüße €", decodeText("Grüße €".toByteArray(charset("windows-1252"))))
    }

    @Test
    fun decodesOnlyUpToTheLimit() {
        assertEquals("abc", decodeText("abcdef".toByteArray(), limit = 3))
    }

    @Test
    fun parsesSemicolonSeparatedValuesWithQuotes() {
        val table = parseCsv("Name;Betrag;Notiz\r\nAnna;12,50;\"Zeile; mit \"\"Zitat\"\"\"\nBob;3;\n", limit = 10)
        assertEquals(listOf("Name", "Betrag", "Notiz"), table.rows[0])
        assertEquals(listOf("Anna", "12,50", "Zeile; mit \"Zitat\""), table.rows[1])
        assertEquals(listOf("Bob", "3", ""), table.rows[2])
        assertFalse(table.more)
    }

    @Test
    fun stopsAtTheRowLimit() {
        val table = parseCsv("a,b\n1,2\n3,4\n5,6\n", limit = 2)
        assertEquals(2, table.rows.size)
        assertTrue(table.more)
    }
}
