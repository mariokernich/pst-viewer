import PstViewerCore
import SwiftUI

/// Search as you type with scopes and suggestions (port of the desktop's search box).
struct MessageSearch: ViewModifier {
    @Environment(MailboxModel.self) private var mailbox

    func body(content: Content) -> some View {
        @Bindable var mailbox = mailbox
        scoped(content.searchable(text: $mailbox.query, prompt: Text(verbatim: prompt)))
            .searchSuggestions {
                ForEach(groupedSuggestions, id: \.section) { group in
                    Section {
                        ForEach(group.suggestions) { suggestion in
                            Button {
                                mailbox.apply(suggestion)
                                endEditing()
                            } label: {
                                SuggestionLabel(suggestion: suggestion)
                            }
                            .tint(.primary)
                        }
                    } header: {
                        Text(verbatim: group.section.title)
                    }
                }
            }
            .onSubmit(of: .search) {
                mailbox.commitQuery()
                mailbox.runSearch()
            }
            .modifier(SearchFocus(request: mailbox.searchFocusRequest))
    }

    /// While a folder is selected, the search can be limited to it.
    @ViewBuilder private func scoped(_ content: some View) -> some View {
        @Bindable var mailbox = mailbox
        if let folder = mailbox.selectedFolder {
            content.searchScopes($mailbox.scope, activation: .onSearchPresentation) {
                Text("All Folders").tag(SearchScope.all)
                Text(verbatim: folder.displayName).tag(SearchScope.folder)
            }
        } else {
            content
        }
    }

    private var prompt: String {
        if let folder = mailbox.selectedFolder {
            return String(localized: "Search in “\(folder.displayName)”")
        }
        return String(localized: "Search")
    }

    private var groupedSuggestions: [(section: SearchSuggestion.Section, suggestions: [SearchSuggestion])] {
        let suggestions = mailbox.suggestions()
        return SearchSuggestion.Section.allCases.compactMap { section in
            let rows = suggestions.filter { $0.section == section }
            return rows.isEmpty ? nil : (section, rows)
        }
    }

    /// Hides the keyboard and with it the suggestions; the search stays active.
    private func endEditing() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

private struct SuggestionLabel: View {
    let suggestion: SearchSuggestion

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: suggestion.symbol)
                .foregroundStyle(.secondary)
                .frame(width: 22)
            Text(verbatim: suggestion.title)
                .foregroundStyle(.primary)
                .lineLimit(1)
            Spacer(minLength: 8)
            if let detail = suggestion.detail {
                Text(verbatim: detail)
                    .font(suggestion.section == .searchIn ? .footnote.monospaced() : .footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Moves the focus into the search field on ⌘F (iOS 18 and later).
private struct SearchFocus: ViewModifier {
    let request: Int
    @FocusState private var focused: Bool

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content
                .searchFocused($focused)
                .onChange(of: request) { focused = true }
        } else {
            content
        }
    }
}

/// Removable chips for the active filters.
struct FilterChipsBar: View {
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        let chips = mailbox.filters.chips
        if !chips.isEmpty {
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(chips) { chip in
                        FilterChipView(chip: chip)
                    }
                    if chips.count > 1 {
                        Button("Reset all") { mailbox.resetFilters() }
                            .font(.subheadline.weight(.medium))
                            .padding(.horizontal, 6)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .scrollIndicators(.hidden)
        }
    }
}

private struct FilterChipView: View {
    let chip: FilterChip
    @Environment(MailboxModel.self) private var mailbox

    var body: some View {
        HStack(spacing: 2) {
            Button {
                mailbox.showsFilters = true
            } label: {
                HStack(spacing: 4) {
                    if let symbol = chip.symbol {
                        Image(systemName: symbol).imageScale(.small)
                    }
                    Text(verbatim: chip.label)
                        .lineLimit(1)
                }
                .padding(.leading, 10)
                .padding(.vertical, 6)
            }
            Button {
                chip.reset(&mailbox.filters)
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .padding(.trailing, 10)
                    .padding(.leading, 4)
                    .padding(.vertical, 8)
            }
            .accessibilityLabel(Text("Remove filter \(chip.label)"))
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.tint)
        .background(Color.accentColor.opacity(0.14), in: .capsule)
        .buttonStyle(.plain)
    }
}

/// Shows the filter chips above the list; on iOS 26 and later as a bar that
/// takes part in the scroll edge effect.
struct FilterChipsInset: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.safeAreaBar(edge: .top) { FilterChipsBar() }
        } else {
            content.safeAreaInset(edge: .top, spacing: 0) {
                FilterChipsBar().background(.bar)
            }
        }
    }
}
