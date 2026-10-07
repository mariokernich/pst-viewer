import SwiftUI

/// The start screen: open a file or folder, or reopen a recent one.
struct WelcomeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        NavigationStack {
            Group {
                if sizeClass == .regular {
                    GeometryReader { proxy in
                        ScrollView {
                            HStack(alignment: .center, spacing: 48) {
                                IntroSection(alignment: .leading)
                                    .frame(maxWidth: 420)
                                RecentFilesCard()
                                    .frame(maxWidth: 480)
                            }
                            .padding(40)
                            .frame(maxWidth: .infinity, minHeight: proxy.size.height)
                        }
                        .scrollBounceBehavior(.basedOnSize)
                    }
                } else {
                    List {
                        Section {
                            IntroSection(alignment: .center)
                                .padding(.vertical, 8)
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 0, leading: 4, bottom: 0, trailing: 4))
                        RecentFilesSection()
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Settings", systemImage: "gear") { model.showsSettings = true }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

/// App icon, name, open buttons, supported formats and the read-only note.
private struct IntroSection: View {
    let alignment: HorizontalAlignment
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        VStack(alignment: alignment, spacing: 20) {
            VStack(alignment: alignment, spacing: 12) {
                Image(.appMark)
                    .resizable()
                    .frame(width: 84, height: 84)
                    .clipShape(.rect(cornerRadius: 19, style: .continuous))
                    .shadow(color: Color(red: 0.27, green: 0.31, blue: 1).opacity(0.35), radius: 14, y: 8)
                    .accessibilityHidden(true)
                Text("PST Viewer")
                    .font(.largeTitle.bold())
                    .accessibilityAddTraits(.isHeader)
                Text("Open, search and read mail archives – fast and strictly read-only.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(textAlignment)
            }

            if let failure = model.openFailure {
                OpenFailureBanner(failure: failure)
            }

            OpenCard(alignment: alignment, showsDropHint: sizeClass == .regular)

            Label("Your files are only read and never modified.", systemImage: "lock")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
    }

    private var textAlignment: TextAlignment {
        alignment == .center ? .center : .leading
    }
}

/// The open buttons with the supported formats; on the iPad also a drop target hint.
private struct OpenCard: View {
    let alignment: HorizontalAlignment
    let showsDropHint: Bool
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 14) {
            if showsDropHint {
                Image(systemName: "arrow.down.doc")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                    .frame(width: 48, height: 48)
                    .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 14, style: .continuous))
                    .accessibilityHidden(true)
                Text("Drop a mail file or folder here")
                    .font(.headline)
            }
            Text("Outlook data files (.pst), Outlook items (.msg), emails (.eml) and mailboxes (MBOX, e.g. from Gmail, Apple Mail or Thunderbird).")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            VStack(spacing: 10) { openButtons }
                .padding(.top, 4)

            HStack(spacing: 6) {
                ForEach(["PST", "MSG", "EML", "MBOX"], id: \.self) { format in
                    Text(verbatim: format)
                        .font(.caption2.monospaced().weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 5))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text("Supported formats: PST, MSG, EML, MBOX"))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 22)
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
            if showsDropHint {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .strokeBorder(Color(.separator), style: StrokeStyle(lineWidth: 1.5, dash: [7, 5]))
            }
        }
    }

    @ViewBuilder private var openButtons: some View {
        Button {
            model.importKind = .file
        } label: {
            Label("Open File…", systemImage: "doc")
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
        }
        .modifier(ProminentButtonStyle())

        Button {
            model.importKind = .folder
        } label: {
            Label("Open Folder…", systemImage: "folder")
                .frame(maxWidth: .infinity)
        }
        .modifier(SecondaryButtonStyle())
    }
}

/// Explains why the last archive could not be opened.
private struct OpenFailureBanner: View {
    let failure: AppModel.OpenFailure
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.title3)
                .foregroundStyle(.red)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("The file could not be opened")
                    .font(.subheadline.weight(.semibold))
                Text(failure.message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Text(verbatim: URL(filePath: failure.path).lastPathComponent)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if let recent = failure.missingRecent {
                    Button("Remove from List") {
                        model.recents.remove(recent)
                        model.openFailure = nil
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button("Dismiss", systemImage: "xmark") { model.openFailure = nil }
                .labelStyle(.iconOnly)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .buttonStyle(.borderless)
        }
        .padding(14)
        .background(Color.red.opacity(0.08), in: .rect(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.red.opacity(0.25)))
        .accessibilityElement(children: .contain)
    }
}

/// Glass on iOS 26 and later, bordered before.
struct ProminentButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.buttonStyle(.glassProminent).controlSize(.large)
        } else {
            content.buttonStyle(.borderedProminent).controlSize(.large)
        }
    }
}

struct SecondaryButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.buttonStyle(.glass).controlSize(.large)
        } else {
            content.buttonStyle(.bordered).controlSize(.large)
        }
    }
}
