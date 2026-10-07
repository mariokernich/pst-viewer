package de.kernich.pstviewer.util

import android.content.res.Resources
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.FolderInfo
import de.kernich.pstviewer.core.SpecialFolder

/** Folders detected by type keep their own name unless it is the standard one (desktop lib/folders.ts). */
private val STANDARD_NAMES = mapOf(
    SpecialFolder.CALENDAR to Regex("^(calendar|kalender)$", RegexOption.IGNORE_CASE),
    SpecialFolder.CONTACTS to Regex("^(contacts|kontakte)$", RegexOption.IGNORE_CASE),
    SpecialFolder.TASKS to Regex("^(tasks|aufgaben)$", RegexOption.IGNORE_CASE),
    SpecialFolder.NOTES to Regex("^(notes|notizen)$", RegexOption.IGNORE_CASE),
    SpecialFolder.JOURNAL to Regex("^journal$", RegexOption.IGNORE_CASE),
)

@StringRes
fun specialFolderName(special: SpecialFolder): Int = when (special) {
    SpecialFolder.INBOX -> R.string.special_inbox
    SpecialFolder.DRAFTS -> R.string.special_drafts
    SpecialFolder.SENT -> R.string.special_sent
    SpecialFolder.DELETED -> R.string.special_deleted
    SpecialFolder.ARCHIVE -> R.string.special_archive
    SpecialFolder.JUNK -> R.string.special_junk
    SpecialFolder.OUTBOX -> R.string.special_outbox
    SpecialFolder.CALENDAR -> R.string.special_calendar
    SpecialFolder.CONTACTS -> R.string.special_contacts
    SpecialFolder.TASKS -> R.string.special_tasks
    SpecialFolder.NOTES -> R.string.special_notes
    SpecialFolder.JOURNAL -> R.string.special_journal
    SpecialFolder.SYNC_ISSUES -> R.string.special_sync_issues
    SpecialFolder.RSS -> R.string.special_rss
}

/** Display name of a folder, localising the well-known Outlook folders. */
fun folderName(folder: FolderInfo, resources: Resources): String {
    val special = folder.special ?: return folder.name
    val standard = STANDARD_NAMES[special]
    if (standard != null && !standard.matches(folder.name.trim())) return folder.name
    return resources.getString(specialFolderName(special))
}

@DrawableRes
fun folderIcon(folder: FolderInfo): Int {
    when (folder.special) {
        SpecialFolder.INBOX -> return R.drawable.ic_inbox
        SpecialFolder.DRAFTS -> return R.drawable.ic_draft
        SpecialFolder.SENT -> return R.drawable.ic_send
        SpecialFolder.DELETED -> return R.drawable.ic_delete
        SpecialFolder.ARCHIVE -> return R.drawable.ic_archive
        SpecialFolder.JUNK -> return R.drawable.ic_report
        SpecialFolder.OUTBOX -> return R.drawable.ic_outbox
        SpecialFolder.CALENDAR -> return R.drawable.ic_calendar_today
        SpecialFolder.CONTACTS -> return R.drawable.ic_contacts
        SpecialFolder.TASKS -> return R.drawable.ic_checklist
        SpecialFolder.NOTES -> return R.drawable.ic_sticky_note_2
        SpecialFolder.JOURNAL -> return R.drawable.ic_book
        SpecialFolder.SYNC_ISSUES -> return R.drawable.ic_sync_problem
        SpecialFolder.RSS -> return R.drawable.ic_rss_feed
        null -> Unit
    }
    val type = folder.containerClass.lowercase()
    return when {
        type.startsWith("ipf.appointment") -> R.drawable.ic_calendar_today
        type.startsWith("ipf.contact") -> R.drawable.ic_contacts
        type.startsWith("ipf.task") -> R.drawable.ic_checklist
        type.startsWith("ipf.stickynote") -> R.drawable.ic_sticky_note_2
        else -> R.drawable.ic_folder
    }
}

/** True for folders whose items are shown with their recipients instead of the sender. */
fun isOutgoing(folder: FolderInfo?): Boolean =
    folder?.special == SpecialFolder.SENT || folder?.special == SpecialFolder.DRAFTS || folder?.special == SpecialFolder.OUTBOX
