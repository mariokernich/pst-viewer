// swift-tools-version: 6.0
// The shared Rust core (crates/core) as Swift package. The XCFramework and the
// generated bindings are created by crates/core/scripts/build-ios.sh.
import PackageDescription

let package = Package(
    name: "PstViewerCore",
    platforms: [.iOS(.v17)],
    products: [.library(name: "PstViewerCore", targets: ["PstViewerCore"])],
    targets: [
        .binaryTarget(name: "PstViewerCoreFFI", path: "PstViewerCoreFFI.xcframework"),
        .target(name: "PstViewerCore", dependencies: ["PstViewerCoreFFI"], path: "Sources/PstViewerCore"),
    ],
    swiftLanguageModes: [.v5]
)
