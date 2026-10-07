import PstViewerCore
import SwiftUI

extension Color {
    /// Background of search matches (the desktop app's `--highlight`).
    static let highlight = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.722, green: 0.565, blue: 0.102, alpha: 1)
            : UIColor(red: 1, green: 0.882, blue: 0.408, alpha: 1)
    })

    static let highlightText = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark ? .white : UIColor(red: 0.114, green: 0.114, blue: 0.122, alpha: 1)
    })
}

extension AttributedString {
    /// Text with the matches of the folded search terms highlighted; the core
    /// finds them accent and case insensitively.
    init(_ text: String, highlighting terms: [String]) {
        self.init(text)
        guard !terms.isEmpty, !text.isEmpty else { return }
        let utf16 = text.utf16
        for match in findMatches(text: text, terms: terms) {
            guard let lower = utf16.index(utf16.startIndex, offsetBy: Int(match.start), limitedBy: utf16.endIndex),
                  let upper = utf16.index(utf16.startIndex, offsetBy: Int(match.end), limitedBy: utf16.endIndex),
                  let range = Range(lower..<upper, in: self) else { continue }
            self[range].backgroundColor = .highlight
            self[range].foregroundColor = .highlightText
        }
    }
}
