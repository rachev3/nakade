import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import bg from '@/locales/bg/common.json'
import en from '@/locales/en/common.json'

export const LANGUAGES = ['bg', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { bg: { common: bg }, en: { common: en } },
    defaultNS: 'common',
    fallbackLng: 'bg',
    supportedLngs: LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    // Bulgarian by default: only an explicit choice (stored) or ?lng= switches language.
    detection: {
      order: ['querystring', 'localStorage'],
      lookupLocalStorage: 'nakade.lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  })

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
})
if (typeof document !== 'undefined') document.documentElement.lang = i18n.language || 'bg'

export default i18n
