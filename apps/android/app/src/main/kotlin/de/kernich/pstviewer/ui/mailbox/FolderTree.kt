package de.kernich.pstviewer.ui.mailbox

import de.kernich.pstviewer.core.ArchiveFormat
import de.kernich.pstviewer.core.FolderInfo
import de.kernich.pstviewer.core.OpenResult
import de.kernich.pstviewer.core.SpecialFolder

/** A row of the folder tree. */
data class FolderRow(val folder: FolderInfo, val hasChildren: Boolean, val expanded: Boolean)

/** The flat, depth-first folder list of the core as a collapsible tree. */
class FolderTree(val folders: List<FolderInfo>) {
    private val byId = folders.associateBy { it.id }

    operator fun get(id: UInt?): FolderInfo? = id?.let(byId::get)

    /** Top-level folders whose subfolders hold items start expanded (desktop defaultExpanded). */
    val defaultExpanded: Set<UInt> = folders
        .filter { folder ->
            folder.depth == 0u && folder.special != SpecialFolder.CONTACTS && folder.special != SpecialFolder.SYNC_ISSUES &&
                folders.any { it.parentId == folder.id && it.totalCount > 0u }
        }
        .map { it.id }
        .toSet()

    /**
     * Rows to show: descendants of collapsed folders are hidden, and empty
     * folders unless [showEmpty] (the selected folder [keep] always stays).
     */
    fun rows(expanded: Set<UInt>, showEmpty: Boolean, keep: UInt?): List<FolderRow> {
        val kept = HashSet<UInt>()
        val keptChildren = HashMap<UInt, Int>()
        for (folder in folders.asReversed()) {
            val visible = showEmpty || folder.totalCount > 0u || folder.id == keep || (keptChildren[folder.id] ?: 0) > 0
            if (visible) {
                kept.add(folder.id)
                folder.parentId?.let { keptChildren[it] = (keptChildren[it] ?: 0) + 1 }
            }
        }
        val rows = ArrayList<FolderRow>()
        var hiddenBelow: UInt? = null
        for (folder in folders) {
            val limit = hiddenBelow
            if (limit != null) {
                if (folder.depth > limit) continue
                hiddenBelow = null
            }
            if (folder.id !in kept) {
                hiddenBelow = folder.depth
                continue
            }
            val hasChildren = (keptChildren[folder.id] ?: 0) > 0
            val isExpanded = folder.id in expanded
            rows.add(FolderRow(folder, hasChildren, isExpanded))
            if (hasChildren && !isExpanded) hiddenBelow = folder.depth
        }
        return rows
    }

    companion object {
        /** The inbox if it has items; all items for folders of mail files; else the first folder with items. */
        fun defaultFolder(info: OpenResult): UInt? {
            info.folders.firstOrNull { it.special == SpecialFolder.INBOX && it.itemCount > 0u }?.let { return it.id }
            if (info.store.format == ArchiveFormat.FOLDER) return null
            return info.folders.firstOrNull { it.itemCount > 0u }?.id
        }
    }
}
