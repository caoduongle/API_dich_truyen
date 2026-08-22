export type ThemeMode = 'dark' | 'light' | 'sepia' | 'custom';

export interface CustomThemePalette {
  ink: string;         // Card & panel surface
  parchment: string;   // Page background
  parchment2: string;  // Border & subtle divider
  textMain: string;    // Primary readable text
  textMuted: string;   // Secondary / caption text
  polish: string;      // Accent / highlight color
}

export interface ContrastAuditResult {
  textMainOnParchment: number;
  textMutedOnParchment: number;
  polishOnParchment: number;
  textMainOnInk: number;
  isTextMainCompliant: boolean;
  isPolishCompliant: boolean;
}

export type ReaderFontId = 
  | 'system'
  | 'arial'
  | 'helvetica'
  | 'roboto'
  | 'georgia'
  | 'merriweather'
  | 'source-serif-4';

export interface ReaderFontOption {
  id: ReaderFontId;
  label: string;
  fontFamilyCss: string;
  isGoogleFont?: boolean;
}

export const READER_FONT_OPTIONS: ReaderFontOption[] = [
  { id: 'system', label: 'System Default', fontFamilyCss: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'arial', label: 'Arial', fontFamilyCss: 'Arial, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', fontFamilyCss: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'roboto', label: 'Roboto', fontFamilyCss: '"Roboto", sans-serif', isGoogleFont: true },
  { id: 'georgia', label: 'Georgia', fontFamilyCss: 'Georgia, serif' },
  { id: 'merriweather', label: 'Merriweather', fontFamilyCss: '"Merriweather", Georgia, serif', isGoogleFont: true },
  { id: 'source-serif-4', label: 'Source Serif 4', fontFamilyCss: '"Source Serif 4", Georgia, serif', isGoogleFont: true },
];

export const MIN_READER_FONT_SIZE = 14;
export const MAX_READER_FONT_SIZE = 50;
export const DEFAULT_READER_FONT_SIZE = 22;
export const DEFAULT_READER_FONT: ReaderFontId = 'merriweather';

export interface ThemeContextType {
  theme: ThemeMode;
  customPalette: CustomThemePalette;
  readerFont: ReaderFontId;
  readerFontSize: number;
  setTheme: (theme: ThemeMode) => void;
  setCustomPalette: (palette: CustomThemePalette) => void;
  resetCustomPalette: () => void;
  setReaderFont: (font: ReaderFontId) => void;
  setReaderFontSize: (size: number) => void;
  resetReaderTypography: () => void;
}

export const DEFAULT_DARK_PALETTE: CustomThemePalette = {
  ink: '#14100D',
  parchment: '#1F1914',
  parchment2: '#2A241D',
  textMain: '#DCD1BC',
  textMuted: '#786F5E',
  polish: '#B8402C',
};

export const DEFAULT_LIGHT_PALETTE: CustomThemePalette = {
  ink: '#FFFFFF',
  parchment: '#F7F2E9',
  parchment2: '#E4DCC8',
  textMain: '#3A2E22',
  textMuted: '#8A7A63',
  polish: '#B8402C',
};

export const DEFAULT_SEPIA_PALETTE: CustomThemePalette = {
  ink: '#EBE0C9',
  parchment: '#F4ECD8',
  parchment2: '#D5C5A5',
  textMain: '#5B4636',
  textMuted: '#7A6A5A',
  polish: '#B8402C',
};
