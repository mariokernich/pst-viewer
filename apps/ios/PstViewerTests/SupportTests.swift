import Foundation
import Testing
@testable import PstViewer

@MainActor
struct PeopleTests {
    @Test(arguments: [
        ("Anna Müller", "", "AM"),
        ("Müller, Anna", "", "AM"),
        ("Anna", "", "A"),
        ("", "info@shop.de", "I"),
        ("Anna Maria Becker", "", "AB"),
        ("\"Anna\" <anna@example.com>", "", "?"),
        ("", "", "?"),
    ])
    func initials(name: String, email: String, expected: String) {
        #expect(People.initials(name: name, email: email) == expected)
    }

    @Test func displayAddress() {
        #expect(People.displayAddress(name: "Anna", email: "anna@example.com") == "Anna <anna@example.com>")
        #expect(People.displayAddress(name: "", email: "anna@example.com") == "anna@example.com")
        #expect(People.displayAddress(name: "Anna", email: "") == "Anna")
        #expect(People.displayAddress(name: "anna@example.com", email: "anna@example.com") == "anna@example.com")
    }
}

@MainActor
struct FormattingTests {
    @Test func listDateOfToday() {
        let now = Date.now
        #expect(Formatting.listDate(now.epochMillis, now: now) == now.formatted(date: .omitted, time: .shortened))
        #expect(Formatting.listDate(0) == "")
    }

    @Test func listDateOfYesterday() throws {
        let now = Date.now
        let yesterday = try #require(Calendar.current.date(byAdding: .day, value: -1, to: now))
        #expect(Formatting.listDate(yesterday.epochMillis, now: now) == String(localized: "Yesterday"))
    }

    @Test func sizesUseBinaryUnits() {
        #expect(Formatting.size(512).contains("512"))
        #expect(Formatting.size(1536).contains("1"))
        #expect(Formatting.size(-1) == "")
        // 1 MB in binary steps.
        #expect(Formatting.size(1_048_576).contains("1"))
    }

    @Test func epochMillisRoundTrip() {
        let millis: Int64 = 1_759_000_000_123
        #expect(Date(epochMillis: millis).epochMillis == millis)
    }

    @Test func rangeOfAllDayEvent() throws {
        let start = Date(epochMillis: 1_759_000_000_000)
        let calendar = Calendar.current
        let dayStart = calendar.startOfDay(for: start)
        let nextDay = try #require(calendar.date(byAdding: .day, value: 1, to: dayStart))
        // An all-day event ends at midnight of the next day: one date only.
        #expect(Formatting.range(start: dayStart.epochMillis, end: nextDay.epochMillis, allDay: true) == Formatting.date(dayStart))
    }
}

@MainActor
struct CSVTableTests {
    @Test func detectsSemicolonsAndQuotes() {
        let table = CSVTable(text: "Datum;Text;Betrag\r\n02.09.2026;\"Bahn; Köln\";89,90\n03.09.2026;\"Sagte \"\"Hallo\"\"\";1\n")
        #expect(table.rows.count == 3)
        #expect(table.rows[1] == ["02.09.2026", "Bahn; Köln", "89,90"])
        #expect(table.rows[2][1] == "Sagte \"Hallo\"")
        #expect(table.widths.count == 3)
        #expect(!table.isTruncated)
    }

    @Test func detectsTabs() {
        let table = CSVTable(text: "a\tb\n1\t2")
        #expect(table.rows == [["a", "b"], ["1", "2"]])
    }

    @Test func limitsRows() {
        let text = (0..<(CSVTable.rowLimit + 10)).map { "\($0),x" }.joined(separator: "\n")
        let table = CSVTable(text: text)
        #expect(table.rows.count == CSVTable.rowLimit)
        #expect(table.isTruncated)
    }
}
