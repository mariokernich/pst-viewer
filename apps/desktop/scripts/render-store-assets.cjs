// Renders the Microsoft Store (AppX/MSIX) logos from build/icon.svg into
// build/appx using Electron's offscreen rendering. Run with: pnpm store-assets
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const out = path.join(root, 'build/appx')

// [file, width, height, icon size] - base size and 200 % scale of each logo.
const ASSETS = [
  ['StoreLogo.png', 50, 50, 50],
  ['StoreLogo.scale-200.png', 100, 100, 100],
  ['Square44x44Logo.png', 44, 44, 44],
  ['Square44x44Logo.scale-200.png', 88, 88, 88],
  ['Square44x44Logo.targetsize-256_altform-unplated.png', 256, 256, 256],
  ['Square71x71Logo.png', 71, 71, 60],
  ['Square71x71Logo.scale-200.png', 142, 142, 120],
  ['Square150x150Logo.png', 150, 150, 110],
  ['Square150x150Logo.scale-200.png', 300, 300, 220],
  ['Wide310x150Logo.png', 310, 150, 110],
  ['Wide310x150Logo.scale-200.png', 620, 300, 220],
  ['Square310x310Logo.png', 310, 310, 210],
  ['Square310x310Logo.scale-200.png', 620, 620, 420]
]

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(root, 'build/icon.svg'), 'utf8')
  fs.mkdirSync(out, { recursive: true })
  const win = new BrowserWindow({ width: 620, height: 620, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } })
  for (const [file, width, height, size] of ASSETS) {
    win.setContentSize(width, height)
    const icon = svg.replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`)
    const html = `<!doctype html><html><body style="margin:0;width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden">${icon}</body></html>`
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise((resolve) => setTimeout(resolve, 150))
    const image = await win.webContents.capturePage({ x: 0, y: 0, width, height })
    const sized = image.getSize().width === width ? image : image.resize({ width, height, quality: 'best' })
    fs.writeFileSync(path.join(out, file), sized.toPNG())
  }
  console.log(`${ASSETS.length} logos written to build/appx`)
  app.quit()
})
