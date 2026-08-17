import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SupportedLocale, SUPPORTED_LOCALES, LocaleDefinition } from './types';
import { vi } from './locales/vi';
import { en } from './locales/en';
import { zh } from './locales/zh';

const STORAGE_KEY = 'ai_translator_i18n_lang';

const dictionaries: Record<SupportedLocale, any> = {
  vi,
  en,
  zh,
};

export interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  supportedLocales: LocaleDefinition[];
  t: (path: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'vi';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['vi', 'en', 'zh'].includes(saved)) {
      return saved as SupportedLocale;
    }
    // Phát hiện ngôn ngữ trình duyệt
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('zh')) return 'zh';
    if (browserLang.startsWith('en')) return 'en';
  } catch (_) {
    // fallback
  }
  return 'vi';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(getInitialLocale);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = locale;
    } catch (_) {}
  }, [locale]);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const keys = path.split('.');
      let current: any = dictionaries[locale] || dictionaries.vi;

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback to Vietnamese
          let fallback: any = dictionaries.vi;
          for (const fbKey of keys) {
            if (fallback && typeof fallback === 'object' && fbKey in fallback) {
              fallback = fallback[fbKey];
            } else {
              return path;
            }
          }
          current = fallback;
          break;
        }
      }

      if (typeof current !== 'string') {
        return path;
      }

      let result = current;
      if (params) {
        for (const [pKey, pVal] of Object.entries(params)) {
          result = result.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        }
      }
      return result;
    },
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        supportedLocales: SUPPORTED_LOCALES,
        t,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return ctx;
}
