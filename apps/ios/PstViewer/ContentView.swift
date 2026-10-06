import PstViewerCore
import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "envelope.badge")
                .font(.system(size: 48))
                .foregroundStyle(.tint)
            Text("PST Viewer")
                .font(.largeTitle.bold())
            Text("Core \(coreVersion())")
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
