package de.kernich.pstviewer.util

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.ArchiveFormat
import de.kernich.pstviewer.core.AttachmentType
import de.kernich.pstviewer.core.ContactFieldKind
import de.kernich.pstviewer.core.DatePreset
import de.kernich.pstviewer.core.ItemKind
import de.kernich.pstviewer.core.ReadState
import de.kernich.pstviewer.core.SearchField
import de.kernich.pstviewer.core.SortField

@StringRes
fun kindLabel(kind: ItemKind, single: Boolean = false): Int = if (single) {
    when (kind) {
        ItemKind.MAIL -> R.string.kind_single_mail
        ItemKind.MEETING -> R.string.kind_single_meeting
        ItemKind.APPOINTMENT -> R.string.kind_single_appointment
        ItemKind.CONTACT -> R.string.kind_single_contact
        ItemKind.TASK -> R.string.kind_single_task
        ItemKind.NOTE -> R.string.kind_single_note
        ItemKind.JOURNAL -> R.string.kind_single_journal
        ItemKind.OTHER -> R.string.kind_single_other
    }
} else {
    when (kind) {
        ItemKind.MAIL -> R.string.kind_mail
        ItemKind.MEETING -> R.string.kind_meeting
        ItemKind.APPOINTMENT -> R.string.kind_appointment
        ItemKind.CONTACT -> R.string.kind_contact
        ItemKind.TASK -> R.string.kind_task
        ItemKind.NOTE -> R.string.kind_note
        ItemKind.JOURNAL -> R.string.kind_journal
        ItemKind.OTHER -> R.string.kind_other
    }
}

/** Icon of non-mail items in the message list. */
@DrawableRes
fun kindIcon(kind: ItemKind): Int? = when (kind) {
    ItemKind.MEETING -> R.drawable.ic_event_upcoming
    ItemKind.APPOINTMENT -> R.drawable.ic_event
    ItemKind.CONTACT -> R.drawable.ic_person
    ItemKind.TASK -> R.drawable.ic_checklist
    ItemKind.NOTE -> R.drawable.ic_sticky_note_2
    else -> null
}

@StringRes
fun fieldLabel(field: SearchField): Int = when (field) {
    SearchField.SUBJECT -> R.string.field_subject
    SearchField.FROM -> R.string.field_from
    SearchField.TO -> R.string.field_to
    SearchField.BODY -> R.string.field_body
    SearchField.ATTACHMENTS -> R.string.field_attachments
}

@StringRes
fun datePresetLabel(preset: DatePreset): Int = when (preset) {
    DatePreset.ANY -> R.string.date_any
    DatePreset.TODAY -> R.string.date_today
    DatePreset.WEEK -> R.string.date_week
    DatePreset.MONTH -> R.string.date_month
    DatePreset.YEAR -> R.string.date_year
    DatePreset.CUSTOM -> R.string.date_custom
}

@StringRes
fun readStateLabel(state: ReadState): Int = when (state) {
    ReadState.ANY -> R.string.read_any
    ReadState.UNREAD -> R.string.read_unread
    ReadState.READ -> R.string.read_read
}

@StringRes
fun attachmentTypeLabel(type: AttachmentType): Int = when (type) {
    AttachmentType.PDF -> R.string.att_pdf
    AttachmentType.IMAGE -> R.string.att_image
    AttachmentType.OFFICE -> R.string.att_office
    AttachmentType.ARCHIVE -> R.string.att_archive
    AttachmentType.CALENDAR -> R.string.att_calendar
    AttachmentType.MESSAGE -> R.string.att_message
}

@StringRes
fun sortFieldLabel(field: SortField): Int = when (field) {
    SortField.DATE -> R.string.sort_date
    SortField.FROM -> R.string.sort_from
    SortField.SUBJECT -> R.string.sort_subject
    SortField.SIZE -> R.string.sort_size
}

@StringRes
fun formatLabel(format: ArchiveFormat): Int = when (format) {
    ArchiveFormat.ANSI -> R.string.format_pst_ansi
    ArchiveFormat.UNICODE, ArchiveFormat.UNICODE4K -> R.string.format_pst
    ArchiveFormat.MBOX -> R.string.format_mbox
    ArchiveFormat.EML -> R.string.format_eml
    ArchiveFormat.MSG -> R.string.format_msg
    ArchiveFormat.FOLDER -> R.string.format_folder
    ArchiveFormat.UNKNOWN -> R.string.format_unknown
}

/** Labels of the contact fields of Outlook contact items (keys from the core). */
@StringRes
fun contactFieldLabel(key: String): Int? = when (key) {
    "company" -> R.string.contact_company
    "jobTitle" -> R.string.contact_job_title
    "department" -> R.string.contact_department
    "email" -> R.string.contact_email
    "email2" -> R.string.contact_email2
    "email3" -> R.string.contact_email3
    "businessPhone" -> R.string.contact_business_phone
    "mobilePhone" -> R.string.contact_mobile_phone
    "homePhone" -> R.string.contact_home_phone
    "businessFax" -> R.string.contact_business_fax
    "businessAddress" -> R.string.contact_business_address
    "homeAddress" -> R.string.contact_home_address
    "otherAddress" -> R.string.contact_other_address
    "website" -> R.string.contact_website
    "personalWebsite" -> R.string.contact_personal_website
    "im" -> R.string.contact_im
    "birthday" -> R.string.contact_birthday
    "anniversary" -> R.string.contact_anniversary
    else -> null
}

@StringRes
fun vcardFieldLabel(kind: ContactFieldKind): Int = when (kind) {
    ContactFieldKind.EMAIL -> R.string.vcard_email
    ContactFieldKind.PHONE -> R.string.vcard_phone
    ContactFieldKind.ADDRESS -> R.string.vcard_address
    ContactFieldKind.URL -> R.string.vcard_url
    ContactFieldKind.BIRTHDAY -> R.string.vcard_birthday
    ContactFieldKind.NOTE -> R.string.vcard_note
}
