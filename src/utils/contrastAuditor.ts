import { CustomThemePalette, ContrastAuditResult as ThemeContrastAuditResult } from '../types/theme';

export interface ContrastAuditResult {
  foreground: string;
  background: string;
  ratio: number;
  isWcagAaPass: boolean;
  isWcagAaaPass: boolean;
}

/**
 * Audit contrast ratios for user's custom theme palette
 */
export function auditPalette(palette: CustomThemePalette): ThemeContrastAuditResult {
  const textMainOnParchment = calculateContrastRatio(palette.textMain, palette.parchment);
  const textMutedOnParchment = calculateContrastRatio(palette.textMuted, palette.parchment);
  const polishOnParchment = calculateContrastRatio(palette.polish, palette.parchment);
  const textMainOnInk = calculateContrastRatio(palette.textMain, palette.ink);

  return {
    textMainOnParchment,
    textMutedOnParchment,
    polishOnParchment,
    textMainOnInk,
    isTextMainCompliant: textMainOnParchment >= 4.5,
    isPolishCompliant: polishOnParchment >= 3.0,
  };
}

/**
 * Parse hex string (#RGB, #RRGGBB) to linear RGB components [0, 1]
 */
function sRgbToLinear(c: number): number {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map((char) => char + char).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Calculate relative luminance of a color
 * L = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin
 */
export function calculateLuminance(hexColor: string): number {
  const { r, g, b } = hexToRgb(hexColor);
  const rLin = sRgbToLinear(r);
  const gLin = sRgbToLinear(g);
  const bLin = sRgbToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculate contrast ratio between two hex colors
 * (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter color
 */
export function calculateContrastRatio(color1Hex: string, color2Hex: string): number {
  const l1 = calculateLuminance(color1Hex);
  const l2 = calculateLuminance(color2Hex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

export const THEME_PALETTES = {
  light: {
    ink: '#FFFFFF',
    parchment: '#F7F2E9',
    parchment2: '#E4DCC8',
    textMain: '#3A2E22',
    textMuted: '#8A7A63',
    polish: '#B8402C',
  },
  dark: {
    ink: '#14100D',
    parchment: '#1F1914',
    parchment2: '#2A241D',
    textMain: '#DCD1BC',
    textMuted: '#786F5E',
    polish: '#B8402C',
  },
  sepia: {
    ink: '#EBE0C9',
    parchment: '#F4ECD8',
    parchment2: '#D5C5A5',
    textMain: '#5B4636',
    textMuted: '#7A6A5A',
    polish: '#B8402C',
  },
};

export function auditThemeSnippets(theme: 'light' | 'dark' | 'sepia'): {
  vietnameseEvidence: ContrastAuditResult;
  rawChineseSnippet: ContrastAuditResult;
} {
  const palette = THEME_PALETTES[theme];

  // Vietnamese evidence: textMain on ink
  const viRatio = calculateContrastRatio(palette.textMain, palette.ink);
  // Chinese raw snippet: textMain on parchment
  const rawRatio = calculateContrastRatio(palette.textMain, palette.parchment);

  return {
    vietnameseEvidence: {
      foreground: palette.textMain,
      background: palette.ink,
      ratio: viRatio,
      isWcagAaPass: viRatio >= 4.5,
      isWcagAaaPass: viRatio >= 7.0,
    },
    rawChineseSnippet: {
      foreground: palette.textMain,
      background: palette.parchment,
      ratio: rawRatio,
      isWcagAaPass: rawRatio >= 4.5,
      isWcagAaaPass: rawRatio >= 7.0,
    },
  };
}
