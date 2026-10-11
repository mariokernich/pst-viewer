import PstViewerCore
import SwiftUI

/// Appearance, language, help links, recent files and information about the app.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @AppStorage(Appearance.storageKey) private var appearance = Appearance.system

    var body: some View {
        NavigationStack {
            Form {
                Section("Appearance") {
                    AppearancePicker(selection: $appearance)
                }

                Section {
                    Button {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    } label: {
                        LabeledContent {
                            HStack(spacing: 6) {
                                Text(verbatim: currentLanguage)
                                Image(systemName: "arrow.up.forward.app")
                                    .imageScale(.small)
                            }
                        } label: {
                            SettingsLabel("Language", symbol: "globe", color: .blue)
                        }
                    }
                    .foregroundStyle(.primary)
                } footer: {
                    Text("PST Viewer is available in German and English. Choose the language in the Settings app.")
                }

                Section("Help & Feedback") {
                    LinkRow("Website & Help", symbol: "safari", color: .green, url: Links.website)
                    LinkRow("Source Code on GitHub", symbol: "chevron.left.forwardslash.chevron.right", color: Color(white: 0.3), url: Links.sourceCode)
                    LinkRow("Report a Problem", symbol: "ladybug", color: .orange, url: Links.reportProblem)
                    LinkRow("Rate PST Viewer", symbol: "star", color: .pink, url: Links.review)
                }

                Section {
                    NavigationLink { PrivacyView() } label: {
                        SettingsLabel("Privacy", symbol: "hand.raised", color: .indigo)
                    }
                    NavigationLink { LicensesView() } label: {
                        SettingsLabel("Open-Source Licences", symbol: "doc.text", color: .gray)
                    }
                    Button(role: .destructive) { model.recents.clear() } label: {
                        SettingsLabel("Clear Recent Files", symbol: "trash", color: .red)
                            .foregroundStyle(model.recents.files.isEmpty ? Color.secondary : Color.red)
                    }
                    .disabled(model.recents.files.isEmpty)
                } header: {
                    Text("About")
                } footer: {
                    VStack(spacing: 4) {
                        Text(verbatim: "PST Viewer \(appVersion) · Core \(coreVersion())")
                        Text("Free and open source (MIT). Only names, sizes and locations of opened files are stored, never mail content.")
                    }
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
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

/// Pages of the project, opened in the browser.
private enum Links {
    static var website: URL {
        let language = Bundle.main.preferredLocalizations.first == "de" ? "de" : "en"
        return URL(string: "https://mariokernich.github.io/pst-viewer/\(language)/docs/")!
    }

    static let sourceCode = URL(string: "https://github.com/mariokernich/pst-viewer")!
    static let reportProblem = URL(string: "https://github.com/mariokernich/pst-viewer/issues")!
    static let review = URL(string: "https://apps.apple.com/app/id6820516765?action=write-review")!
}

/// A row title with a coloured icon, like the rows of the Settings app.
private struct SettingsLabel: View {
    let title: LocalizedStringKey
    let symbol: String
    let color: Color

    init(_ title: LocalizedStringKey, symbol: String, color: Color) {
        self.title = title
        self.symbol = symbol
        self.color = color
    }

    var body: some View {
        Label {
            Text(title)
        } icon: {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(color.gradient, in: .rect(cornerRadius: 7))
        }
    }
}

/// A row that opens a web page in the browser.
private struct LinkRow: View {
    @Environment(\.openURL) private var openURL
    let title: LocalizedStringKey
    let symbol: String
    let color: Color
    let url: URL

    init(_ title: LocalizedStringKey, symbol: String, color: Color, url: URL) {
        self.title = title
        self.symbol = symbol
        self.color = color
        self.url = url
    }

    var body: some View {
        Button { openURL(url) } label: {
            HStack {
                SettingsLabel(title, symbol: symbol, color: color)
                Spacer()
                Image(systemName: "arrow.up.forward")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .foregroundStyle(.primary)
        .accessibilityHint(Text(verbatim: url.host() ?? ""))
    }
}

/// System, light and dark as small previews with a selection mark, like
/// "Display & Brightness" in the Settings app.
private struct AppearancePicker: View {
    @Binding var selection: Appearance

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Appearance.allCases) { option in
                Button {
                    withAnimation(.snappy) { selection = option }
                } label: {
                    VStack(spacing: 8) {
                        AppearancePreview(option: option)
                        Text(verbatim: option.label)
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                        Image(systemName: selection == option ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(selection == option ? AnyShapeStyle(.tint) : AnyShapeStyle(.tertiary))
                            .contentTransition(.symbolEffect(.replace))
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(verbatim: option.label))
                .accessibilityAddTraits(selection == option ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(.vertical, 8)
    }
}

/// A miniature screen in the colours of an appearance.
private struct AppearancePreview: View {
    let option: Appearance

    var body: some View {
        ZStack {
            switch option {
            case .system:
                // The same screen, light on the left and dark on the right.
                Screen(dark: false)
                    .overlay {
                        Screen(dark: true)
                            .mask(alignment: .trailing) { Rectangle().frame(width: 31) }
                    }
            case .light:
                Screen(dark: false)
            case .dark:
                Screen(dark: true)
            }
        }
        .frame(width: 62, height: 108)
        .clipShape(.rect(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12).strokeBorder(.separator, lineWidth: 1)
        }
    }

    /// Background and a few lines of a message list.
    private struct Screen: View {
        let dark: Bool

        var body: some View {
            let line = dark ? Color(white: 0.32) : Color(white: 0.82)
            ZStack(alignment: .topLeading) {
                dark ? Color(white: 0.11) : Color(white: 0.96)
                VStack(alignment: .leading, spacing: 7) {
                    ForEach([0.7, 0.9, 0.55, 0.8, 0.6], id: \.self) { width in
                        Capsule().fill(line).frame(width: 46 * width, height: 5)
                    }
                }
                .padding(.top, 14)
                .padding(.leading, 8)
            }
        }
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
