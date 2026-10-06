/** Makes a string safe to use as a file name on all platforms. */
export function sanitizeFileName(name: string, fallback = 'attachment'): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 200)
    .trim()
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i
  if (!cleaned || reserved.test(cleaned)) return `${fallback}${cleaned ? `-${cleaned}` : ''}`
  return cleaned
}

/**
 * File types that can run code when opened. They are never opened directly
 * from the viewer - the user has to save them explicitly.
 */
const UNSAFE_EXTENSIONS = new Set([
  'action', 'ade', 'adp', 'apk', 'app', 'application', 'appref-ms', 'applescript', 'bas', 'bat', 'bin', 'cab', 'cmd', 'com',
  'command', 'cpl', 'csh', 'dll', 'dmg', 'exe', 'gadget', 'hta', 'inf', 'ins', 'iso', 'isp', 'jar', 'js', 'jse', 'ksh', 'lnk',
  'mde', 'mpkg', 'msc', 'msh', 'msi', 'msp', 'mst', 'osax', 'pif', 'pkg', 'prg', 'ps1', 'ps1xml', 'ps2', 'psc1', 'psm1', 'py',
  'pyc', 'rb', 'reg', 'run', 'scf', 'scpt', 'scptd', 'scr', 'sct', 'sh', 'shb', 'shs', 'svg', 'terminal', 'tool', 'url', 'vb',
  'vbe', 'vbs', 'vhd', 'vhdx', 'webloc', 'workflow', 'ws', 'wsc', 'wsf', 'wsh', 'xpi', 'zsh', 'bash', 'img', 'html', 'htm',
  'xhtml', 'mht', 'mhtml', 'xml', 'library-ms', 'settingcontent-ms', 'desktop', 'appimage'
])

export function fileExtension(name: string): string {
  const m = /\.([a-z0-9-]{1,20})$/i.exec(name.trim())
  return m ? m[1].toLowerCase() : ''
}

/** True if opening the file with its default app could execute code. */
export function isUnsafeToOpen(name: string, mimeType: string): boolean {
  if (UNSAFE_EXTENSIONS.has(fileExtension(name))) return true
  return /x-(ms)?dos(exec|-program)|x-msdownload|x-executable|x-sh\b|x-shellscript|javascript|x-apple-diskimage|java-archive|text\/html/i.test(mimeType)
}
