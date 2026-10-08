#!/bin/sh
# Builds the iPhone/iPad app or the Mac App Store package, signs it and uploads
# it to App Store Connect (TestFlight). Submitting for review stays manual.
#
#   tools/app-store/upload.sh ios|mac
#
# Environment:
#   ASC_KEY_ID, ASC_ISSUER_ID  App Store Connect API key; the key file must be
#                              ~/.appstoreconnect/private_keys/AuthKey_<id>.p8
#   BUILD_NUMBER               build number, must grow with every upload
#   APPLE_TEAM_ID              default 34JNW2E282
#   IOS_PROFILE_NAME           iOS App Store profile to sign with (manual
#                              signing, as on CI); unset: Xcode automatic signing
#
# Signing identities ("Apple Distribution", "3rd Party Mac Developer
# Installer") must be in a keychain of the search list, and for the Mac the
# profile in apps/desktop/build/embedded.provisionprofile. See docs/release.md.
set -eu

PLATFORM="${1:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEAM="${APPLE_TEAM_ID:-34JNW2E282}"
: "${ASC_KEY_ID:?Set ASC_KEY_ID}" "${ASC_ISSUER_ID:?Set ASC_ISSUER_ID}" "${BUILD_NUMBER:?Set BUILD_NUMBER}"
VERSION="$(node -p "require('$ROOT/apps/desktop/package.json').version")"
OUT="${RUNNER_TEMP:-$ROOT/apps/ios/build}/app-store"
mkdir -p "$OUT"

case "$PLATFORM" in
ios)
  "$ROOT/crates/core/scripts/build-ios.sh"
  if [ -n "${IOS_PROFILE_NAME:-}" ]; then
    set -- CODE_SIGN_STYLE=Manual "CODE_SIGN_IDENTITY=Apple Distribution" "PROVISIONING_PROFILE_SPECIFIER=$IOS_PROFILE_NAME"
    SIGNING="<key>signingStyle</key><string>manual</string>
	<key>signingCertificate</key><string>Apple Distribution</string>
	<key>provisioningProfiles</key><dict><key>de.kernich.pstviewer</key><string>$IOS_PROFILE_NAME</string></dict>"
  else
    set -- -allowProvisioningUpdates
    SIGNING="<key>signingStyle</key><string>automatic</string>"
  fi
  xcodebuild archive -quiet -project "$ROOT/apps/ios/PstViewer.xcodeproj" -scheme PstViewer -configuration Release \
    -destination 'generic/platform=iOS' -archivePath "$OUT/PstViewer.xcarchive" \
    DEVELOPMENT_TEAM="$TEAM" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" "$@"
  cat > "$OUT/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key><string>app-store-connect</string>
	<key>destination</key><string>export</string>
	<key>teamID</key><string>$TEAM</string>
	<key>uploadSymbols</key><true/>
	$SIGNING
</dict>
</plist>
EOF
  xcodebuild -exportArchive -archivePath "$OUT/PstViewer.xcarchive" -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT/ios"
  xcrun altool --upload-app --type ios --file "$OUT/ios/PstViewer.ipa" --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
  ;;
mac)
  cd "$ROOT/apps/desktop"
  pnpm run build
  rm -rf dist/mas-universal
  APPLE_TEAM_ID="$TEAM" BUILD_NUMBER="$BUILD_NUMBER" node scripts/dist-mas.cjs
  PKG="$(ls dist/mas-universal/*.pkg)"
  xcrun altool --upload-package "$PKG" --type macos --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID" \
    --apple-id 6820516765 --bundle-id de.kernich.pstviewer --bundle-version "$BUILD_NUMBER" --bundle-short-version-string "$VERSION"
  ;;
*)
  echo "usage: $0 ios|mac" >&2
  exit 1
  ;;
esac
