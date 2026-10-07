import PstViewerCore
import SwiftUI

/// Folders, message list and reading view: three columns on the iPad, a
/// navigation stack on the iPhone.
struct MailboxView: View {
    @Bindable var mailbox: MailboxModel
    @State private var columnVisibility = MailboxView.initialColumns
    @State private var preferredCompactColumn = MailboxView.initialCompactColumn

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility, preferredCompactColumn: $preferredCompactColumn) {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 220, ideal: 270, max: 360)
        } content: {
            MessageListView()
                .navigationSplitViewColumnWidth(min: 300, ideal: 360, max: 480)
        } detail: {
            ReaderView()
        }
        .environment(mailbox)
        .focusedSceneValue(\.mailbox, mailbox)
        .sheet(item: $mailbox.presentedHeaders) { headers in
            HeadersView(headers: headers)
        }
        .sheet(item: $mailbox.attachmentPreview) { preview in
            AttachmentPreviewView(model: preview)
                .environment(mailbox)
        }
        .sheet(isPresented: $mailbox.showsSearchSyntax) {
            SearchSyntaxView()
                .environment(mailbox)
        }
        #if DEBUG
        .modifier(DemoColumns(visibility: $columnVisibility))
        #endif
    }
}

extension MailboxView {
    /// The iPhone starts in the message list of the first folder.
    private static var initialCompactColumn: NavigationSplitViewColumn {
        #if DEBUG
        if DemoDriver.startsWithSidebar { return .sidebar }
        #endif
        return .content
    }

    private static var initialColumns: NavigationSplitViewVisibility {
        #if DEBUG
        if DemoDriver.showsAllColumns { return .all }
        #endif
        return .automatic
    }
}

#if DEBUG
/// Shows all three columns side by side for screenshots (`-demoColumns all`).
private struct DemoColumns: ViewModifier {
    @Binding var visibility: NavigationSplitViewVisibility

    func body(content: Content) -> some View {
        if DemoDriver.showsAllColumns {
            content.navigationSplitViewStyle(.balanced)
        } else {
            content
        }
    }
}
#endif
