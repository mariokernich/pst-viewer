// Builds the Microsoft Store package (MSIX/AppX) on Windows.
//
//   set MS_STORE_IDENTITY_NAME=12345MarioKernich.PSTViewer
//   set MS_STORE_PUBLISHER=CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
//   pnpm dist:appx
//
// Both values are shown in Partner Center under Product identity. The store
// signs the package itself. See docs/store-release.md.
const path = require('node:path')
const builder = require('electron-builder')

const identityName = process.env.MS_STORE_IDENTITY_NAME
const publisher = process.env.MS_STORE_PUBLISHER
if (!identityName || !publisher?.startsWith('CN=')) {
  console.error('Set MS_STORE_IDENTITY_NAME and MS_STORE_PUBLISHER (CN=…) from Partner Center > Product identity.')
  process.exit(1)
}

builder
  .build({ projectDir: path.resolve(__dirname, '..'), win: ['appx'], x64: true, arm64: true, config: { appx: { identityName, publisher } } })
  .then((files) => console.log(files.join('\n')))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
