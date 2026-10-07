import PstViewerCore
import SwiftUI

/// All search filters of the desktop app's filter panel; changes apply right away.
struct FilterSheet: View {
    @Environment(MailboxModel.self) private var mailbox
    @Environment(\.dismiss) private var dismiss

    private static let sizes: [(bytes: Int64?, label: String)] = [
        (nil, String(localized: "Any")),
        (100 * 1024, "≥ 100 KB"),
        (1024 * 1024, "≥ 1 MB"),
        (10 * 1024 * 1024, "≥ 10 MB"),
    ]

    var body: some View {
        @Bindable var mailbox = mailbox
        NavigationStack {
            Form {
                Section("Search in") {
                    FlowLayout(spacing: 8, lineSpacing: 8) {
                        ForEach(SearchField.allCases, id: \.self) { field in
                            Toggle(field.label, isOn: fieldBinding(field))
                        }
                    }
                    .toggleStyle(.button)
                    .padding(.vertical, 4)
                }

                Section {
                    Picker("Date Range", selection: $mailbox.filters.datePreset) {
                        ForEach(DatePreset.allCases, id: \.self) { preset in
                            Text(verbatim: preset.label).tag(preset)
                        }
                    }
                    if mailbox.filters.datePreset == .custom {
                        DatePicker(selection: dateBinding(\.customFrom), in: ...(mailbox.filters.customTo ?? .distantFuture), displayedComponents: .date) {
                            Text("From")
                        }
                        DatePicker(selection: dateBinding(\.customTo), in: (mailbox.filters.customFrom ?? .distantPast)..., displayedComponents: .date) {
                            Text("Until")
                        }
                    }
                }

                Section("People") {
                    PersonField(placeholder: String(localized: "Sender (name or address)"), value: $mailbox.filters.from, suggestsSenders: true)
                    PersonField(placeholder: String(localized: "Recipient (name or address)"), value: $mailbox.filters.to, suggestsSenders: false)
                }

                Section("Status") {
                    Picker("Read state", selection: $mailbox.filters.readState) {
                        ForEach(ReadState.allCases, id: \.self) { state in
                            Text(verbatim: state.label).tag(state)
                        }
                    }
                    .pickerStyle(.segmented)
                    Toggle(isOn: $mailbox.filters.hasAttachments) {
                        Label("Has attachments", systemImage: "paperclip")
                    }
                    Toggle(isOn: $mailbox.filters.important) {
                        Label("Important", systemImage: "exclamationmark.triangle")
                    }
                    Toggle(isOn: $mailbox.filters.flagged) {
                        Label("Flagged", systemImage: "flag")
                    }
                }

                Section("Attachment type") {
                    FlowLayout(spacing: 8, lineSpacing: 8) {
                        ForEach(AttachmentType.allCases, id: \.self) { type in
                            Toggle(type.label, isOn: attachmentTypeBinding(type))
                        }
                    }
                    .toggleStyle(.button)
                    .padding(.vertical, 4)
                }

                Section("Item type") {
                    FlowLayout(spacing: 8, lineSpacing: 8) {
                        ForEach(ItemKind.filterable, id: \.self) { kind in
                            Toggle(kind.pluralLabel, isOn: kindBinding(kind))
                        }
                    }
                    .toggleStyle(.button)
                    .padding(.vertical, 4)
                }

                Section("Minimum size") {
                    Picker("Minimum size", selection: $mailbox.filters.minSize) {
                        ForEach(Self.sizes, id: \.bytes) { size in
                            Text(verbatim: size.label).tag(size.bytes)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    NavigationLink {
                        SearchSyntaxView()
                    } label: {
                        Label("Search Syntax", systemImage: "questionmark.circle")
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reset") { mailbox.resetFilters() }
                        .disabled(mailbox.activeFilterCount == 0)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                }
            }
        }
        .presentationDetents([.large, .medium])
        .presentationContentInteraction(.scrolls)
    }

    /// Search fields: none selected means all, like on the desktop.
    private func fieldBinding(_ field: SearchField) -> Binding<Bool> {
        Binding {
            mailbox.filters.fields.isEmpty || mailbox.filters.fields.contains(field)
        } set: { _ in
            var fields = mailbox.filters.fields.isEmpty ? SearchField.allCases : mailbox.filters.fields
            if let index = fields.firstIndex(of: field) {
                fields.remove(at: index)
            } else {
                fields.append(field)
            }
            mailbox.filters.fields = fields.isEmpty || fields.count == SearchField.allCases.count ? [] : fields
        }
    }

    private func attachmentTypeBinding(_ type: AttachmentType) -> Binding<Bool> {
        Binding {
            mailbox.filters.attachmentType == type
        } set: { selected in
            mailbox.filters.attachmentType = selected ? type : nil
        }
    }

    private func kindBinding(_ kind: ItemKind) -> Binding<Bool> {
        Binding {
            mailbox.filters.kinds.contains(kind)
        } set: { selected in
            if selected {
                mailbox.filters.kinds.append(kind)
            } else {
                mailbox.filters.kinds.removeAll { $0 == kind }
            }
        }
    }

    private func dateBinding(_ keyPath: WritableKeyPath<SearchFilters, Date?>) -> Binding<Date> {
        Binding {
            mailbox.filters[keyPath: keyPath] ?? .now
        } set: { date in
            mailbox.filters[keyPath: keyPath] = date
        }
    }
}

/// A sender or recipient filter; typing is debounced before it searches.
private struct PersonField: View {
    let placeholder: String
    @Binding var value: String
    let suggestsSenders: Bool

    @Environment(MailboxModel.self) private var mailbox
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        TextField(placeholder, text: $text)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(.emailAddress)
            .submitLabel(.done)
            .focused($focused)
            .onAppear { text = value }
            .onChange(of: value) { if value != text { text = value } }
            .task(id: text) {
                guard text != value else { return }
                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled else { return }
                value = text
            }
        if suggestsSenders, focused, !text.isEmpty {
            let needle = foldForIndex(text: text)
            ForEach(mailbox.senders(matching: needle, limit: 4), id: \.self) { sender in
                let key = sender.email.isEmpty ? sender.name : sender.email
                if key != text {
                    Button {
                        text = key
                        value = key
                        focused = false
                    } label: {
                        Label {
                            VStack(alignment: .leading) {
                                Text(verbatim: sender.name.isEmpty ? sender.email : sender.name)
                                    .foregroundStyle(.primary)
                                if !sender.name.isEmpty {
                                    Text(verbatim: sender.email)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        } icon: {
                            Image(systemName: "at")
                        }
                    }
                }
            }
        }
    }
}
