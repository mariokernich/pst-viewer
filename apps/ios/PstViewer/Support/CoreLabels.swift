import Foundation
import PstViewerCore

// Localised labels of the core's enums, worded like the desktop app.

extension ItemKind {
    /// Plural label for filters, e.g. "Termine".
    var pluralLabel: String {
        switch self {
        case .mail: String(localized: "Emails")
        case .meeting: String(localized: "Meetings")
        case .appointment: String(localized: "Appointments")
        case .contact: String(localized: "Contacts")
        case .task: String(localized: "Tasks")
        case .note: String(localized: "Notes")
        case .journal: String(localized: "Journal")
        case .other: String(localized: "Other")
        }
    }

    /// Label of a single item, e.g. "Termin".
    var label: String {
        switch self {
        case .mail: String(localized: "Email")
        case .meeting: String(localized: "Meeting request")
        case .appointment: String(localized: "Appointment")
        case .contact: String(localized: "Contact")
        case .task: String(localized: "Task")
        case .note: String(localized: "Note")
        case .journal: String(localized: "Journal entry")
        case .other: String(localized: "Item")
        }
    }

    /// Symbol shown in message rows for items that are not plain mail.
    var symbolName: String? {
        switch self {
        case .meeting: "calendar.badge.clock"
        case .appointment: "calendar"
        case .contact: "person.crop.circle"
        case .task: "checklist"
        case .note: "note.text"
        case .mail, .journal, .other: nil
        }
    }

    /// Kinds offered by the filter panel.
    static let filterable: [ItemKind] = [.mail, .meeting, .appointment, .contact, .task, .note]
}

extension SearchField: @retroactive CaseIterable {
    public static let allCases: [SearchField] = [.subject, .from, .to, .body, .attachments]

    var label: String {
        switch self {
        case .subject: String(localized: "Subject")
        case .from: String(localized: "Sender")
        case .to: String(localized: "Recipients")
        case .body: String(localized: "Body")
        case .attachments: String(localized: "Attachment names")
        }
    }

    /// Query prefix for "search only in …" suggestions, in the UI language.
    var queryPrefix: String {
        switch self {
        case .subject: String(localized: "subject", comment: "Search operator for the subject, e.g. subject:offer")
        case .from: String(localized: "from", comment: "Search operator for the sender, e.g. from:anna")
        case .to: String(localized: "to", comment: "Search operator for recipients, e.g. to:bob")
        case .body: String(localized: "body", comment: "Search operator for the message body, e.g. body:contract")
        case .attachments: String(localized: "attachment", comment: "Search operator for attachment names, e.g. attachment:pdf")
        }
    }
}

extension DatePreset: @retroactive CaseIterable {
    public static let allCases: [DatePreset] = [.any, .today, .week, .month, .year, .custom]

    var label: String {
        switch self {
        case .any: String(localized: "Any time")
        case .today: String(localized: "Today")
        case .week: String(localized: "7 days")
        case .month: String(localized: "30 days")
        case .year: String(localized: "12 months")
        case .custom: String(localized: "Range…")
        }
    }
}

extension ReadState: @retroactive CaseIterable {
    public static let allCases: [ReadState] = [.any, .unread, .read]

    var label: String {
        switch self {
        case .any: String(localized: "All")
        case .unread: String(localized: "Unread")
        case .read: String(localized: "Read")
        }
    }
}

extension AttachmentType: @retroactive CaseIterable {
    public static let allCases: [AttachmentType] = [.pdf, .image, .office, .archive, .calendar, .message]

    var label: String {
        switch self {
        case .pdf: String(localized: "PDF")
        case .image: String(localized: "Images")
        case .office: String(localized: "Office")
        case .archive: String(localized: "Archives")
        case .calendar: String(localized: "Calendar")
        case .message: String(localized: "Emails")
        }
    }
}

extension SortField: @retroactive CaseIterable {
    public static let allCases: [SortField] = [.date, .from, .subject, .size]

    var label: String {
        switch self {
        case .date: String(localized: "Date")
        case .from: String(localized: "Sender")
        case .subject: String(localized: "Subject")
        case .size: String(localized: "Size")
        }
    }

    /// Dates and sizes start with the largest value, names alphabetically.
    var defaultDirection: SortDir {
        self == .date || self == .size ? .desc : .asc
    }
}

extension CoreError {
    /// User-facing message with the wording of the desktop app.
    var userMessage: String {
        switch self {
        case .NotFound: String(localized: "The file was not found. It may have been moved, renamed or deleted.")
        case .Unsupported: String(localized: "The file is not a supported mail file (PST, MSG, EML, MBOX), it is damaged, or the folder contains no emails.")
        case .ReadFailed: String(localized: "An error occurred while reading the file.")
        case .Closed: String(localized: "No file is open.")
        case .Canceled: String(localized: "The operation was canceled.")
        case .Internal: String(localized: "An unexpected error occurred.")
        }
    }
}

extension TaskInfo {
    var statusLabel: String {
        switch status {
        case 0: String(localized: "Not started")
        case 1: String(localized: "In progress")
        case 2: String(localized: "Completed")
        case 3: String(localized: "Waiting on someone else")
        case 4: String(localized: "Deferred")
        default: "—"
        }
    }
}

extension ContactField {
    var label: String {
        switch key {
        case "company": String(localized: "Company")
        case "jobTitle": String(localized: "Job title")
        case "department": String(localized: "Department")
        case "email": String(localized: "Email")
        case "email2": String(localized: "Email 2")
        case "email3": String(localized: "Email 3")
        case "businessPhone": String(localized: "Business phone")
        case "mobilePhone": String(localized: "Mobile")
        case "homePhone": String(localized: "Home phone")
        case "businessFax": String(localized: "Fax")
        case "businessAddress": String(localized: "Business address")
        case "homeAddress": String(localized: "Home address")
        case "otherAddress": String(localized: "Other address")
        case "website": String(localized: "Website")
        case "personalWebsite": String(localized: "Personal website")
        case "im": String(localized: "Chat")
        case "birthday": String(localized: "Birthday")
        case "anniversary": String(localized: "Anniversary")
        default: key
        }
    }

    /// Birthdays and anniversaries come as ISO 8601 date-times.
    var displayValue: String {
        guard key == "birthday" || key == "anniversary" else { return value }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: value) ?? ISO8601DateFormatter().date(from: value)
        return date.map(Formatting.date) ?? value
    }
}

extension ContactCardField {
    /// vCard types such as "work, cell" in the UI language; unknown types are kept.
    var typeLabel: String? {
        let types = label.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.compactMap { type -> String? in
            switch type {
            case "work": String(localized: "work", comment: "vCard type of a phone number or address")
            case "home": String(localized: "home", comment: "vCard type of a phone number or address")
            case "cell": String(localized: "mobile", comment: "vCard type of a phone number")
            case "fax": String(localized: "Fax")
            case "pref": String(localized: "preferred", comment: "vCard type of the preferred address or number")
            case "voice", "internet", "": nil
            default: type
            }
        }
        return types.isEmpty ? nil : types.joined(separator: ", ")
    }
}

extension ContactFieldKind {
    var label: String {
        switch self {
        case .email: String(localized: "Email")
        case .phone: String(localized: "Phone")
        case .address: String(localized: "Address")
        case .url: String(localized: "Website")
        case .birthday: String(localized: "Birthday")
        case .note: String(localized: "Note")
        }
    }
}

extension CalendarInfo {
    /// Label of the iCalendar method, e.g. "Einladung" for REQUEST.
    var methodLabel: String? {
        switch method {
        case "REQUEST": String(localized: "Invitation")
        case "CANCEL": String(localized: "Canceled")
        case "REPLY": String(localized: "Reply")
        case "PUBLISH": String(localized: "Event")
        default: nil
        }
    }
}

extension CalendarPerson {
    var statusLabel: String? {
        switch status?.uppercased().replacingOccurrences(of: "-", with: "_") {
        case "ACCEPTED": String(localized: "Accepted")
        case "DECLINED": String(localized: "Declined")
        case "TENTATIVE": String(localized: "Tentative")
        case "NEEDS_ACTION": String(localized: "Pending")
        default: nil
        }
    }
}
