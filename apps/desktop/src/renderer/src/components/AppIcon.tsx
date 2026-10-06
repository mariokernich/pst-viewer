import { useId } from 'react'

/** The application mark: an envelope with a magnifier on a glassy squircle. */
export function AppIcon({ size = 64, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d8bff" />
          <stop offset="1" stopColor="#5a3dff" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e8ecff" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="120" height="120" rx="28" fill={`url(#${id}-bg)`} />
      <rect x="4" y="4" width="120" height="120" rx="28" fill={`url(#${id}-shine)`} />
      <rect x="4.5" y="4.5" width="119" height="119" rx="27.5" fill="none" stroke="#ffffff" strokeOpacity="0.25" />
      <rect x="22" y="36" width="72" height="52" rx="10" fill={`url(#${id}-paper)`} />
      <path d="M31 45L58 64.5L85 45" fill="none" stroke="#5a6cff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="88" cy="84" r="17" fill="#ffffff" />
      <path d="M95.5 91.5l9 9" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" />
      <path d="M95.5 91.5l9 9" stroke="#4a5cff" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="88" cy="84" r="10.5" fill="#ffffff" stroke="#4a5cff" strokeWidth="5" />
    </svg>
  )
}
