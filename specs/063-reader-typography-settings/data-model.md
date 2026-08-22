# Data Model & State Transitions: Reader Typography Settings

## 1. Type Definitions & Constants

```typescript
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

export const MIN_READER_FONT_SIZE = 14;
export const MAX_READER_FONT_SIZE = 50;
export const DEFAULT_READER_FONT_SIZE = 22;
export const DEFAULT_READER_FONT: ReaderFontId = 'merriweather';
```

---

## 2. Storage & State Lifecycle

```text
Application Boot / ThemeProvider Initialization
  │
  ├──► Read localStorage['ai_dich_truyen_reader_font'] || 'merriweather'
  ├──► Read localStorage['ai_dich_truyen_reader_font_size'] || 22 (clamped 14..50)
  │
  ▼
Apply to Document Root:
  - If isGoogleFont(fontId) ──► injectLink(url)
  - document.documentElement.style.setProperty('--reader-font-family', option.fontFamilyCss)
  - document.documentElement.style.setProperty('--reader-font-size', `${size}px`)

CustomThemeModal Editing:
  - User selects font option ──► draftFont updated ──► Live preview updates
  - User clicks [+] / [-]   ──► draftFontSize clamped 14..50 ──► Live preview updates
  - User clicks [Lưu]       ──► setReaderFont(draftFont) + setReaderFontSize(draftFontSize)
  - User clicks [Khôi phục] ──► resets to 'merriweather' and 22px
```
