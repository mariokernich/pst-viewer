import PstViewerCore
import SwiftUI

/// Appointment, task and contact details, and the note on encrypted messages.
struct MessageCards: View {
    let detail: MessageDetail

    var body: some View {
        VStack(spacing: 12) {
            if let appointment = detail.appointment, appointment.hasDetails {
                InfoCard {
                    if appointment.start != nil {
                        InfoRow(symbol: "calendar", label: String(localized: "When")) {
                            Text(verbatim: Formatting.range(start: appointment.start, end: appointment.end, allDay: appointment.isAllDay))
                                + (appointment.isAllDay ? Text(verbatim: "  ") + Text("(All day)").foregroundStyle(.secondary) : Text(verbatim: ""))
                        }
                    }
                    if !appointment.location.isEmpty {
                        InfoRow(symbol: "mappin.and.ellipse", label: String(localized: "Where")) {
                            Text(verbatim: appointment.location)
                        }
                    }
                    if appointment.isRecurring {
                        InfoRow(symbol: "repeat", label: String(localized: "Recurring")) {
                            Text(verbatim: appointment.recurrence.isEmpty ? "—" : appointment.recurrence)
                        }
                    }
                    if !appointment.attendees.isEmpty {
                        InfoRow(symbol: "person.2", label: String(localized: "Attendees")) {
                            Text(verbatim: appointment.attendees)
                        }
                    }
                }
            }
            if let task = detail.task {
                InfoCard {
                    InfoRow(symbol: "checklist", label: String(localized: "Status")) {
                        Text(verbatim: "\(task.statusLabel) · ") + Text("\(Formatting.percent(Int((task.percentComplete * 100).rounded()))) complete")
                    }
                    if let start = task.startDate {
                        InfoRow(symbol: "calendar", label: String(localized: "Start")) { Text(verbatim: Formatting.date(start)) }
                    }
                    if let due = task.dueDate {
                        InfoRow(symbol: "calendar.badge.exclamationmark", label: String(localized: "Due")) { Text(verbatim: Formatting.date(due)) }
                    }
                    if !task.owner.isEmpty {
                        InfoRow(symbol: "person", label: String(localized: "Owner")) { Text(verbatim: task.owner) }
                    }
                }
            }
            if let fields = detail.contact, !fields.isEmpty {
                InfoCard {
                    ForEach(fields, id: \.key) { field in
                        InfoRow(label: field.label) {
                            Text(verbatim: field.displayValue)
                        }
                    }
                }
            }
            if detail.security == .encrypted, detail.html == nil, detail.text.isEmpty {
                Label("This message is encrypted (S/MIME) and cannot be displayed without the private key.", systemImage: "lock")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12, style: .continuous))
            }
        }
    }
}

private extension AppointmentInfo {
    var hasDetails: Bool {
        start != nil || !location.isEmpty || !attendees.isEmpty
    }
}

/// A rounded box with label/value rows.
struct InfoCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 10) {
            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12, style: .continuous))
    }
}

struct InfoRow<Value: View>: View {
    var symbol: String?
    let label: String
    @ViewBuilder let value: Value

    var body: some View {
        GridRow {
            Group {
                if let symbol {
                    Label(label, systemImage: symbol)
                } else {
                    Text(verbatim: label)
                }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            value
                .font(.subheadline)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}
