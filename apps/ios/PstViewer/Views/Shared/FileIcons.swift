import SwiftUI

/// A document icon labelled with the archive type, or a folder (as on the desktop).
struct ArchiveIcon: View {
    let name: String
    let isFolder: Bool
    var scale: CGFloat = 1

    var body: some View {
        Group {
            if isFolder {
                Image(systemName: "folder.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(.tint)
                    .padding(.horizontal, 2 * scale)
            } else {
                ZStack(alignment: .bottom) {
                    DocumentShape()
                        .fill(Color(.secondarySystemGroupedBackground))
                        .overlay(DocumentShape().stroke(Color(.separator), lineWidth: 1))
                        .overlay(alignment: .topTrailing) {
                            FoldShape()
                                .stroke(Color(.separator), lineWidth: 1)
                                .frame(width: 13 * scale, height: 13 * scale)
                        }
                    Text(label)
                        .font(.system(size: (label.count > 3 ? 7.5 : 8.5) * scale, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 32 * scale, height: 13 * scale)
                        .background(color, in: .rect(cornerRadius: 4 * scale))
                        .padding(.bottom, 9 * scale)
                }
            }
        }
        .frame(width: 36 * scale, height: 44 * scale)
        .accessibilityHidden(true)
    }

    private var label: String {
        switch URL(filePath: name).pathExtension.lowercased() {
        case "pst": "PST"
        case "ost": "OST"
        case "msg": "MSG"
        case "eml", "emlx": "EML"
        case "mbox", "mbx": "MBOX"
        default: "MAIL"
        }
    }

    private var color: Color {
        switch label {
        case "PST", "OST": Color(red: 0.290, green: 0.392, blue: 1)
        case "MSG": Color(red: 0.039, green: 0.518, blue: 1)
        case "EML": Color(red: 0.122, green: 0.616, blue: 0.333)
        case "MBOX": Color(red: 0.557, green: 0.306, blue: 0.776)
        default: Color(red: 0.420, green: 0.447, blue: 0.502)
        }
    }
}

/// The outline of a page with a folded corner.
private nonisolated struct DocumentShape: Shape {
    func path(in rect: CGRect) -> Path {
        let x = rect.width / 40
        let y = rect.height / 48
        var path = Path()
        path.move(to: CGPoint(x: 6 * x, y: 1 * y))
        path.addLine(to: CGPoint(x: 26 * x, y: 1 * y))
        path.addLine(to: CGPoint(x: 39 * x, y: 14 * y))
        path.addLine(to: CGPoint(x: 39 * x, y: 42 * y))
        path.addQuadCurve(to: CGPoint(x: 34 * x, y: 47 * y), control: CGPoint(x: 39 * x, y: 47 * y))
        path.addLine(to: CGPoint(x: 6 * x, y: 47 * y))
        path.addQuadCurve(to: CGPoint(x: 1 * x, y: 42 * y), control: CGPoint(x: 1 * x, y: 47 * y))
        path.addLine(to: CGPoint(x: 1 * x, y: 6 * y))
        path.addQuadCurve(to: CGPoint(x: 6 * x, y: 1 * y), control: CGPoint(x: 1 * x, y: 1 * y))
        path.closeSubpath()
        return path
    }
}

private nonisolated struct FoldShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: 0, y: 0))
        path.addLine(to: CGPoint(x: 0, y: rect.height * 0.7))
        path.addQuadCurve(to: CGPoint(x: rect.width * 0.3, y: rect.height), control: CGPoint(x: 0, y: rect.height))
        path.addLine(to: CGPoint(x: rect.width, y: rect.height))
        return path
    }
}

/// A coloured badge with the file extension of an attachment (as on the desktop).
struct FileBadge: View {
    let name: String
    var isMessage = false
    var size: CGFloat = 1

    private static let types: [(extensions: Set<String>, color: Color, label: String)] = [
        (["pdf"], Color(red: 0.898, green: 0.282, blue: 0.302), "PDF"),
        (["doc", "docx", "docm", "dot", "dotx", "odt", "rtf", "pages"], Color(red: 0.184, green: 0.435, blue: 0.894), "DOC"),
        (["xls", "xlsx", "xlsm", "xlsb", "csv", "ods", "numbers"], Color(red: 0.122, green: 0.616, blue: 0.333), "XLS"),
        (["ppt", "pptx", "pptm", "pps", "ppsx", "odp", "key"], Color(red: 0.910, green: 0.349, blue: 0.047), "PPT"),
        (["png", "jpg", "jpeg", "gif", "bmp", "tif", "tiff", "webp", "heic", "svg"], Color(red: 0.557, green: 0.306, blue: 0.776), "IMG"),
        (["zip", "rar", "7z", "gz", "tgz", "tar", "bz2"], Color(red: 0.604, green: 0.420, blue: 0.184), "ZIP"),
        (["ics", "vcs"], Color(red: 0.839, green: 0.251, blue: 0.624), "ICS"),
        (["vcf"], Color(red: 0.059, green: 0.616, blue: 0.604), "VCF"),
        (["txt", "log", "md"], Color(red: 0.420, green: 0.447, blue: 0.502), "TXT"),
        (["eml", "msg"], Color(red: 0.039, green: 0.518, blue: 1), "MAIL"),
    ]

    var body: some View {
        Group {
            if isMessage {
                Image(systemName: "envelope")
                    .font(.system(size: 15 * size, weight: .semibold))
                    .foregroundStyle(.tint)
                    .frame(width: 32 * size, height: 36 * size)
                    .background(Color.accentColor.opacity(0.12), in: .rect(cornerRadius: 7 * size))
            } else {
                let style = self.style
                Text(style.label)
                    .font(.system(size: 8.5 * size, weight: .bold))
                    .tracking(0.3)
                    .foregroundStyle(style.color)
                    .padding(.bottom, 4 * size)
                    .frame(width: 32 * size, height: 36 * size, alignment: .bottom)
                    .background(style.color.opacity(0.12), in: .rect(cornerRadius: 7 * size))
                    .overlay(alignment: .topTrailing) {
                        UnevenRoundedRectangle(bottomLeadingRadius: 4 * size, topTrailingRadius: 7 * size)
                            .fill(style.color.opacity(0.33))
                            .frame(width: 10 * size, height: 10 * size)
                    }
            }
        }
        .accessibilityHidden(true)
    }

    private var style: (color: Color, label: String) {
        let ext = URL(filePath: name).pathExtension.lowercased()
        if let match = Self.types.first(where: { $0.extensions.contains(ext) }) {
            return (match.color, match.label)
        }
        let label = ext.isEmpty || ext.count > 4 ? "FILE" : ext.uppercased()
        return (Color(red: 0.557, green: 0.557, blue: 0.576), label)
    }
}
