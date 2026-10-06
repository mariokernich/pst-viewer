// Builds the Mac App Store package (universal, sandboxed).
//
//   APPLE_TEAM_ID=ABCDE12345 pnpm dist:mas
//
// Needs the "Apple Distribution" and "Mac Installer Distribution"
// certificates in the keychain and the Mac App Store provisioning profile
// for de.kernich.pstviewer saved as build/embedded.provisionprofile (not
// committed). See docs/store-release.md.
const fs = require('node:fs')
const path = require('node:path')
const builder = require('electron-builder')

const root = path.resolve(__dirname, '..')
const teamId = process.env.APPLE_TEAM_ID
if (!teamId || !/^[A-Z0-9]{10}$/.test(teamId)) {
  console.error('Set APPLE_TEAM_ID to your 10-character Apple Developer team id.')
  process.exit(1)
}
if (!fs.existsSync(path.join(root, 'build/embedded.provisionprofile'))) {
  console.error('Missing build/embedded.provisionprofile (Mac App Store distribution profile for de.kernich.pstviewer).')
  process.exit(1)
}
const template = fs.readFileSync(path.join(root, 'build/entitlements.mas.template.plist'), 'utf8')
fs.writeFileSync(path.join(root, 'build/entitlements.mas.plist'), template.replaceAll('__TEAM_ID__', teamId))

builder
  .build({ projectDir: root, mac: ['mas'], universal: true, config: { mas: { extendInfo: { ElectronTeamID: teamId } } } })
  .then((files) => console.log(files.join('\n')))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
