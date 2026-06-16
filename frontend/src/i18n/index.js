import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 1. Import your existing languages
import en from './en.json';
import hi from './hi.json';
import te from './te.json';
import ta from './ta.json';
import kn from './kn.json';

// 2. Import your NEW languages here
import mr from './mr.json'; // Marathi
import bn from './bn.json'; // Bengali

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      te: { translation: te },
      ta: { translation: ta },
      kn: { translation: kn },
      // 3. Add your new languages to the resources block
      mr: { translation: mr },
      bn: { translation: bn },
    },
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'yami_lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;