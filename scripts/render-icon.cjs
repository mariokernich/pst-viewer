// Renders build/icon.svg to build/icon.png (1024x1024) using Electron's
// offscreen rendering. Run with: npm run icons
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const SIZE = 1024
const root = path.resolve(__dirname, '..')

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(root, 'build/icon.svg'), 'utf8')
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  const html = `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((resolve) => setTimeout(resolve, 300))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
  const resized = image.getSize().width === SIZE ? image : image.resize({ width: SIZE, height: SIZE, quality: 'best' })
  fs.writeFileSync(path.join(root, 'build/icon.png'), resized.toPNG())
  console.log('build/icon.png written', resized.getSize())
  app.quit()
})
