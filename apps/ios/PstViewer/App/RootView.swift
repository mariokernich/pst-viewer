import SwiftUI
import UniformTypeIdentifiers

/// The content of a window: welcome screen, opening progress or mailbox.
struct RootView: View {
    @State private var model = AppModel()
    @State private var isDropTargeted = false

    var body: some View {
        Group {
            switch model.screen {
            case .welcome:
                WelcomeView()
            case let .opening(opening):
                OpeningView(opening: opening)
            case let .mailbox(mailbox):
                MailboxView(mailbox: mailbox)
                    .id(ObjectIdentifier(mailbox))
            }
        }
        .environment(model)
        .fileImporter(isPresented: isImporting, allowedContentTypes: model.importKind == .folder ? [.folder] : [.data]) { result in
            if case let .success(url) = result { model.open(url) }
        }
        .onOpenURL { model.open($0) }
        .onDrop(of: FileDrop.types, delegate: FileDrop(isTargeted: $isDropTargeted) { url in model.open(url) })
        .overlay {
            if isDropTargeted { DropOverlay() }
        }
        .overlay(alignment: .bottom) {
            ToastView(toasts: model.toasts)
        }
        .sheet(isPresented: $model.showsSettings) {
            SettingsView()
                .environment(model)
        }
        .focusedSceneValue(\.appModel, model)
        #if DEBUG
        .sheet(isPresented: Binding { model.demoPreviewURL != nil } set: { if !$0 { model.demoPreviewURL = nil } }) {
            if let url = model.demoPreviewURL {
                QuickLookView(url: url).ignoresSafeArea()
            }
        }
        #endif
        .task {
            await model.recents.refreshAvailability()
            #if DEBUG
            DemoDriver.start(model)
            #endif
        }
    }

    private var isImporting: Binding<Bool> {
        Binding { model.importKind != nil } set: { if !$0 { model.importKind = nil } }
    }
}

/// Highlights the window while a file is dragged over it.
private struct DropOverlay: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 28, style: .continuous)
            .strokeBorder(Color.accentColor, style: StrokeStyle(lineWidth: 3, dash: [10, 8]))
            .background(Color.accentColor.opacity(0.08), in: .rect(cornerRadius: 28, style: .continuous))
            .overlay {
                Label("Release to open the file", systemImage: "arrow.down.doc")
                    .font(.headline)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(.regularMaterial, in: .capsule)
            }
            .padding(12)
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }
}

/// Opens files and folders dropped from the Files app or other apps. Text,
/// images and media (e.g. text dragged within the app) are not accepted.
struct FileDrop: DropDelegate {
    static let types: [UTType] = [.folder, .data]
    private static let rejected: [UTType] = [.text, .image, .audiovisualContent]

    @Binding var isTargeted: Bool
    let open: @MainActor (URL) -> Void

    func validateDrop(info: DropInfo) -> Bool {
        info.hasItemsConforming(to: Self.types) && !info.hasItemsConforming(to: Self.rejected)
    }

    func dropEntered(info: DropInfo) {
        isTargeted = validateDrop(info: info)
    }

    func dropExited(info: DropInfo) {
        isTargeted = false
    }

    func performDrop(info: DropInfo) -> Bool {
        isTargeted = false
        guard let provider = info.itemProviders(for: Self.types).first else { return false }
        let type = provider.registeredTypeIdentifiers.first { identifier in
            UTType(identifier).map { type in Self.types.contains { type.conforms(to: $0) } } ?? false
        } ?? UTType.data.identifier
        let open = open
        provider.loadInPlaceFileRepresentation(forTypeIdentifier: type) { url, inPlace, _ in
            guard let url else { return }
            // Copies made for the drop are deleted afterwards, so keep our own.
            guard let target = inPlace ? url : Inbox.keepCopy(of: url) else { return }
            Task { @MainActor in open(target) }
        }
        return true
    }
}

/// Copies of files handed to the app (like the system's "Open in" copies).
nonisolated enum Inbox {
    static var directory: URL {
        URL.documentsDirectory.appending(path: "Inbox", directoryHint: .isDirectory)
    }

    static func keepCopy(of url: URL) -> URL? {
        let folder = directory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
        let target = folder.appending(path: url.lastPathComponent)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: url, to: target)
            return target
        } catch {
            return nil
        }
    }

    static func contains(_ path: String) -> Bool {
        URL(filePath: path).standardizedFileURL.path.hasPrefix(directory.standardizedFileURL.path)
    }
}
