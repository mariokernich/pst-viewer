import PstViewerCore
import SwiftUI

/// The archive card, "All Items" and the folder tree.
struct SidebarView: View {
    @Environment(MailboxModel.self) private var mailbox
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var mailbox = mailbox
        List(selection: $mailbox.folderSelection) {
            Section {
                StoreCard()
            }
            Section {
                Label("All Items", systemImage: "tray.2")
                    .badge(totalUnread)
                    .tag(FolderSelection.all)
            }
            Section {
                FolderTreeRows(nodes: mailbox.folderTree)
            }
        }
        .listStyle(.sidebar)
        .navigationTitle(Text("Folders"))
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close File", systemImage: "xmark") { app.closeArchive() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu("File Information", systemImage: "ellipsis") {
                    Section(mailbox.store.fileName) {
                        Button("Open Another File…", systemImage: "doc") { app.importKind = .file }
                        Button("Open Folder…", systemImage: "folder") { app.importKind = .folder }
                    }
                    Section {
                        Toggle("Show Empty Folders", systemImage: "eye", isOn: $mailbox.showsEmptyFolders)
                        Button("Settings", systemImage: "gear") { app.showsSettings = true }
                    }
                    Section {
                        Button("Close File", systemImage: "xmark") { app.closeArchive() }
                    }
                }
            }
        }
    }

    /// Each unread message once, also when it is in several folders (labels).
    private var totalUnread: Int {
        Int(mailbox.store.unreadCount)
    }
}

/// Name, size, item count and format of the archive, and the progress of the
/// background full-text index.
private struct StoreCard: View {
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        let store = mailbox.store
        HStack(spacing: 12) {
            ArchiveIcon(name: store.fileName, isFolder: store.format == .folder)
            VStack(alignment: .leading, spacing: 3) {
                Text(verbatim: store.fileName)
                    .font(.headline)
                    .lineLimit(2)
                    .truncationMode(.middle)
                Text(verbatim: store.format.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack(spacing: 4) {
                    Image(systemName: "lock.fill")
                        .imageScale(.small)
                        .accessibilityLabel(Text("Read-only"))
                    Text(verbatim: summary(store))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                if let percent = mailbox.indexPercent {
                    VStack(alignment: .leading, spacing: 3) {
                        ProgressView(value: Double(max(3, percent)), total: 100)
                        Text("Full-text index: \(Formatting.percent(percent))")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    .padding(.top, 4)
                    .accessibilityElement(children: .combine)
                    .transition(.opacity)
                }
            }
        }
        .padding(.vertical, 4)
        .animation(.default, value: mailbox.indexPercent == nil)
        .accessibilityElement(children: .combine)
    }

    private func summary(_ store: StoreInfo) -> String {
        var parts = [String(localized: "\(Int(store.itemCount)) items")]
        if store.format != .folder { parts.append(Formatting.size(store.fileSize)) }
        if let min = store.dateMin, let max = store.dateMax {
            parts.append("\(Formatting.shortDate(min)) – \(Formatting.shortDate(max))")
        }
        return parts.joined(separator: " · ")
    }
}

/// Folder rows with disclosure groups for subfolders.
private struct FolderTreeRows: View {
    let nodes: [FolderNode]
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        ForEach(nodes) { node in
            if node.children.isEmpty {
                FolderRow(folder: node.folder)
            } else {
                DisclosureGroup(isExpanded: expansion(of: node.id)) {
                    AnyView(FolderTreeRows(nodes: node.children))
                } label: {
                    FolderRow(folder: node.folder)
                }
            }
        }
    }

    private func expansion(of id: UInt32) -> Binding<Bool> {
        Binding {
            mailbox.expandedFolders.contains(id)
        } set: { expanded in
            if expanded {
                mailbox.expandedFolders.insert(id)
            } else {
                mailbox.expandedFolders.remove(id)
            }
        }
    }
}

private struct FolderRow: View {
    let folder: FolderInfo

    var body: some View {
        Label {
            Text(verbatim: folder.displayName)
                .lineLimit(1)
        } icon: {
            Image(systemName: folder.symbolName)
        }
        // Folders without items are dimmed (as on the desktop).
        .opacity(folder.totalCount == 0 ? 0.5 : 1)
        .badge(Int(folder.unreadCount))
        .tag(FolderSelection.folder(folder.id))
        .accessibilityValue(Text("\(Int(folder.itemCount)) items"))
    }
}

extension ArchiveFormat {
    var label: String {
        switch self {
        case .ansi: String(localized: "Outlook data file (ANSI)")
        case .unicode: String(localized: "Outlook data file")
        case .unicode4k: String(localized: "Outlook offline file")
        case .mbox: String(localized: "MBOX mailbox")
        case .eml: String(localized: "Email file")
        case .msg: String(localized: "Outlook item")
        case .folder: String(localized: "Folder of emails")
        case .unknown: String(localized: "Mail archive")
        }
    }
}
