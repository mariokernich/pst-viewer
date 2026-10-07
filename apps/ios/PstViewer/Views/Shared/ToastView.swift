import SwiftUI

/// Shows the current toast as a capsule above the bottom edge.
struct ToastView: View {
    let toasts: Toasts

    var body: some View {
        ZStack {
            if let toast = toasts.current {
                Label {
                    Text(toast.message)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(2)
                } icon: {
                    Image(systemName: toast.style == .success ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        .foregroundStyle(toast.style == .success ? Color.green : Color.red)
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
                .modifier(CapsuleBackground())
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
                .onTapGesture { toasts.dismiss() }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .id(toast.id)
            }
        }
        .animation(.spring(duration: 0.35), value: toasts.current)
    }
}

/// Liquid Glass on iOS 26 and later, a material capsule before.
private struct CapsuleBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: .capsule)
        } else {
            content
                .background(.regularMaterial, in: .capsule)
                .shadow(color: .black.opacity(0.15), radius: 12, y: 4)
        }
    }
}
