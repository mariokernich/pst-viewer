import Foundation
import Observation
import SwiftUI

/// Short confirmations and errors shown at the bottom of the window.
@Observable
final class Toasts {
    struct Toast: Identifiable, Equatable {
        enum Style {
            case success
            case failure
        }

        let id = UUID()
        let message: String
        let style: Style
    }

    private(set) var current: Toast?
    @ObservationIgnored private var hideTask: Task<Void, Never>?

    func show(_ message: String, style: Toast.Style = .success) {
        let toast = Toast(message: message, style: style)
        current = toast
        AccessibilityNotification.Announcement(message).post()
        hideTask?.cancel()
        hideTask = Task {
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled, current?.id == toast.id else { return }
            current = nil
        }
    }

    func dismiss() {
        hideTask?.cancel()
        current = nil
    }
}
