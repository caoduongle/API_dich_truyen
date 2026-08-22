# Data Model: Reading & Editor Theme System

**Feature Directory**: `specs/053-reading-theme-system`
**Date**: 2026-08-22

---

## 1. Entities & Types

```typescript
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
```

---

## 2. Storage Schema (`localStorage`)

| Key | Type | Description |
|---|---|---|
| `ai_dich_truyen_theme` | `ThemeMode` | Selected theme mode (`'dark' \| 'light' \| 'sepia' \| 'custom'`) |
| `ai_dich_truyen_custom_colors` | JSON stringified `CustomThemePalette` | Custom 6-token hex codes |

*Note: 0 data is stored in IndexedDB for theme configuration, preserving strict separation of concerns.*
