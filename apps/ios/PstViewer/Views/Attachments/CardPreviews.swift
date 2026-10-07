import PstViewerCore
import SwiftUI

/// Events of an iCalendar attachment as cards, with the source on request.
struct CalendarPreview: View {
    let data: Data
    @State private var calendar: CalendarInfo?

    var body: some View {
        WithSource(data: data) {
            if let calendar {
                if calendar.events.isEmpty {
                    Text("The file contains no events.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(Array(calendar.events.enumerated()), id: \.offset) { _, event in
                        EventCard(event: event, method: calendar.methodLabel, isCanceled: calendar.method == "CANCEL")
                    }
                }
            }
        }
        .task {
            let data = data
            calendar = await Task.detached { parseCalendar(data: data) }.value
        }
    }
}

private struct EventCard: View {
    let event: CalendarEvent
    let method: String?
    let isCanceled: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let method {
                Text(verbatim: method)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(isCanceled ? Color.red : Color.accentColor)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background((isCanceled ? Color.red : Color.accentColor).opacity(0.12), in: .rect(cornerRadius: 6))
            }
            Text(verbatim: event.summary.isEmpty ? "—" : event.summary)
                .font(.title3.bold())
                .strikethrough(isCanceled, color: .red.opacity(0.6))
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 12, verticalSpacing: 10) {
                if let start = event.start {
                    row("calendar") {
                        Text(verbatim: Formatting.range(start: start.time, end: event.end?.time, allDay: start.allDay))
                            + Text(verbatim: start.zone.map { " (\($0))" } ?? "").foregroundStyle(.secondary)
                    }
                }
                if event.recurring {
                    row("repeat") { Text("Recurring") }
                }
                if !event.location.isEmpty {
                    row("mappin.and.ellipse") { Text(verbatim: event.location) }
                }
                if let organizer = event.organizer {
                    row("person") {
                        Text("Organizer").foregroundStyle(.secondary) + Text(verbatim: ": " + People.displayAddress(name: organizer.name, email: organizer.email))
                    }
                }
                if !event.attendees.isEmpty {
                    row("person.2") {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(Array(event.attendees.enumerated()), id: \.offset) { _, attendee in
                                Text(verbatim: People.displayAddress(name: attendee.name, email: attendee.email))
                                    + Text(verbatim: attendee.statusLabel.map { " · \($0)" } ?? "").foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .font(.subheadline)
            if !event.description.isEmpty {
                Divider()
                Text(verbatim: event.description)
                    .font(.subheadline)
            }
        }
        .textSelection(.enabled)
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground), in: .rect(cornerRadius: 18, style: .continuous))
    }

    private func row(_ symbol: String, @ViewBuilder content: () -> some View) -> some View {
        GridRow {
            Image(systemName: symbol)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            content()
        }
    }
}

/// Contacts of a vCard attachment as cards.
struct ContactPreview: View {
    let data: Data
    @State private var contacts: [ContactCard]?

    var body: some View {
        WithSource(data: data) {
            if let contacts {
                if contacts.isEmpty {
                    Text("The file contains no contacts.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(Array(contacts.enumerated()), id: \.offset) { _, contact in
                        ContactCardView(contact: contact)
                    }
                }
            }
        }
        .task {
            let data = data
            contacts = await Task.detached { parseContacts(data: data) }.value
        }
    }
}

private struct ContactCardView: View {
    let contact: ContactCard

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 16) {
                photo
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: contact.name.isEmpty ? "—" : contact.name)
                        .font(.title3.bold())
                    let role = [contact.title, contact.organization].filter { !$0.isEmpty }.joined(separator: " · ")
                    if !role.isEmpty {
                        Text(verbatim: role)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            if !contact.fields.isEmpty {
                Divider()
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 10) {
                    ForEach(Array(contact.fields.enumerated()), id: \.offset) { _, field in
                        GridRow {
                            (Text(verbatim: field.kind.label) + Text(verbatim: field.typeLabel.map { " (\($0))" } ?? "").foregroundStyle(.tertiary))
                                .foregroundStyle(.secondary)
                            Text(verbatim: field.kind == .birthday ? Self.birthday(field.value) : field.value)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .font(.subheadline)
            }
        }
        .textSelection(.enabled)
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground), in: .rect(cornerRadius: 18, style: .continuous))
    }

    @ViewBuilder private var photo: some View {
        if let photo = contact.photo, let image = Self.image(fromDataURL: photo) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: 64, height: 64)
                .clipShape(.circle)
                .accessibilityHidden(true)
        } else {
            AvatarView(name: contact.name, email: "", size: 64)
        }
    }

    /// Embedded photos come as data URLs; remote photos are never loaded.
    private static func image(fromDataURL url: String) -> UIImage? {
        guard url.hasPrefix("data:"), let comma = url.firstIndex(of: ","),
              let data = Data(base64Encoded: String(url[url.index(after: comma)...])) else { return nil }
        return UIImage(data: data)
    }

    /// vCard birthdays are dates such as 1985-04-12 or 19850412.
    private static func birthday(_ value: String) -> String {
        let digits = value.prefix(10).filter(\.isNumber)
        guard digits.count == 8, let year = Int(digits.prefix(4)), let month = Int(digits.dropFirst(4).prefix(2)), let day = Int(digits.suffix(2)),
              let date = Calendar.current.date(from: DateComponents(year: year, month: month, day: day)) else { return value }
        return Formatting.date(date)
    }
}

/// Cards of a structured file with a button that reveals the raw text.
private struct WithSource<Content: View>: View {
    let data: Data
    @ViewBuilder let content: Content
    @State private var showsSource = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                content
                Button(showsSource ? LocalizedStringKey("Hide source") : LocalizedStringKey("Show source"), systemImage: "chevron.left.forwardslash.chevron.right") {
                    showsSource.toggle()
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
                if showsSource {
                    Text(verbatim: TextDecoding.string(from: data))
                        .font(.caption.monospaced())
                        .textSelection(.enabled)
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.systemBackground), in: .rect(cornerRadius: 12, style: .continuous))
                }
            }
            .padding(20)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
    }
}

/// Decodes text attachments: UTF-8, else Windows-1252 like most legacy files.
nonisolated enum TextDecoding {
    static func string(from data: Data) -> String {
        let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .windowsCP1252) ?? ""
        return text.hasPrefix("\u{FEFF}") ? String(text.dropFirst()) : text
    }
}
