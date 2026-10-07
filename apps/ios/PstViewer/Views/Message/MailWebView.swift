import PstViewerCore
import SwiftUI
import WebKit

/// Shows a sanitised mail document (from `prepareMailDocument` or
/// `prepareTextDocument`) at its full height inside the reading view. Content
/// JavaScript is off, nothing is stored, and the network stays blocked unless
/// the user allowed remote images; links open outside the app.
struct MailWebView: UIViewRepresentable {
    let html: String
    /// Blocks all network loads; nil allows remote images.
    let blocker: WKContentRuleList?
    /// Folded search terms to highlight.
    let terms: [String]
    /// Plain text bodies blend into the reading view; HTML mails sit on paper.
    let isTransparent: Bool
    @Binding var contentHeight: CGFloat

    func makeCoordinator() -> Coordinator {
        Coordinator(contentHeight: $contentHeight)
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: WebContent.configuration(blocking: nil))
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = !isTransparent
        webView.backgroundColor = isTransparent ? .clear : .white
        webView.scrollView.backgroundColor = isTransparent ? .clear : .white
        // The reading view scrolls vertically; the web view only scrolls
        // sideways for mails built wider than the screen.
        let scrollView = webView.scrollView
        scrollView.bounces = false
        scrollView.alwaysBounceVertical = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.isDirectionalLockEnabled = true
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.pinchGestureRecognizer?.isEnabled = false
        context.coordinator.observe(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.contentHeight = $contentHeight
        context.coordinator.show(html, blocker: blocker, terms: terms, in: webView)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.stopObserving()
        webView.stopLoading()
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var contentHeight: Binding<CGFloat>
        private var shownHTML: String?
        private var shownBlocker: WKContentRuleList?
        private var terms: [String] = []
        private var sizeObservation: NSKeyValueObservation?
        private var measuredWidth: CGFloat = 0

        init(contentHeight: Binding<CGFloat>) {
            self.contentHeight = contentHeight
        }

        func show(_ html: String, blocker: WKContentRuleList?, terms: [String], in webView: WKWebView) {
            self.terms = terms
            guard html != shownHTML || blocker !== shownBlocker else { return }
            shownHTML = html
            shownBlocker = blocker
            let controller = webView.configuration.userContentController
            controller.removeAllContentRuleLists()
            if let blocker { controller.add(blocker) }
            webView.loadHTMLString(html, baseURL: nil)
        }

        func observe(_ webView: WKWebView) {
            sizeObservation = webView.scrollView.observe(\.contentSize, options: [.new]) { [weak self, weak webView] _, _ in
                // Not during the layout pass that changed the size.
                Task { @MainActor in
                    guard let self, let webView else { return }
                    self.measure(webView)
                }
            }
        }

        func stopObserving() {
            sizeObservation?.invalidate()
            sizeObservation = nil
        }

        private func measure(_ webView: WKWebView) {
            let width = webView.bounds.width
            guard width > 0 else { return }
            if abs(width - measuredWidth) > 0.5 {
                // A new width can make the document shorter; measure from scratch.
                let firstLayout = measuredWidth == 0
                measuredWidth = width
                if !firstLayout { fitToWidth(webView) }
                if contentHeight.wrappedValue > 1 {
                    contentHeight.wrappedValue = 1
                    return
                }
            }
            let height = ceil(webView.scrollView.contentSize.height)
            if abs(height - contentHeight.wrappedValue) > 0.5 {
                contentHeight.wrappedValue = height
            }
        }

        // MARK: WKNavigationDelegate

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = navigationAction.request.url else { return .cancel }
            // The document itself and jumps to anchors within it.
            if url.scheme == "about" { return .allow }
            if navigationAction.navigationType == .linkActivated, WebContent.isOpenable(url) {
                _ = await UIApplication.shared.open(url)
            }
            return .cancel
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            fitToWidth(webView)
            measure(webView)
            guard !terms.isEmpty else { return }
            webView.callAsyncJavaScript(Self.highlightScript, arguments: ["terms": terms], in: nil, in: .defaultClient) { _ in }
        }

        /// Mails built for a fixed width (newsletters) are scaled down to fit,
        /// like in Mail; others keep their size.
        private func fitToWidth(_ webView: WKWebView) {
            webView.callAsyncJavaScript(Self.fitScript, arguments: [:], in: nil, in: .defaultClient) { [weak self] result in
                // Scaled down, the document is shorter: measure again from scratch.
                guard let self, let width = (try? result.get()) as? Double, width > 0 else { return }
                self.contentHeight.wrappedValue = 1
            }
        }

        /// WebKit may stop the content process under memory pressure; show the document again.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            guard let html = shownHTML else { return }
            webView.loadHTMLString(html, baseURL: nil)
        }

        // MARK: WKUIDelegate

        /// Links get a menu showing the full address instead of a preview that
        /// would load the page; other elements get no menu.
        func webView(_ webView: WKWebView, contextMenuConfigurationFor elementInfo: WKContextMenuElementInfo) async -> UIContextMenuConfiguration? {
            guard let url = elementInfo.linkURL, WebContent.isOpenable(url) else { return nil }
            return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { _ in
                UIMenu(title: url.absoluteString, children: [
                    UIAction(title: String(localized: "Open Link"), image: UIImage(systemName: "arrow.up.forward.app")) { _ in
                        UIApplication.shared.open(url)
                    },
                    UIAction(title: String(localized: "Copy Link"), image: UIImage(systemName: "doc.on.doc")) { _ in
                        UIPasteboard.general.url = url
                    },
                ])
            }
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            nil
        }

        /// Lays the document out at its own width if it is wider than the view;
        /// WebKit then scales it to the view's width. Runs in the app's script world.
        private static let fitScript = """
        const meta = document.querySelector('meta[name="viewport"]');
        if (!meta || !document.body) return 0;
        meta.setAttribute('content', 'width=device-width, initial-scale=1, user-scalable=no');
        const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        if (width <= window.innerWidth + 1) return 0;
        meta.setAttribute('content', 'width=' + width + ', user-scalable=no');
        return width;
        """

        /// Wraps matches of the folded search terms in `<mark>` elements (port of
        /// the desktop's `highlightDocument`). Runs in the app's own script world;
        /// the message's scripts are disabled.
        private static let highlightScript = """
        const fold = (s) => s.toLowerCase().normalize('NFD').replace(/\\p{M}/gu, '').replace(/ß/g, 'ss');
        const findMatches = (text) => {
          let folded = '';
          const map = [];
          for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            const pair = code >= 0xd800 && code <= 0xdbff && i + 1 < text.length;
            const ch = pair ? text.slice(i, i + 2) : text[i];
            const f = fold(ch);
            for (let j = 0; j < f.length; j++) map.push(i);
            folded += f;
            if (pair) i++;
          }
          const ranges = [];
          for (const term of terms) {
            if (!term) continue;
            let from = 0;
            for (;;) {
              const index = folded.indexOf(term, from);
              if (index === -1) break;
              const last = map[index + term.length - 1];
              const lastCode = text.charCodeAt(last);
              ranges.push([map[index], last + (lastCode >= 0xd800 && lastCode <= 0xdbff ? 2 : 1)]);
              from = index + Math.max(term.length, 1);
            }
          }
          ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
          const merged = [];
          for (const range of ranges) {
            const top = merged[merged.length - 1];
            if (top && range[0] <= top[1]) top[1] = Math.max(top[1], range[1]);
            else merged.push(range);
          }
          return merged;
        };
        if (!document.body) return 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent || parent.closest('style, title, mark')) return NodeFilter.FILTER_REJECT;
            return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        let count = 0;
        for (const node of nodes) {
          const text = node.nodeValue;
          const ranges = findMatches(text);
          if (ranges.length === 0) continue;
          const fragment = document.createDocumentFragment();
          let last = 0;
          for (const [start, end] of ranges) {
            if (start > last) fragment.appendChild(document.createTextNode(text.slice(last, start)));
            const mark = document.createElement('mark');
            mark.className = 'pst-hl';
            mark.textContent = text.slice(start, end);
            fragment.appendChild(mark);
            last = end;
            count++;
          }
          if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)));
          node.parentNode.replaceChild(fragment, node);
        }
        return count;
        """
    }
}

/// Styles added to mail documents: system fonts with Dynamic Type, highlight
/// colours and, for plain text, the colours of the reading view.
nonisolated enum MailStyle {
    static func css(forText isText: Bool) -> String {
        var css = """
        body { font: -apple-system-body; line-height: 1.5; padding: 16px; }
        mark.pst-hl { background: #ffe168; color: #1d1d1f; border-radius: 2px; box-shadow: 0 0 0 1px #ffe168; }
        """
        if isText {
            css += """
            html, body { background: transparent; }
            body { color: #1d1d1f; padding: 4px 20px 24px; }
            a { color: #4a5cff; }
            @media (prefers-color-scheme: dark) {
              body { color: #f5f5f7; }
              a { color: #7d8eff; }
              mark.pst-hl { background: #b8901a; color: #fff; box-shadow: 0 0 0 1px #b8901a; }
            }
            """
        }
        return css
    }
}
