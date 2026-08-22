import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Languages, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';
import { SupportedLocale } from '../../i18n/types';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

export function LanguageSelector() {
  const { locale, setLocale, supportedLocales } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const { triggerRef, menuRef, coords } = useDropdownPosition<HTMLButtonElement>({
    isOpen,
    onClose: () => setIsOpen(false),
    offsetY: 4,
  });

  const currentLocale =
    supportedLocales.find((l) => l.code === locale) || supportedLocales[0];

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
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

      {/* Popover Listbox: Render via Portal to document.body to escape header stacking context */}
      {isOpen && coords && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Danh sách ngôn ngữ"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              right: `${coords.right}px`,
            }}
            className="w-36 bg-parchment border border-parchment-2 rounded-[2px] shadow-xl z-40 py-1 animate-fadeIn"
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
          </div>,
          document.body
        )}
    </div>
  );
}
