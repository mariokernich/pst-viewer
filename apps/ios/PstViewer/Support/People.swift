import SwiftUI

/// Initials, avatar colours and address display (port of `lib/people.ts`).
enum People {
    /// Initials for an avatar: "Anna Müller" -> "AM", "Müller, Anna" -> "AM", "info@shop.de" -> "I".
    static func initials(name: String, email: String = "") -> String {
        let raw = name.isEmpty ? email : name
        let source = String(raw.prefix { !"\"'(<".contains($0) }).trimmingCharacters(in: .whitespaces)
        guard let first = source.first else { return "?" }
        if name.isEmpty, let letter = email.first { return String(letter).uppercased() }
        let parts: [Substring] = source.contains(",")
            ? source.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces)[...] }.reversed()
            : source.split(whereSeparator: \.isWhitespace)
        let letters = parts.compactMap { part in part.first(where: \.isLetter).map { String($0).uppercased() } }
        guard let head = letters.first, let tail = letters.last else { return String(first).uppercased() }
        return letters.count == 1 ? head : head + tail
    }

    private static let hues: [Double] = [211, 262, 330, 14, 32, 145, 172, 190, 238, 290]

    /// A stable gradient for a person, the same as in the desktop app.
    static func gradient(for key: String) -> LinearGradient {
        var hash: Int32 = 0
        for unit in key.lowercased().utf16 {
            hash = 31 &* hash &+ Int32(unit)
        }
        let hue = hues[Int(hash.magnitude % UInt32(hues.count))]
        return LinearGradient(
            colors: [Color(hue: hue, saturation: 0.75, lightness: 0.62), Color(hue: (hue + 25).truncatingRemainder(dividingBy: 360), saturation: 0.70, lightness: 0.48)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    /// "Name <address>", or whichever of both is known.
    static func displayAddress(name: String, email: String) -> String {
        if !name.isEmpty, !email.isEmpty, name != email { return "\(name) <\(email)>" }
        return name.isEmpty ? email : name
    }
}

extension Color {
    /// A colour from CSS-style HSL values (hue in degrees, saturation and lightness 0…1).
    init(hue: Double, saturation: Double, lightness: Double) {
        let brightness = lightness + saturation * min(lightness, 1 - lightness)
        let hsbSaturation = brightness == 0 ? 0 : 2 * (1 - lightness / brightness)
        self.init(hue: hue / 360, saturation: hsbSaturation, brightness: brightness)
    }
}
