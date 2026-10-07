import Foundation
import PstViewerCore

extension Date {
    /// A date from epoch milliseconds as used by the core.
    init(epochMillis: Int64) {
        self.init(timeIntervalSince1970: TimeInterval(epochMillis) / 1000)
    }

    var epochMillis: Int64 {
        Int64((timeIntervalSince1970 * 1000).rounded())
    }
}

/// Date, size and number formatting, matching the desktop app (`lib/format.ts`).
enum Formatting {
    /// Compact date for message lists: time today, "Yesterday", the weekday
    /// within a week, day and month this year, a short date otherwise.
    static func listDate(_ millis: Int64, now: Date = .now) -> String {
        guard millis != 0 else { return "" }
        let date = Date(epochMillis: millis)
        let calendar = Calendar.current
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day ?? 0
        switch days {
        case 0:
            return date.formatted(date: .omitted, time: .shortened)
        case 1:
            return String(localized: "Yesterday")
        case 2..<7:
            return date.formatted(.dateTime.weekday(.wide))
        default:
            if calendar.isDate(date, equalTo: now, toGranularity: .year) {
                return date.formatted(.dateTime.day().month(.abbreviated))
            }
            return date.formatted(.dateTime.day(.twoDigits).month(.twoDigits).year(.twoDigits))
        }
    }

    /// Full date and time, e.g. "Montag, 22. September 2025 um 08:27".
    static func fullDate(_ millis: Int64?) -> String {
        guard let millis, millis != 0 else { return "" }
        return Date(epochMillis: millis).formatted(.dateTime.weekday(.wide).day().month(.wide).year().hour().minute())
    }

    /// A date without time, e.g. "22. September 2025".
    static func date(_ millis: Int64?) -> String {
        guard let millis, millis != 0 else { return "" }
        return date(Date(epochMillis: millis))
    }

    static func date(_ date: Date) -> String {
        date.formatted(.dateTime.day().month(.wide).year())
    }

    /// A numeric date, e.g. "22.09.2025".
    static func shortDate(_ millis: Int64?) -> String {
        guard let millis, millis != 0 else { return "" }
        return Date(epochMillis: millis).formatted(.dateTime.day(.twoDigits).month(.twoDigits).year())
    }

    static func time(_ millis: Int64) -> String {
        Date(epochMillis: millis).formatted(date: .omitted, time: .shortened)
    }

    /// An appointment range, collapsing the date if start and end fall on the same day.
    static func range(start: Int64?, end: Int64?, allDay: Bool) -> String {
        guard let start, start != 0 else { return "" }
        let calendar = Calendar.current
        let sameDay = { (a: Int64, b: Int64) in calendar.isDate(Date(epochMillis: a), inSameDayAs: Date(epochMillis: b)) }
        if allDay {
            // All-day events end at midnight of the following day.
            let last = end.map { $0 - 1 } ?? start
            if end == nil || sameDay(start, last) { return date(start) }
            return "\(date(start)) – \(date(last))"
        }
        guard let end, end != 0 else { return fullDate(start) }
        if sameDay(start, end) { return "\(fullDate(start)) – \(time(end))" }
        return "\(fullDate(start)) – \(fullDate(end))"
    }

    /// Relative time, e.g. "vor 3 Tagen" / "3 days ago".
    static func relative(_ date: Date, now: Date = .now) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.dateTimeStyle = .named
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: now)
    }

    private static let sizeUnits: [UnitInformationStorage] = [.bytes, .kilobytes, .megabytes, .gigabytes, .terabytes]

    /// A file size in binary steps with one decimal below 100, e.g. "1,2 MB".
    static func size(_ bytes: Int64) -> String {
        guard bytes >= 0 else { return "" }
        var value = Double(bytes)
        var unit = 0
        while value >= 1024 && unit < sizeUnits.count - 1 {
            value /= 1024
            unit += 1
        }
        let fraction = unit == 0 || value >= 100 ? 0 : 1
        return Measurement(value: value, unit: sizeUnits[unit])
            .formatted(.measurement(width: .abbreviated, usage: .asProvided, numberFormatStyle: .number.precision(.fractionLength(0...fraction))))
    }

    static func number<Value: BinaryInteger>(_ value: Value) -> String {
        Int(value).formatted()
    }

    /// A whole percentage with the locale's spacing, e.g. "45 %" or "45%".
    static func percent(_ value: Int) -> String {
        (Double(value) / 100).formatted(.percent.precision(.fractionLength(0)))
    }

    /// Section title of a date group, e.g. "Heute" or "September 2025".
    static func groupTitle(_ group: DateGroup, now: Date = .now) -> String {
        switch group {
        case .today: String(localized: "Today")
        case .yesterday: String(localized: "Yesterday")
        case .thisWeek: String(localized: "This Week")
        case .lastWeek: String(localized: "Last Week")
        case .thisMonth: String(localized: "This Month")
        case .unknown: String(localized: "No Date")
        case let .month(year, month):
            monthTitle(year: Int(year), month: Int(month), now: now)
        }
    }

    private static func monthTitle(year: Int, month: Int, now: Date) -> String {
        let calendar = Calendar.current
        guard let date = calendar.date(from: DateComponents(year: year, month: month, day: 1)) else { return "" }
        if calendar.component(.year, from: now) == year {
            return date.formatted(.dateTime.month(.wide))
        }
        return date.formatted(.dateTime.month(.wide).year())
    }
}
