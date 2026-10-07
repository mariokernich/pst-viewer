import SwiftUI

/// Progress while an archive is opened, with a cancel button.
struct OpeningView: View {
    let opening: OpeningModel
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 16) {
                ArchiveIcon(name: opening.name, isFolder: opening.isFolder)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Opening \(opening.name)")
                        .font(.headline)
                        .lineLimit(2)
                    Text(opening.status)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .contentTransition(.opacity)
                }
            }

            Group {
                if let fraction = opening.fractionDone {
                    ProgressView(value: fraction)
                } else {
                    IndeterminateBar()
                }
            }
            .padding(.top, 24)
            .accessibilityLabel(Text(opening.status))

            HStack(spacing: 16) {
                if let folder = opening.progress?.folderName, !folder.isEmpty {
                    Text("Folder: \(folder)")
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Text(verbatim: opening.detail)
                    .lineLimit(1)
                    .layoutPriority(1)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .monospacedDigit()
            .frame(minHeight: 16)
            .padding(.top, 10)

            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { model.cancelOpening() }
                    .modifier(SecondaryButtonStyle())
                    .keyboardShortcut(.cancelAction)
                    .disabled(opening.isCanceled)
            }
            .padding(.top, 20)
        }
        .padding(24)
        .frame(maxWidth: 440)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 28, style: .continuous))
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .animation(.default, value: opening.progress?.phase)
    }
}

/// A bar sliding back and forth while the total is unknown.
private struct IndeterminateBar: View {
    @State private var moving = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            Capsule()
                .fill(Color(.tertiarySystemFill))
                .overlay(alignment: .leading) {
                    Capsule()
                        .fill(.tint)
                        .frame(width: proxy.size.width / 3)
                        .offset(x: moving ? proxy.size.width * 2 / 3 : 0)
                }
                .clipShape(.capsule)
        }
        .frame(height: 6)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.1).repeatForever()) { moving = true }
        }
        .accessibilityAddTraits(.updatesFrequently)
    }
}
