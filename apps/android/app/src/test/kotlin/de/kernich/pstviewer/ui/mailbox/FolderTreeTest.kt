package de.kernich.pstviewer.ui.mailbox

import de.kernich.pstviewer.core.FolderInfo
import de.kernich.pstviewer.core.SpecialFolder
import org.junit.Assert.assertEquals
import org.junit.Test

class FolderTreeTest {
    private fun folder(id: Int, parent: Int?, depth: Int, total: Int, special: SpecialFolder? = null, children: Int = 0) =
        FolderInfo(id.toUInt(), parent?.toUInt(), depth.toUInt(), "Folder $id", special, "IPF.Note", total.toUInt(), 0u, total.toUInt(), children.toUInt())

    // Inbox (1) with a subfolder (2), an empty folder (3) with an empty child (4), Archive (5).
    private val tree = FolderTree(
        listOf(
            folder(1, null, 0, 10, SpecialFolder.INBOX, children = 1),
            folder(2, 1, 1, 4),
            folder(3, null, 0, 0, children = 1),
            folder(4, 3, 1, 0),
            folder(5, null, 0, 2, SpecialFolder.ARCHIVE),
        ),
    )

    private fun ids(rows: List<FolderRow>) = rows.map { it.folder.id.toInt() }

    @Test
    fun expandsTopLevelFoldersWithItemsInSubfolders() {
        assertEquals(setOf(1u), tree.defaultExpanded)
    }

    @Test
    fun hidesEmptyFoldersAndCollapsedChildren() {
        assertEquals(listOf(1, 2, 5), ids(tree.rows(setOf(1u), showEmpty = false, keep = null)))
        assertEquals(listOf(1, 5), ids(tree.rows(emptySet(), showEmpty = false, keep = null)))
    }

    @Test
    fun showsEmptyFoldersOnRequestAndKeepsTheSelection() {
        assertEquals(listOf(1, 2, 3, 4, 5), ids(tree.rows(setOf(1u, 3u), showEmpty = true, keep = null)))
        assertEquals(listOf(1, 2, 3, 4, 5), ids(tree.rows(setOf(1u, 3u), showEmpty = false, keep = 4u)))
    }

    @Test
    fun marksFoldersWithVisibleChildren() {
        val rows = tree.rows(setOf(1u), showEmpty = false, keep = null)
        assertEquals(listOf(true, false, false), rows.map { it.hasChildren })
    }
}
