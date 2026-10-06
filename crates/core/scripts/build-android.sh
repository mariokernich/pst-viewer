#!/bin/sh
# Builds the core for Android (arm64-v8a, armeabi-v7a, x86_64) into the app's
# jniLibs and generates the Kotlin bindings.
#
#   crates/core/scripts/build-android.sh            release build
#   PROFILE=dev crates/core/scripts/build-android.sh debug build (faster)
#
# Needs the Android NDK (ANDROID_NDK_HOME, default: newest in the SDK) and
# cargo-ndk (`cargo install cargo-ndk`).
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROFILE="${PROFILE:-release}"
DIR=$([ "$PROFILE" = "dev" ] && echo debug || echo "$PROFILE")
APP="$ROOT/apps/android/app"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
export PATH="$HOME/.cargo/bin:$PATH"
if [ -z "${ANDROID_NDK_HOME:-}" ]; then
  ANDROID_NDK_HOME="$(ls -d "$SDK"/ndk/* 2>/dev/null | sort -V | tail -1)"
fi
export ANDROID_NDK_HOME
# 16 KB pages (Android 15+ devices).
export RUSTFLAGS="${RUSTFLAGS:-} -C link-arg=-Wl,-z,max-page-size=16384"

cd "$ROOT"
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 --platform 26 -o "$APP/src/main/jniLibs" \
  build -p pst-viewer-core --lib --profile "$PROFILE"

# Kotlin bindings from the host build of the same sources.
unset RUSTFLAGS
cargo build -p pst-viewer-core --lib --profile "$PROFILE"
LIB="target/$DIR/libpst_viewer_core.dylib"
[ -f "$LIB" ] || LIB="target/$DIR/libpst_viewer_core.so"
rm -rf "$APP/src/generated/kotlin" && mkdir -p "$APP/src/generated/kotlin"
cargo run -q -p uniffi-bindgen -- generate --library "$LIB" --language kotlin --no-format --out-dir "$APP/src/generated/kotlin"
echo "Built $APP/src/main/jniLibs ($PROFILE)"
