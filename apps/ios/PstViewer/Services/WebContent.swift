import UIKit
import WebKit

/// Locked-down web views for mail content: no JavaScript from the content, no
/// persistent storage and no network access unless remote images were allowed.
enum WebContent {
    private static var remoteBlocker: WKContentRuleList?

    /// Blocks every network load. WebKit content rules have no alternation,
    /// so each scheme gets its own rule.
    private static let blockerRules = """
    [
      {"trigger": {"url-filter": "^https?:"}, "action": {"type": "block"}},
      {"trigger": {"url-filter": "^wss?:"}, "action": {"type": "block"}},
      {"trigger": {"url-filter": "^ftps?:"}, "action": {"type": "block"}}
    ]
    """

    /// The compiled rule list that blocks remote content.
    static func networkBlocker() async throws -> WKContentRuleList {
        if let remoteBlocker { return remoteBlocker }
        let store: WKContentRuleListStore = WKContentRuleListStore.default()
        let list: WKContentRuleList = try await withCheckedThrowingContinuation { continuation in
            store.compileContentRuleList(forIdentifier: "BlockRemoteContent", encodedContentRuleList: blockerRules) { list, error in
                if let list {
                    continuation.resume(returning: list)
                } else {
                    continuation.resume(throwing: error ?? CocoaError(.featureUnsupported))
                }
            }
        }
        remoteBlocker = list
        return list
    }

    /// A configuration for showing or printing sanitised mail documents.
    static func configuration(blocking blocker: WKContentRuleList?) -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.dataDetectorTypes = []
        configuration.allowsInlineMediaPlayback = false
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.allowsPictureInPictureMediaPlayback = false
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        if let blocker {
            configuration.userContentController.add(blocker)
        }
        return configuration
    }

    /// Schemes that may be opened from a link in a message.
    static func isOpenable(_ url: URL) -> Bool {
        ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "")
    }
}
