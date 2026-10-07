import Foundation
import PstViewerCore

/// A removable chip describing an active filter (port of the desktop's `FilterChips`).
struct FilterChip: Identifiable {
    let id: String
    let label: String
    var symbol: String?
    /// Resets this filter to its default.
    let reset: (inout SearchFilters) -> Void
}

extension SearchFilters {
    var chips: [FilterChip] {
        var chips: [FilterChip] = []
        if datePreset != .any {
            let value = datePreset == .custom
                ? [dateFrom, dateTo].map { $0.flatMap(Self.date(fromISO:)).map { $0.formatted(.dateTime.day(.twoDigits).month(.twoDigits).year()) } ?? "…" }.joined(separator: " – ")
                : datePreset.label
            chips.append(FilterChip(id: "date", label: String(localized: "Date: \(value)")) {
                $0.datePreset = .any
                $0.dateFrom = nil
                $0.dateTo = nil
            })
        }
        if !from.trimmingCharacters(in: .whitespaces).isEmpty {
            chips.append(FilterChip(id: "from", label: String(localized: "From: \(from)")) { $0.from = "" })
        }
        if !to.trimmingCharacters(in: .whitespaces).isEmpty {
            chips.append(FilterChip(id: "to", label: String(localized: "To: \(to)")) { $0.to = "" })
        }
        if readState != .any {
            chips.append(FilterChip(id: "read", label: readState.label) { $0.readState = .any })
        }
        if hasAttachments {
            chips.append(FilterChip(id: "attachments", label: String(localized: "Has attachments"), symbol: "paperclip") { $0.hasAttachments = false })
        }
        if let attachmentType {
            chips.append(FilterChip(id: "attachmentType", label: String(localized: "Attachment: \(attachmentType.label)")) { $0.attachmentType = nil })
        }
        if important {
            chips.append(FilterChip(id: "important", label: String(localized: "Important"), symbol: "exclamationmark.triangle") { $0.important = false })
        }
        if flagged {
            chips.append(FilterChip(id: "flagged", label: String(localized: "Flagged"), symbol: "flag") { $0.flagged = false })
        }
        if let minSize {
            chips.append(FilterChip(id: "size", label: String(localized: "At least \(Formatting.size(minSize))")) { $0.minSize = nil })
        }
        if !kinds.isEmpty {
            let value = kinds.map(\.pluralLabel).formatted(.list(type: .and, width: .narrow))
            chips.append(FilterChip(id: "kinds", label: String(localized: "Type: \(value)")) { $0.kinds = [] })
        }
        if !fields.isEmpty {
            let value = fields.map(\.label).formatted(.list(type: .and, width: .narrow))
            chips.append(FilterChip(id: "fields", label: String(localized: "Only: \(value)")) { $0.fields = [] })
        }
        return chips
    }

    /// The custom range start as date (stored as ISO date by the core).
    var customFrom: Date? {
        get { dateFrom.flatMap(Self.date(fromISO:)) }
        set { dateFrom = newValue.map(Self.isoDate) }
    }

    var customTo: Date? {
        get { dateTo.flatMap(Self.date(fromISO:)) }
        set { dateTo = newValue.map(Self.isoDate) }
    }

    private static func date(fromISO value: String) -> Date? {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    private static func isoDate(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 1, parts.day ?? 1)
    }
}
