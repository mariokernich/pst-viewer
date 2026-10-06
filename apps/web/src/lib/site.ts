/**
 * Site-wide configuration: URL, owner, price and store links.
 */

const DEFAULT_SITE_URL = 'https://www.example.com'

/** Public origin of the site without trailing slash (from `NEXT_PUBLIC_SITE_URL`). */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '')

export const siteConfig = {
  name: 'PST Viewer',
  owner: 'Mario Kernich',
  /** One-time price per store. Display strings live in the content files. */
  price: { amount: '4.99', currency: 'EUR' },
} as const

export type StoreId = 'macAppStore' | 'microsoftStore' | 'appStore' | 'googlePlay'

export type PlatformId = 'mac' | 'windows' | 'ios' | 'android'

export interface Store {
  id: StoreId
  platform: PlatformId
  /** Store name as shown on the button (not translated). */
  name: string
  /**
   * `true` once the app can be bought in this store. Unavailable stores are
   * rendered as non-interactive "in development" buttons.
   */
  available: boolean
  url: string
}

export const stores: Record<StoreId, Store> = {
  macAppStore: {
    id: 'macAppStore',
    platform: 'mac',
    name: 'Mac App Store',
    available: true,
    // TODO: replace with the Mac App Store product URL.
    url: '#',
  },
  microsoftStore: {
    id: 'microsoftStore',
    platform: 'windows',
    name: 'Microsoft Store',
    available: true,
    // TODO: replace with the Microsoft Store product URL.
    url: '#',
  },
  appStore: {
    id: 'appStore',
    platform: 'ios',
    name: 'App Store',
    // TODO: set to true and add the App Store URL once the iPhone & iPad app is released.
    available: false,
    url: '#',
  },
  googlePlay: {
    id: 'googlePlay',
    platform: 'android',
    name: 'Google Play',
    // TODO: set to true and add the Google Play URL once the Android app is released.
    available: false,
    url: '#',
  },
}

export const storeOrder: StoreId[] = ['macAppStore', 'microsoftStore', 'appStore', 'googlePlay']
