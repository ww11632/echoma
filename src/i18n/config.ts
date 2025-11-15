import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
// 延迟加载非默认语言，减少初始 bundle 大小
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
      en: {
        translation: en,
      },
    },
    fallbackLng: 'en',
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

// 按需加载其他语言资源
const loadLanguage = async (lng: string) => {
  if (lng === 'zh-TW' && !i18n.hasResourceBundle('zh-TW', 'translation')) {
    const zhTW = await import('./locales/zh-TW.json');
    i18n.addResourceBundle('zh-TW', 'translation', zhTW.default || zhTW);
  }
};

// 监听语言变化，按需加载
i18n.on('languageChanged', (lng) => {
  loadLanguage(lng);
});

// 如果沒有手動設置語言，自動檢測並設置系統語言
const storedLang = localStorage.getItem('i18nextLng');
if (!storedLang || (storedLang !== 'zh-TW' && storedLang !== 'en')) {
  // 檢測系統語言
  const systemLang = navigator.language || (navigator as any).userLanguage || 'en';
  const normalizedLang = normalizeLanguage(systemLang);
  
  // 設置檢測到的語言（會触发 loadLanguage）
  i18n.changeLanguage(normalizedLang);
} else {
  // 如果已有存储的语言，也需要加载对应的资源
  loadLanguage(storedLang);
}

export default i18n;

