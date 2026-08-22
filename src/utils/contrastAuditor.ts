import { CustomThemePalette, ContrastAuditResult } from '../types/theme';

/**
 * Phân tích chuỗi mã màu HEX (#RGB hoặc #RRGGBB) thành các giá trị [R, G, B] trong khoảng [0, 255]
 */
export function parseHex(hex: string): [number, number, number] {
  let cleanHex = hex.trim().replace(/^#/, '');

  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (cleanHex.length !== 6) {
    return [0, 0, 0];
  }

  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) {
    return [0, 0, 0];
  }

  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return [r, g, b];
}

/**
 * Chuyển đổi một kênh màu sRGB (0-255) sang giá trị linear theo chuẩn WCAG 2.1
 */
export function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Tính Relative Luminance (Độ chói tương đối L) theo công thức W3C WCAG 2.1
 * Kết quả nằm trong khoảng [0 (đen tuyệt đối) đến 1 (trắng tuyệt đối)]
 */
export function getLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  const rLin = channelToLinear(r);
  const gLin = channelToLinear(g);
  const bLin = channelToLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Tính tỷ lệ tương phản (Contrast Ratio) giữa 2 màu HEX theo chuẩn WCAG 2.1
 * Công thức: (L1 + 0.05) / (L2 + 0.05), với L1 >= L2.
 * Kết quả nằm trong khoảng [1.0 (trùng màu) đến 21.0 (đen trên trắng)].
 */
export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = getLuminance(foregroundHex);
  const l2 = getLuminance(backgroundHex);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 10) / 10;
}

/**
 * Kiểm định toàn diện bảng màu và trả về các chỉ số tương phản quan trọng
 */
export function auditPalette(palette: CustomThemePalette): ContrastAuditResult {
  const textMainOnParchment = getContrastRatio(palette.textMain, palette.parchment);
  const textMutedOnParchment = getContrastRatio(palette.textMuted, palette.parchment);
  const polishOnParchment = getContrastRatio(palette.polish, palette.parchment);
  const textMainOnInk = getContrastRatio(palette.textMain, palette.ink);

  // Chuẩn WCAG AA: chữ thường >= 4.5:1, UI lớn/nhấn >= 3.0:1
  const isTextMainCompliant = textMainOnParchment >= 4.5;
  const isPolishCompliant = polishOnParchment >= 3.0;

  return {
    textMainOnParchment,
    textMutedOnParchment,
    polishOnParchment,
    textMainOnInk,
    isTextMainCompliant,
    isPolishCompliant,
  };
}
