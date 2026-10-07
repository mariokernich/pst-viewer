import SwiftUI

@main
struct PstViewerApp: App {
    @AppStorage(Appearance.storageKey) private var appearance = Appearance.system

    init() {
        // Previews and exports of an earlier run are not needed anymore.
        TemporaryFiles.removeAll()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(appearance.colorScheme)
        }
        .commands {
            AppCommands()
        }
    }
}
