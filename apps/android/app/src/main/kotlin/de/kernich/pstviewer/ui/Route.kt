package de.kernich.pstviewer.ui

import de.kernich.pstviewer.core.AttachmentInfo
import de.kernich.pstviewer.core.MessageRef

/** Screens of the app's back stack. */
sealed interface Route {
    /** Welcome screen; shows the progress while a file is opened. */
    data object Welcome : Route

    /** Folders, message list and reading pane of the archive [archive] (see OpenArchive.id). */
    data class Mailbox(val archive: Long) : Route

    data object Settings : Route

    data object Licenses : Route

    data object SearchHelp : Route

    /** Preview of the file attachments of a message, starting at [start]. */
    data class Attachments(val archive: Long, val message: MessageRef, val attachments: List<AttachmentInfo>, val start: Int) : Route

    /** An attached message (Outlook item or .eml), at any depth. */
    data class AttachedMessage(val archive: Long, val message: MessageRef) : Route
}
