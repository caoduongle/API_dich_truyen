import React, { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';
import { SupportedLocale } from '../../i18n/types';

export function LanguageSelector() {
  const { locale, setLocale, supportedLocales } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLocale =
    supportedLocales.find((l) => l.code === locale) || supportedLocales[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Chọn ngôn ngữ giao diện"
        className="flex items-center gap-1.5 bg-parchment hover:bg-parchment-2 border border-parchment-2 text-text-main text-xs font-semibold px-2.5 py-1.5 rounded-[2px] transition-colors cursor-pointer"
      >
        <Languages className="w-3.5 h-3.5 text-polish shrink-0" />
        <span className="hidden sm:inline-block">{currentLocale.nativeName}</span>
        <span className="sm:hidden">{currentLocale.flag}</span>
        <ChevronDown className="w-3 h-3 text-text-muted" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Danh sách ngôn ngữ"
          className="absolute right-0 mt-1 w-36 bg-parchment border border-parchment-2 rounded-[2px] shadow-xl z-50 py-1 animate-fadeIn"
        >
          {supportedLocales.map((loc) => (
            <button
              key={loc.code}
              role="option"
              aria-selected={locale === loc.code}
              onClick={() => {
                setLocale(loc.code as SupportedLocale);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                locale === loc.code
                  ? 'bg-ink text-polish font-bold'
                  : 'text-text-muted hover:text-text-main hover:bg-parchment-2'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{loc.flag}</span>
                <span>{loc.nativeName}</span>
              </span>
              {locale === loc.code && <Check className="w-3.5 h-3.5 text-polish" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
