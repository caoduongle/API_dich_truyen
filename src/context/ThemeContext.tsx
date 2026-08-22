import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  ThemeMode,
  CustomThemePalette,
  ThemeContextType,
  DEFAULT_DARK_PALETTE,
  ReaderFontId,
  READER_FONT_OPTIONS,
  DEFAULT_READER_FONT,
  DEFAULT_READER_FONT_SIZE,
  MIN_READER_FONT_SIZE,
  MAX_READER_FONT_SIZE,
} from '../types/theme';
import { loadGoogleFont } from '../utils/fontLoader';

const STORAGE_KEY_THEME = 'ai_dich_truyen_theme';
const STORAGE_KEY_CUSTOM = 'ai_dich_truyen_custom_colors';
const STORAGE_KEY_READER_FONT = 'ai_dich_truyen_reader_font';
const STORAGE_KEY_READER_FONT_SIZE = 'ai_dich_truyen_reader_font_size';

const ThemeContext = createContext<ThemeContextType | null>(null);

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved && ['dark', 'light', 'sepia', 'custom'].includes(saved)) {
      return saved as ThemeMode;
    }
    // Auto-detect OS scheme on first load
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  } catch (e) {
    console.warn('Lỗi đọc theme từ localStorage:', e);
  }
  return 'dark';
}

function getInitialCustomPalette(): CustomThemePalette {
  if (typeof window === 'undefined') return DEFAULT_DARK_PALETTE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ink: parsed.ink || DEFAULT_DARK_PALETTE.ink,
        parchment: parsed.parchment || DEFAULT_DARK_PALETTE.parchment,
        parchment2: parsed.parchment2 || DEFAULT_DARK_PALETTE.parchment2,
        textMain: parsed.textMain || DEFAULT_DARK_PALETTE.textMain,
        textMuted: parsed.textMuted || DEFAULT_DARK_PALETTE.textMuted,
        polish: parsed.polish || DEFAULT_DARK_PALETTE.polish,
      };
    }
  } catch (e) {
    console.warn('Lỗi đọc custom palette từ localStorage:', e);
  }
  return DEFAULT_DARK_PALETTE;
}

function getInitialReaderFont(): ReaderFontId {
  if (typeof window === 'undefined') return DEFAULT_READER_FONT;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_READER_FONT) as ReaderFontId | null;
    if (saved && READER_FONT_OPTIONS.some((f) => f.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.warn('Lỗi đọc reader font từ localStorage:', e);
  }
  return DEFAULT_READER_FONT;
}

function getInitialReaderFontSize(): number {
  if (typeof window === 'undefined') return DEFAULT_READER_FONT_SIZE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_READER_FONT_SIZE);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_READER_FONT_SIZE && parsed <= MAX_READER_FONT_SIZE) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Lỗi đọc reader font size từ localStorage:', e);
  }
  return DEFAULT_READER_FONT_SIZE;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [customPalette, setCustomPaletteState] = useState<CustomThemePalette>(getInitialCustomPalette);
  const [readerFont, setReaderFontState] = useState<ReaderFontId>(getInitialReaderFont);
  const [readerFontSize, setReaderFontSizeState] = useState<number>(getInitialReaderFontSize);

  const applyThemeToDOM = useCallback((currentTheme: ThemeMode, palette: CustomThemePalette) => {
    if (typeof document === 'undefined') return;
    const docEl = document.documentElement;
    docEl.setAttribute('data-theme', currentTheme);

    if (currentTheme === 'custom') {
      docEl.style.setProperty('--color-ink', palette.ink);
      docEl.style.setProperty('--color-parchment', palette.parchment);
      docEl.style.setProperty('--color-parchment-2', palette.parchment2);
      docEl.style.setProperty('--color-text-main', palette.textMain);
      docEl.style.setProperty('--color-text-muted', palette.textMuted);
      docEl.style.setProperty('--color-polish', palette.polish);
    } else {
      docEl.style.removeProperty('--color-ink');
      docEl.style.removeProperty('--color-parchment');
      docEl.style.removeProperty('--color-parchment-2');
      docEl.style.removeProperty('--color-text-main');
      docEl.style.removeProperty('--color-text-muted');
      docEl.style.removeProperty('--color-polish');
    }
  }, []);

  const applyTypographyToDOM = useCallback((font: ReaderFontId, size: number) => {
    if (typeof document === 'undefined') return;
    const docEl = document.documentElement;

    loadGoogleFont(font);
    const fontOpt = READER_FONT_OPTIONS.find((f) => f.id === font) || READER_FONT_OPTIONS[0];

    docEl.style.setProperty('--reader-font-family', fontOpt.fontFamilyCss);
    docEl.style.setProperty('--reader-font-size', `${size}px`);
  }, []);

  useEffect(() => {
    applyThemeToDOM(theme, customPalette);
  }, [theme, customPalette, applyThemeToDOM]);

  useEffect(() => {
    applyTypographyToDOM(readerFont, readerFontSize);
  }, [readerFont, readerFontSize, applyTypographyToDOM]);

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      applyThemeToDOM(newTheme, customPalette);
      try {
        localStorage.setItem(STORAGE_KEY_THEME, newTheme);
      } catch (e) {
        console.warn('Lỗi ghi theme vào localStorage:', e);
      }
    },
    [customPalette, applyThemeToDOM]
  );

  const setCustomPalette = useCallback(
    (newPalette: CustomThemePalette) => {
      setCustomPaletteState(newPalette);
      if (theme === 'custom') {
        applyThemeToDOM('custom', newPalette);
      }
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(newPalette));
      } catch (e) {
        console.warn('Lỗi ghi custom palette vào localStorage:', e);
      }
    },
    [theme, applyThemeToDOM]
  );

  const resetCustomPalette = useCallback(() => {
    setCustomPaletteState(DEFAULT_DARK_PALETTE);
    if (theme === 'custom') {
      applyThemeToDOM('custom', DEFAULT_DARK_PALETTE);
    }
    try {
      localStorage.removeItem(STORAGE_KEY_CUSTOM);
    } catch (e) {}
  }, [theme, applyThemeToDOM]);

  const setReaderFont = useCallback(
    (newFont: ReaderFontId) => {
      setReaderFontState(newFont);
      applyTypographyToDOM(newFont, readerFontSize);
      try {
        localStorage.setItem(STORAGE_KEY_READER_FONT, newFont);
      } catch (e) {
        console.warn('Lỗi ghi reader font vào localStorage:', e);
      }
    },
    [readerFontSize, applyTypographyToDOM]
  );

  const setReaderFontSize = useCallback(
    (newSize: number) => {
      const clampedSize = Math.max(MIN_READER_FONT_SIZE, Math.min(MAX_READER_FONT_SIZE, Math.round(newSize)));
      setReaderFontSizeState(clampedSize);
      applyTypographyToDOM(readerFont, clampedSize);
      try {
        localStorage.setItem(STORAGE_KEY_READER_FONT_SIZE, clampedSize.toString());
      } catch (e) {
        console.warn('Lỗi ghi reader font size vào localStorage:', e);
      }
    },
    [readerFont, applyTypographyToDOM]
  );

  const resetReaderTypography = useCallback(() => {
    setReaderFontState(DEFAULT_READER_FONT);
    setReaderFontSizeState(DEFAULT_READER_FONT_SIZE);
    applyTypographyToDOM(DEFAULT_READER_FONT, DEFAULT_READER_FONT_SIZE);
    try {
      localStorage.removeItem(STORAGE_KEY_READER_FONT);
      localStorage.removeItem(STORAGE_KEY_READER_FONT_SIZE);
    } catch (e) {}
  }, [applyTypographyToDOM]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        customPalette,
        readerFont,
        readerFontSize,
        setTheme,
        setCustomPalette,
        resetCustomPalette,
        setReaderFont,
        setReaderFontSize,
        resetReaderTypography,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
