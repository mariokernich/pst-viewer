import UIKit
import WebKit

/// Renders print documents (from `buildPrintDocument`) to paginated PDF with
/// the subject and page numbers in the footer, like the desktop app.
final class DocumentRenderer: NSObject, WKNavigationDelegate {
    enum RenderError: Error {
        case loadFailed
    }

    private var loaded: CheckedContinuation<Void, Error>?

    /// Renders `html` into a PDF on A4 paper (Letter in the Americas).
    static func pdf(html: String, allowRemote: Bool, footer: String) async throws -> Data {
        let blocker = allowRemote ? nil : try await WebContent.networkBlocker()
        let renderer = DocumentRenderer()
        let webView = WKWebView(frame: CGRect(origin: .zero, size: Paper.current.size), configuration: WebContent.configuration(blocking: blocker))
        webView.navigationDelegate = renderer
        try await renderer.load(html, in: webView)
        return renderer.draw(webView, footer: footer)
    }

    /// Prints a document through the system print dialog.
    static func print(html: String, allowRemote: Bool, jobName: String) async throws {
        let data = try await pdf(html: html, allowRemote: allowRemote, footer: jobName)
        let info = UIPrintInfo.printInfo()
        info.outputType = .general
        info.jobName = jobName
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printingItem = data
        controller.present(animated: true)
    }

    private func load(_ html: String, in webView: WKWebView) async throws {
        try await withCheckedThrowingContinuation { continuation in
            loaded = continuation
            webView.loadHTMLString(html, baseURL: nil)
        }
    }

    private func finishLoading(_ error: Error?) {
        guard let loaded else { return }
        self.loaded = nil
        if let error {
            loaded.resume(throwing: error)
        } else {
            loaded.resume()
        }
    }

    private func draw(_ webView: WKWebView, footer: String) -> Data {
        let paper = Paper.current
        let renderer = PageRenderer(paper: paper, footer: footer)
        renderer.addPrintFormatter(webView.viewPrintFormatter(), startingAtPageAt: 0)
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [kCGPDFContextTitle as String: footer, kCGPDFContextCreator as String: "PST Viewer"]
        let bounds = CGRect(origin: .zero, size: paper.size)
        return UIGraphicsPDFRenderer(bounds: bounds, format: format).pdfData { context in
            let pages = renderer.numberOfPages
            renderer.prepare(forDrawingPages: NSRange(location: 0, length: pages))
            for page in 0..<pages {
                context.beginPage()
                renderer.drawPage(at: page, in: context.pdfContextBounds)
            }
        }
    }

    // MARK: WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        // Only the document itself is loaded; links never navigate.
        navigationAction.request.url?.absoluteString == "about:blank" ? .allow : .cancel
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        finishLoading(nil)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finishLoading(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finishLoading(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        finishLoading(RenderError.loadFailed)
    }
}

/// Paper size and margins of exported documents.
nonisolated struct Paper {
    let size: CGSize

    /// A4, or Letter in regions that use it (as in the desktop app).
    static var current: Paper {
        let letterRegions: Set<String> = ["US", "CA", "MX", "PH", "CL", "CO", "VE"]
        let region = Locale.current.region?.identifier ?? ""
        return Paper(size: letterRegions.contains(region) ? CGSize(width: 612, height: 792) : CGSize(width: 595.28, height: 841.89))
    }

    /// 0.55 inch at the top and the sides; the footer sits in the bottom margin.
    static let margins = UIEdgeInsets(top: 39.6, left: 39.6, bottom: 20, right: 39.6)
    static let footerHeight: CGFloat = 26.8
}

/// Lays out the print formatter on pages and draws the footer.
private nonisolated final class PageRenderer: UIPrintPageRenderer {
    private let paper: Paper
    private let footer: String

    init(paper: Paper, footer: String) {
        self.paper = paper
        self.footer = footer
        super.init()
        footerHeight = Paper.footerHeight
    }

    override var paperRect: CGRect {
        CGRect(origin: .zero, size: paper.size)
    }

    override var printableRect: CGRect {
        paperRect.inset(by: Paper.margins)
    }

    /// Subject on the left and "page / pages" on the right, centred in the
    /// bottom margin between the side margins.
    override func drawFooterForPage(at pageIndex: Int, in footerRect: CGRect) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 7.5),
            .foregroundColor: UIColor(red: 0.557, green: 0.557, blue: 0.576, alpha: 1),
        ]
        let pageNumber = NSAttributedString(string: "\(pageIndex + 1) / \(numberOfPages)", attributes: attributes)
        let numberSize = pageNumber.size()
        let margin = Paper.margins.bottom + Paper.footerHeight
        let top = paperRect.maxY - margin / 2 - numberSize.height / 2
        let left = paperRect.minX + Paper.margins.left
        let right = paperRect.maxX - Paper.margins.right
        pageNumber.draw(at: CGPoint(x: right - numberSize.width, y: top))

        let paragraph = NSMutableParagraphStyle()
        paragraph.lineBreakMode = .byTruncatingTail
        var titleAttributes = attributes
        titleAttributes[.paragraphStyle] = paragraph
        let titleWidth = max(0, right - left - numberSize.width - 24)
        NSAttributedString(string: footer, attributes: titleAttributes)
            .draw(in: CGRect(x: left, y: top, width: titleWidth, height: numberSize.height))
    }
}
