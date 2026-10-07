package de.kernich.pstviewer.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PeopleTest {
    @Test
    fun initialsOfNames() {
        assertEquals("AM", initials("Anna Müller"))
        assertEquals("AM", initials("Müller, Anna"))
        assertEquals("AB", initials("Anna Maria Becker"))
        assertEquals("J", initials("Jonas"))
        assertEquals("I", initials("", "info@shop.de"))
        assertEquals("?", initials(""))
        assertEquals("AB", initials("Anna Becker (Nordwind)"))
    }

    @Test
    fun avatarHuesAreStableAndCaseInsensitive() {
        val hues = avatarHues("anna.becker@nordwind-design.de")
        assertEquals(hues, avatarHues("Anna.Becker@Nordwind-Design.de"))
        assertEquals((hues.first + 25) % 360, hues.second)
        assertTrue(hues.first in listOf(211, 262, 330, 14, 32, 145, 172, 190, 238, 290))
    }

    @Test
    fun displayAddresses() {
        assertEquals("Anna <anna@example.com>", displayAddress("Anna", "anna@example.com"))
        assertEquals("anna@example.com", displayAddress("anna@example.com", "anna@example.com"))
        assertEquals("Anna", displayAddress("Anna", ""))
        assertEquals("anna@example.com", displayAddress("", "anna@example.com"))
    }
}
