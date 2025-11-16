import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';

// 語言映射：將各種中文變體映射到 zh-TW，英文變體映射到 en
const normalizeLanguage = (lng: string): string => {
  if (!lng) return 'en';
  
  const lang = lng.toLowerCase();
  
  // 中文變體都映射到 zh-TW
  if (lang.startsWith('zh')) {
    return 'zh-TW';
  }
  
  // 英文變體都映射到 en
  if (lang.startsWith('en')) {
    return 'en';
  }
  
  // 默認返回 en
  return 'en';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-TW': {
        translation: zhTW,
      },
      en: {
        translation: en,
      },
    },
    fallbackLng: 'en',
    lng: 'en', // Set default language to English
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // 檢測順序：1. localStorage（用戶手動設置） 2. navigator（系統語言）
      order: ['localStorage', 'navigator'],
      // 緩存到 localStorage，這樣用戶手動設置後會記住
      caches: ['localStorage'],
      // 將檢測到的語言標準化為我們支持的語言
      convertDetectedLanguage: normalizeLanguage,
    },
  });

// 如果沒有手動設置語言，使用英文作為預設
const storedLang = localStorage.getItem('i18nextLng');
if (!storedLang || (storedLang !== 'zh-TW' && storedLang !== 'en')) {
  // 設置英文為預設語言
  i18n.changeLanguage('en');
}

export default i18n;

