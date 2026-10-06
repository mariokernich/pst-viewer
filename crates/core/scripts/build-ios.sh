#!/bin/sh
# Builds the core for iOS devices and simulators as XCFramework and generates
# the Swift bindings into the app's local Swift package.
#
#   crates/core/scripts/build-ios.sh            release build
#   PROFILE=dev crates/core/scripts/build-ios.sh debug build (faster)
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROFILE="${PROFILE:-release}"
DIR=$([ "$PROFILE" = "dev" ] && echo debug || echo "$PROFILE")
IOS="$ROOT/apps/ios"
OUT="$ROOT/target/apple"
export PATH="$HOME/.cargo/bin:$PATH"
# Match the app's deployment target.
export IPHONEOS_DEPLOYMENT_TARGET=17.0

cd "$ROOT"
for target in aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios; do
  cargo build -p pst-viewer-core --lib --profile "$PROFILE" --target "$target"
done

# Swift bindings from the host build of the same sources.
cargo build -p pst-viewer-core --lib --profile "$PROFILE"
rm -rf "$OUT/bindings" && mkdir -p "$OUT/bindings"
cargo run -q -p uniffi-bindgen -- generate --library "target/$DIR/libpst_viewer_core.dylib" --language swift --out-dir "$OUT/bindings"

# Headers with a module map for the binary target.
rm -rf "$OUT/headers" && mkdir -p "$OUT/headers"
cp "$OUT/bindings/PstViewerCoreFFI.h" "$OUT/headers/"
cp "$OUT/bindings/PstViewerCoreFFI.modulemap" "$OUT/headers/module.modulemap"

# One static library for both simulator architectures.
mkdir -p "$OUT/sim"
lipo -create "target/aarch64-apple-ios-sim/$DIR/libpst_viewer_core.a" "target/x86_64-apple-ios/$DIR/libpst_viewer_core.a" -output "$OUT/sim/libpst_viewer_core.a"

rm -rf "$IOS/PstViewerCore/PstViewerCoreFFI.xcframework"
xcodebuild -create-xcframework \
  -library "target/aarch64-apple-ios/$DIR/libpst_viewer_core.a" -headers "$OUT/headers" \
  -library "$OUT/sim/libpst_viewer_core.a" -headers "$OUT/headers" \
  -output "$IOS/PstViewerCore/PstViewerCoreFFI.xcframework" >/dev/null

mkdir -p "$IOS/PstViewerCore/Sources/PstViewerCore"
cp "$OUT/bindings/PstViewerCore.swift" "$IOS/PstViewerCore/Sources/PstViewerCore/PstViewerCore.swift"
echo "Built $IOS/PstViewerCore/PstViewerCoreFFI.xcframework ($PROFILE)"
