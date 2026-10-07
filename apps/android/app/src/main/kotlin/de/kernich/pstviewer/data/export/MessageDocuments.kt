package de.kernich.pstviewer.data.export

import android.content.res.Resources
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.HeaderRow
import de.kernich.pstviewer.core.ItemKind
import de.kernich.pstviewer.core.MessageDetail
import de.kernich.pstviewer.core.PrintInput
import de.kernich.pstviewer.core.Recipient
import de.kernich.pstviewer.core.RecipientKind
import de.kernich.pstviewer.core.buildExportText
import de.kernich.pstviewer.core.buildPrintDocument
import de.kernich.pstviewer.core.exportBaseName
import de.kernich.pstviewer.util.Formatter
import de.kernich.pstviewer.util.contactFieldLabel
import de.kernich.pstviewer.util.displayAddress
import de.kernich.pstviewer.util.kindLabel
import java.time.Instant

/** Everything needed to export or print one message, in the UI language. */
data class MessageExport(
    val detail: MessageDetail,
    val baseName: String,
    val subject: String,
    val printDocument: String,
    val text: String,
    val allowRemote: Boolean,
    val paper: PaperSize,
)

/**
 * Builds the localised header rows of exported and printed messages (port of
 * the desktop app's exportDocument.ts); the documents themselves come from the core.
 */
class MessageDocuments(private val resources: Resources, private val format: Formatter) {
    private fun string(id: Int) = resources.getString(id)

    fun export(detail: MessageDetail, folderName: String?, allowRemote: Boolean): MessageExport {
        val rows = headerRows(detail, folderName)
        val subject = detail.subject.ifBlank { string(R.string.no_subject) }
        val paper = PaperSize.forLocale()
        val print = buildPrintDocument(
            PrintInput(
                lang = format.locale.language,
                subject = subject,
                rows = rows,
                html = detail.html,
                text = detail.text,
                inlineImages = detail.inlineImages,
                allowRemote = allowRemote,
            ),
        )
        return MessageExport(
            detail = detail,
            baseName = exportBaseName(detail.subject, detail.date, string(R.string.no_subject)),
            subject = subject,
            printDocument = withPageLayout(print, subject, paper),
            text = buildExportText(string(R.string.subject_label), subject, rows, detail.text),
            allowRemote = allowRemote,
            paper = paper,
        )
    }

    fun headerRows(detail: MessageDetail, folderName: String?): List<HeaderRow> {
        val rows = ArrayList<HeaderRow>()
        fun add(label: String, value: String?) {
            if (!value.isNullOrBlank()) rows.add(HeaderRow(label, value.trim()))
        }
        if (detail.kind == ItemKind.CONTACT) {
            detail.contact.orEmpty().forEach { field ->
                val label = contactFieldLabel(field.key)?.let(::string) ?: field.key
                add(label, contactValue(field.key, field.value))
            }
            return rows
        }
        detail.appointment?.let { appointment ->
            if (appointment.start != null) add(string(R.string.appointment_when), format.range(appointment.start, appointment.end, appointment.isAllDay))
            add(string(R.string.appointment_where), appointment.location)
            if (appointment.isRecurring) add(string(R.string.recurring), appointment.recurrence.ifEmpty { "—" })
            add(string(R.string.attendees), appointment.attendees)
        }
        if (detail.kind != ItemKind.APPOINTMENT) {
            add(string(R.string.from), displayAddress(detail.from.name, detail.from.email))
            detail.sender?.let { sender ->
                add("", resources.getString(R.string.on_behalf_of, sender.name.ifEmpty { sender.email }, detail.from.name.ifEmpty { detail.from.email }))
            }
            add(string(R.string.to), people(detail.recipients, RecipientKind.TO))
            add(string(R.string.cc), people(detail.recipients, RecipientKind.CC))
            add(string(R.string.bcc), people(detail.recipients, RecipientKind.BCC))
            add(string(R.string.reply_to), detail.replyTo)
            add(string(R.string.date_label), format.fullDate(detail.date))
        }
        detail.task?.let { task ->
            add(string(R.string.task_status), resources.getStringArray(R.array.task_status_values).getOrNull(task.status).orEmpty())
            add(string(R.string.task_due), format.date(task.dueDate))
        }
        if (detail.kind != ItemKind.MAIL) add(string(R.string.type_label), string(kindLabel(detail.kind, single = true)))
        add(string(R.string.folder), folderName)
        val files = detail.attachments.filter { !it.isInline }
        add(string(R.string.attachments_label), files.joinToString(", ") { if (it.isMessage) it.name else "${it.name} (${format.size(it.size)})" })
        return rows
    }

    /** Birthdays and anniversaries come as ISO timestamps. */
    fun contactValue(key: String, value: String): String =
        if (key == "birthday" || key == "anniversary") {
            runCatching { format.date(Instant.parse(value).toEpochMilli()) }.getOrDefault(value)
        } else {
            value
        }

    private fun people(recipients: List<Recipient>, kind: RecipientKind): String =
        recipients.filter { it.kind == kind }.joinToString(", ") { displayAddress(it.name, it.email) }
}
