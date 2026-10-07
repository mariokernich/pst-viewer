import PstViewerCore
import SwiftUI
import WebKit

/// A CSV or TSV attachment as table (the first 2,000 rows).
struct CSVPreview: View {
    let data: Data
    @State private var table: CSVTable?

    var body: some View {
        Group {
            if let table, let header = table.rows.first {
                ScrollView([.horizontal, .vertical]) {
                    LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                        Section {
                            ForEach(Array(table.rows.dropFirst().enumerated()), id: \.offset) { index, row in
                                cells(row, widths: table.widths)
                                    .background(index.isMultiple(of: 2) ? Color(.systemBackground) : Color(.secondarySystemBackground))
                            }
                        } header: {
                            cells(header, widths: table.widths)
                                .fontWeight(.semibold)
                                .background(Color(.tertiarySystemBackground))
                        }
                        if table.isTruncated {
                            Text("Large file – showing the first \(Formatting.number(CSVTable.rowLimit)) rows.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .padding(12)
                        }
                    }
                    .font(.footnote)
                    .textSelection(.enabled)
                    .clipShape(.rect(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color(.separator)))
                    .padding(12)
                }
            } else if table != nil {
                ContentUnavailableView("No preview for this file type", systemImage: "tablecells")
            } else {
                ProgressView()
            }
        }
        .task {
            let data = data
            table = await Task.detached { CSVTable(text: TextDecoding.string(from: data)) }.value
        }
    }

    private func cells(_ row: [String], widths: [CGFloat]) -> some View {
        HStack(spacing: 0) {
            ForEach(widths.indices, id: \.self) { column in
                Text(verbatim: column < row.count ? row[column] : "")
                    .lineLimit(3)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .frame(width: widths[column], alignment: .leading)
                    .overlay(alignment: .trailing) { Divider() }
            }
        }
        .overlay(alignment: .bottom) { Divider() }
    }
}

/// Rows of a CSV/TSV text (port of the desktop's parser, honouring quotes).
nonisolated struct CSVTable: Sendable {
    static let rowLimit = 2000

    let rows: [[String]]
    let isTruncated: Bool
    /// Column widths from the longest cell, within sensible bounds.
    let widths: [CGFloat]

    init(text: String) {
        let characters = Array(text)
        let firstLine = text.prefix { $0 != "\n" && $0 != "\r" }
        // The delimiter that splits the first line most often.
        let delimiter = (["\t", ";", ","] as [Character]).max { a, b in
            firstLine.filter { $0 == a }.count < firstLine.filter { $0 == b }.count
        } ?? ","
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var quoted = false
        var truncated = false
        var index = 0
        while index < characters.count {
            let c = characters[index]
            if quoted {
                if c == "\"", index + 1 < characters.count, characters[index + 1] == "\"" {
                    field.append("\"")
                    index += 1
                } else if c == "\"" {
                    quoted = false
                } else {
                    field.append(c)
                }
            } else if c == "\"", field.isEmpty {
                quoted = true
            } else if c == delimiter {
                row.append(field)
                field = ""
            } else if c == "\n" || c == "\r" || c == "\r\n" {
                row.append(field)
                rows.append(row)
                row = []
                field = ""
                if rows.count >= Self.rowLimit {
                    truncated = index < characters.count - 1
                    break
                }
            } else {
                field.append(c)
            }
            index += 1
        }
        if !truncated, !field.isEmpty || !row.isEmpty {
            row.append(field)
            rows.append(row)
        }
        self.rows = rows
        isTruncated = truncated
        let columns = rows.map(\.count).max() ?? 0
        widths = (0..<columns).map { column in
            let longest = rows.prefix(200).map { column < $0.count ? $0[column].count : 0 }.max() ?? 0
            return min(280, max(70, CGFloat(longest) * 7.5 + 24))
        }
    }
}

/// An HTML attachment, sanitised like a mail body and without remote content.
struct HTMLAttachmentPreview: View {
    let data: Data
    @State private var document: MailDocument?
    @State private var blocker: WKContentRuleList?
    @State private var height: CGFloat = 1

    var body: some View {
        ScrollView {
            if let document, let blocker {
                MailWebView(html: document.html, blocker: blocker, terms: [], isTransparent: false, contentHeight: $height)
                    .frame(height: max(height, 1))
                    .clipShape(.rect(cornerRadius: 14, style: .continuous))
                    .padding(12)
            } else {
                ProgressView()
                    .padding(40)
            }
        }
        .task {
            blocker = try? await WebContent.networkBlocker()
            let data = data
            document = await Task.detached {
                prepareMailDocument(html: TextDecoding.string(from: data), inlineImages: [:], allowRemote: false, extraCss: MailStyle.css(forText: false))
            }.value
        }
    }
}
