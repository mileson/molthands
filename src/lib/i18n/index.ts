import en from './locales/en.json'
import zh from './locales/zh.json'

export const locales = ['en', 'zh'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const translations = {
  en,
  zh,
} as const

export type TranslationKey = keyof typeof en
export type NestedTranslation<T, K extends string> = K extends `${infer First}.${infer Rest}`
  ? First extends keyof T
    ? NestedTranslation<T[First], Rest>
    : never
  : K extends keyof T
  ? T[K]
  : never

/**
 * Get translation by key path (e.g., 'nav.home', 'home.stats.tasksCompleted')
 * TODO: Integrate with Next.js middleware for locale detection from URL/cookie
 */
export function getTranslation(locale: Locale, key: string): string {
  const keys = key.split('.')
  let result: unknown = translations[locale]

  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = (result as Record<string, unknown>)[k]
    } else {
      // Fallback to English if key not found in current locale
      let fallback: unknown = translations.en
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in fallback) {
          fallback = (fallback as Record<string, unknown>)[fk]
        } else {
          return key // Return key if not found in any locale
        }
      }
      return typeof fallback === 'string' ? fallback : key
    }
  }

  return typeof result === 'string' ? result : key
}

/**
 * Get all translations for a locale
 */
export function getTranslations(locale: Locale) {
  return translations[locale] || translations[defaultLocale]
}

/**
 * TODO: Create Next.js middleware for locale detection
 * Example middleware structure:
 *
 * export function middleware(request: NextRequest) {
 *   const locale = request.cookies.get('locale')?.value ||
 *                  request.headers.get('accept-language')?.split(',')[0] ||
 *                  defaultLocale
 *   // ... handle locale
 * }
 */
