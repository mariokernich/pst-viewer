import SwiftUI

/// Initials on a gradient that is stable per person, as in the desktop app.
struct AvatarView: View {
    let name: String
    let email: String
    var size: CGFloat = 36

    var body: some View {
        Circle()
            .fill(People.gradient(for: email.isEmpty ? (name.isEmpty ? "?" : name) : email))
            .overlay {
                Text(People.initials(name: name, email: email))
                    .font(.system(size: size * 0.38, weight: .semibold))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                    .padding(size * 0.08)
            }
            .overlay(Circle().strokeBorder(.black.opacity(0.08), lineWidth: 0.5))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}
