import { ReaderFontId } from '../types/theme';

const GOOGLE_FONTS_URL_MAP: Partial<Record<ReaderFontId, string>> = {
  roboto: 'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap',
  merriweather: 'https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap',
  'source-serif-4': 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap',
};

/**
 * Tải động Google Fonts vào document head nếu chưa được nạp
 */
export function loadGoogleFont(fontId: ReaderFontId): void {
  if (typeof document === 'undefined') return;
  const url = GOOGLE_FONTS_URL_MAP[fontId];
  if (!url) return;

  const elementId = `google-font-${fontId}`;
  if (document.getElementById(elementId)) return;

  const link = document.createElement('link');
  link.id = elementId;
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}
