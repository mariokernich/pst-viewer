import { ImageResponse } from 'next/og'

const size = { width: 180, height: 180 }

// Prerendered into `out/apple-touch-icon.png` by the static export.
export const dynamic = 'force-static'

/**
 * Apple touch icon: full-bleed version of the app icon (iOS applies its own
 * rounded mask, so the squircle and margins of the macOS icon are omitted).
 *
 * A route handler instead of the `apple-icon` file convention: the export
 * writes that one without file extension (GitHub Pages would serve it as
 * `application/octet-stream`) and links it without the base path.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'linear-gradient(135deg, #3d8bff, #5a3dff)',
        }}
      >
        <svg width="150" height="150" viewBox="10 22 100 100">
          <rect x="22" y="36" width="72" height="52" rx="10" fill="#ffffff" />
          <path d="M31 45L58 64.5L85 45" fill="none" stroke="#5a6cff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="88" cy="84" r="17" fill="#ffffff" />
          <path d="M95.5 91.5l9 9" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" />
          <path d="M95.5 91.5l9 9" stroke="#4a5cff" strokeWidth="5.5" strokeLinecap="round" />
          <circle cx="88" cy="84" r="10.5" fill="#ffffff" stroke="#4a5cff" strokeWidth="5" />
        </svg>
      </div>
    ),
    size,
  )
}
