import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { landing } from '@/content/landing'
import { defaultLocale, isLocale, locales } from '@/lib/i18n'
import { ogImage } from '@/lib/og'

export const alt = ogImage.alt
export const size = ogImage.size
export const contentType = ogImage.contentType
export const dynamicParams = false

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

// Geist ships static TTF files, which the image renderer needs (no WOFF2 / variable fonts).
const fontDir = join(process.cwd(), 'node_modules/geist/dist/fonts/geist-sans')
const fonts = Promise.all([readFile(join(fontDir, 'Geist-Regular.ttf')), readFile(join(fontDir, 'Geist-SemiBold.ttf'))])

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: param } = await params
  const locale = isLocale(param) ? param : defaultLocale
  const t = landing[locale].hero
  const [regular, semiBold] = await fonts

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          color: '#ffffff',
          fontFamily: 'Geist',
          backgroundColor: '#0b0d1c',
          backgroundImage:
            'radial-gradient(circle at 18% 0%, rgba(61,139,255,0.42), transparent 55%), radial-gradient(circle at 95% 100%, rgba(90,61,255,0.5), transparent 55%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundImage: 'linear-gradient(135deg, #3d8bff, #5a3dff)',
              boxShadow: '0 12px 30px rgba(20, 20, 90, 0.5)',
            }}
          >
            <svg width="70" height="70" viewBox="10 22 100 100">
              <rect x="22" y="36" width="72" height="52" rx="10" fill="#ffffff" />
              <path d="M31 45L58 64.5L85 45" fill="none" stroke="#5a6cff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="88" cy="84" r="17" fill="#ffffff" />
              <path d="M95.5 91.5l9 9" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" />
              <path d="M95.5 91.5l9 9" stroke="#4a5cff" strokeWidth="5.5" strokeLinecap="round" />
              <circle cx="88" cy="84" r="10.5" fill="#ffffff" stroke="#4a5cff" strokeWidth="5" />
            </svg>
          </div>
          <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>PST Viewer</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 76, fontWeight: 600, letterSpacing: -3, lineHeight: 1.05 }}>{t.titleLead}</span>
          <span style={{ fontSize: 76, fontWeight: 600, letterSpacing: -3, lineHeight: 1.05, color: '#9db8ff' }}>
            {t.titleAccent}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {['PST', 'MSG', 'EML', 'MBOX'].map((format) => (
              <span
                key={format}
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.22)',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                }}
              >
                {format}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 26, color: 'rgba(255,255,255,0.78)' }}>{t.trust[2]}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Geist', data: regular, style: 'normal', weight: 400 },
        { name: 'Geist', data: semiBold, style: 'normal', weight: 600 },
      ],
    },
  )
}
