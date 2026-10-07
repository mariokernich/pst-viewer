import PstViewerCore
import SwiftUI

/// Appearance, language, recent files and information about the app.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @AppStorage(Appearance.storageKey) private var appearance = Appearance.system

    var body: some View {
        NavigationStack {
            Form {
                Section("Appearance") {
                    Picker("Appearance", selection: $appearance) {
                        ForEach(Appearance.allCases) { option in
                            Text(verbatim: option.label).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                }

                Section {
                    Button {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    } label: {
                        LabeledContent("Language") {
                            HStack(spacing: 6) {
                                Text(verbatim: currentLanguage)
                                Image(systemName: "arrow.up.forward.app")
                                    .imageScale(.small)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                } footer: {
                    Text("PST Viewer is available in German and English. Choose the language in the Settings app.")
                }

                Section {
                    Button("Clear Recent Files", role: .destructive) { model.recents.clear() }
                        .disabled(model.recents.files.isEmpty)
                } footer: {
                    Text("Only names, sizes and locations of opened files are stored, never mail content.")
                }

                Section("About") {
                    LabeledContent("Version", value: appVersion)
                    LabeledContent("Core", value: coreVersion())
                    NavigationLink("Privacy") { PrivacyView() }
                    NavigationLink("Open-Source Licences") { LicensesView() }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                }
            }
        }
    }

    private var appVersion: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "–"
        let build = info?["CFBundleVersion"] as? String ?? "–"
        return "\(version) (\(build))"
    }

    private var currentLanguage: String {
        let code = Bundle.main.preferredLocalizations.first ?? "en"
        return Locale.current.localizedString(forLanguageCode: code)?.localizedCapitalized ?? code
    }
}

/// What the app does and does not do with the user's data.
struct PrivacyView: View {
    private struct Item: Identifiable {
        let symbol: String
        let title: String
        let text: String

        var id: String { symbol }
    }

    private let items = [
        Item(symbol: "iphone", title: String(localized: "100% local"), text: String(localized: "Everything happens on your device. There is no upload, no cloud and no telemetry.")),
        Item(symbol: "lock", title: String(localized: "Strictly read-only"), text: String(localized: "Files are only read, never modified. New files are created only when you export or save something yourself.")),
        Item(symbol: "eye.slash", title: String(localized: "Tracking protection"), text: String(localized: "Remote images in emails stay blocked until you explicitly allow them for a message.")),
        Item(symbol: "checkmark.shield", title: String(localized: "Safe rendering"), text: String(localized: "HTML mail is sanitised and rendered in a sandbox – scripts never run.")),
        Item(symbol: "paperclip", title: String(localized: "Careful with attachments"), text: String(localized: "Attachments are previewed from a read-only temporary copy that is deleted when you close the preview. File types that can run code are never opened.")),
        Item(symbol: "person.crop.circle.badge.xmark", title: String(localized: "No account needed"), text: String(localized: "No sign-up, no login, no ads. Open a file and read.")),
    ]

    var body: some View {
        List {
            Section {
                Text("PST Viewer works entirely on your device. No upload, no cloud, no tracking – and your files are never modified.")
                    .font(.headline)
                    .padding(.vertical, 4)
            }
            Section {
                ForEach(items) { item in
                    Label {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(verbatim: item.title).font(.headline)
                            Text(verbatim: item.text).foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: item.symbol).foregroundStyle(.tint)
                    }
                    .padding(.vertical, 4)
                }
            } footer: {
                Text("The app collects no data. It only connects to the internet to load remote images you allow for a message; links open in your browser.")
            }
        }
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}
