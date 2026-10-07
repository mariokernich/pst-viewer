import SwiftUI

/// Recently opened files and folders as a list section (iPhone).
struct RecentFilesSection: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Section {
            if model.recents.files.isEmpty {
                NoRecentFiles()
            } else {
                ForEach(model.recents.files) { file in
                    RecentFileRow(file: file, isMissing: model.recents.missing.contains(file.path))
                        .swipeActions {
                            Button("Remove from List", systemImage: "trash", role: .destructive) {
                                model.recents.remove(file)
                            }
                        }
                        .contextMenu { RemoveRecentButton(file: file) }
                }
            }
        } header: {
            RecentFilesHeader()
        }
    }
}

/// Recently opened files and folders as a card next to the open buttons (iPad).
struct RecentFilesCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            RecentFilesHeader()
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 6)
            if model.recents.files.isEmpty {
                NoRecentFiles()
                    .padding(.bottom, 24)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(model.recents.files) { file in
                            RecentFileRow(file: file, isMissing: model.recents.missing.contains(file.path))
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .contentShape(.hoverEffect, .rect(cornerRadius: 16))
                                .hoverEffect(.highlight)
                                .contextMenu { RemoveRecentButton(file: file) }
                        }
                    }
                    .padding(.bottom, 8)
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(maxHeight: 520)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 28, style: .continuous))
    }
}

private struct RecentFilesHeader: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack {
            Label("Recent Files", systemImage: "clock")
            Spacer()
            if !model.recents.files.isEmpty {
                Button("Clear List") { model.recents.clear() }
                    .font(.subheadline.weight(.regular))
                    .foregroundStyle(.tint)
                    .textCase(nil)
            }
        }
    }
}

private struct RemoveRecentButton: View {
    let file: RecentFile
    @Environment(AppModel.self) private var model

    var body: some View {
        Button("Remove from List", systemImage: "xmark.circle", role: .destructive) {
            model.recents.remove(file)
        }
    }
}

private struct NoRecentFiles: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "clock")
                .font(.title2)
                .foregroundStyle(.tertiary)
                .padding(.bottom, 4)
            Text("No files opened yet")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
            Text("Files you open appear here so you can reopen them with a single tap.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .padding(.horizontal, 24)
        .accessibilityElement(children: .combine)
    }
}

private struct RecentFileRow: View {
    let file: RecentFile
    let isMissing: Bool
    @Environment(AppModel.self) private var model

    var body: some View {
        Button {
            model.open(file)
        } label: {
            HStack(spacing: 12) {
                ArchiveIcon(name: file.name, isFolder: file.isFolder)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(verbatim: file.name)
                            .font(.body.weight(.semibold))
                            .lineLimit(1)
                            .truncationMode(.middle)
                        if isMissing {
                            Text("Not found")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.red)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 1)
                                .background(Color.red.opacity(0.12), in: .capsule)
                        }
                    }
                    Text(verbatim: details)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Text("opened \(Formatting.relative(file.lastOpened))")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            .opacity(isMissing ? 0.55 : 1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
        }
        .foregroundStyle(.primary)
        .disabled(model.isOpening)
        .accessibilityHint(Text("Opens the file"))
    }

    private var details: String {
        var parts = [file.location]
        if !file.isFolder { parts.append(Formatting.size(file.size)) }
        if let count = file.itemCount { parts.append(String(localized: "\(Int(count)) items")) }
        return parts.joined(separator: " · ")
    }
}
