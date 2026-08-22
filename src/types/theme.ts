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

export interface ThemeContextType {
  theme: ThemeMode;
  customPalette: CustomThemePalette;
  setTheme: (theme: ThemeMode) => void;
  setCustomPalette: (palette: CustomThemePalette) => void;
  resetCustomPalette: () => void;
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
