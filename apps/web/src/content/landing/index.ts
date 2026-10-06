import type { Locale } from '@/lib/i18n'
import { landingDe } from './de'
import { landingEn } from './en'
import type { LandingContent } from './types'

export type { LandingContent } from './types'

export const landing: Record<Locale, LandingContent> = { de: landingDe, en: landingEn }
