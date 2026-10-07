import PstViewerCore
import SwiftUI

/// The messages of the selected folder or search, grouped by date, with search,
/// filters and sorting.
struct MessageListView: View {
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        @Bindable var mailbox = mailbox
        content
            .navigationTitle(Text(verbatim: mailbox.listTitle))
            .modifier(ListSubtitle(text: subtitle))
            .modifier(MessageSearch())
            .modifier(FilterChipsInset())
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    SortMenu()
                    Button {
                        mailbox.showsFilters = true
                    } label: {
                        Label("Filters", systemImage: mailbox.activeFilterCount > 0 ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                    }
                    .accessibilityValue(mailbox.activeFilterCount > 0 ? Text("\(mailbox.activeFilterCount) active") : Text(verbatim: ""))
                    // A popover on the iPad (like the desktop's filter panel), a sheet on the iPhone.
                    .popover(isPresented: $mailbox.showsFilters, arrowEdge: .top) {
                        FilterSheet()
                            .environment(mailbox)
                            .frame(idealWidth: 440, idealHeight: 720)
                    }
                }
            }
    }

    @ViewBuilder private var content: some View {
        if let result = mailbox.result, result.total == 0 {
            EmptyListView()
        } else {
            MessageList()
        }
    }

    private var subtitle: String {
        var parts = [mailbox.listSummary]
        if let percent = mailbox.indexPercent {
            parts.append(String(localized: "Full-text index: \(Formatting.percent(percent))"))
        }
        return parts.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

/// The list itself; it starts at the top for every new query.
private struct MessageList: View {
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        @Bindable var mailbox = mailbox
        ScrollViewReader { proxy in
            list
                .onChange(of: mailbox.selectedIndex) {
                    // Keep the selection visible when it moves by keyboard or toolbar.
                    if let index = mailbox.selectedIndex { proxy.scrollTo(index) }
                }
        }
    }

    private var list: some View {
        @Bindable var mailbox = mailbox
        return List(selection: $mailbox.selectedMessageID) {
            if mailbox.isSearch, let percent = mailbox.indexPercent {
                Label("Message contents are still being indexed (\(Formatting.percent(percent))). Matches in message bodies may be missing.", systemImage: "hourglass")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .listRowSeparator(.hidden)
            }
            if #unavailable(iOS 26.0) {
                if !mailbox.listSummary.isEmpty {
                    Text(verbatim: mailbox.listSummary)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                        .listRowSeparator(.hidden)
                }
            }
            if let result = mailbox.result {
                if result.groups.isEmpty {
                    ForEach(0..<result.total, id: \.self, content: row)
                } else {
                    ForEach(Array(result.groups.enumerated()), id: \.offset) { _, group in
                        Section {
                            ForEach(Int(group.start)..<Int(group.start + group.count), id: \.self, content: row)
                        } header: {
                            HStack {
                                Text(verbatim: Formatting.groupTitle(group.group))
                                Spacer()
                                Text(verbatim: Formatting.number(group.count))
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .id(mailbox.result?.signature)
        .overlay {
            if mailbox.result == nil {
                ProgressView()
            }
        }
        .overlay(alignment: .top) {
            if mailbox.isSearching, mailbox.result != nil {
                SearchingIndicator()
            }
        }
    }

    private func row(_ index: Int) -> some View {
        Group {
            if let summary = mailbox.summaries[index] {
                MessageRow(
                    summary: summary,
                    terms: mailbox.highlightTerms,
                    folderName: mailbox.result?.isSearch == true ? mailbox.folder(summary.folderId)?.displayName : nil,
                    showsRecipients: mailbox.folder(summary.folderId)?.showsRecipients == true
                )
                .tag(summary.id)
            } else {
                MessageRow.placeholder
            }
        }
        .onAppear { mailbox.rowAppeared(index) }
        .onDisappear { mailbox.rowDisappeared(index) }
    }
}

/// A small spinner for searches that take a moment (large archives).
private struct SearchingIndicator: View {
    @State private var visible = false

    var body: some View {
        ProgressView()
            .controlSize(.small)
            .padding(8)
            .background(.regularMaterial, in: .circle)
            .padding(.top, 8)
            .opacity(visible ? 1 : 0)
            .task {
                try? await Task.sleep(for: .milliseconds(200))
                visible = true
            }
            .accessibilityLabel(Text("Searching…"))
    }
}

/// The result count as navigation subtitle (iOS 26 and later).
private struct ListSubtitle: ViewModifier {
    let text: String

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.navigationSubtitle(Text(verbatim: text))
        } else {
            content
        }
    }
}

/// Sort field and direction.
private struct SortMenu: View {
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        Menu {
            Picker("Sort", selection: field) {
                ForEach(SortField.allCases, id: \.self) { field in
                    Text(verbatim: field.label).tag(field)
                }
            }
            Picker("Order", selection: direction) {
                Text(mailbox.sort.field == .date ? LocalizedStringKey("Newest first") : LocalizedStringKey("Descending")).tag(SortDir.desc)
                Text(mailbox.sort.field == .date ? LocalizedStringKey("Oldest first") : LocalizedStringKey("Ascending")).tag(SortDir.asc)
            }
        } label: {
            Label("Sort", systemImage: "arrow.up.arrow.down")
        }
        .accessibilityValue(Text(verbatim: mailbox.sort.field.label))
    }

    private var field: Binding<SortField> {
        Binding { mailbox.sort.field } set: { mailbox.sort = SortSpec(field: $0, dir: $0.defaultDirection) }
    }

    private var direction: Binding<SortDir> {
        Binding { mailbox.sort.dir } set: { mailbox.sort.dir = $0 }
    }
}

/// Explains an empty folder or search and offers ways out.
private struct EmptyListView: View {
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        if mailbox.isSearch {
            ContentUnavailableView {
                Label("No results", systemImage: "magnifyingglass")
            } description: {
                Text("Try different search terms or remove some filters.")
            } actions: {
                if mailbox.scope == .folder, mailbox.folderId != nil {
                    Button("Search all folders") { mailbox.scope = .all }
                        .buttonStyle(.borderedProminent)
                }
                if mailbox.activeFilterCount > 0 {
                    Button("Reset Filters") { mailbox.resetFilters() }
                }
                if !mailbox.query.isEmpty {
                    Button("Clear Search") { mailbox.query = "" }
                }
            }
        } else {
            ContentUnavailableView {
                Label("This folder is empty", systemImage: "tray")
            } description: {
                Text("Choose another folder.")
            }
        }
    }
}
