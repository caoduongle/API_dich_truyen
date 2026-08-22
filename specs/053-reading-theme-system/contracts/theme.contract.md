# Interface Contracts: Reading & Editor Theme System

**Feature Directory**: `specs/053-reading-theme-system`
**Date**: 2026-08-22

---

## 1. Contrast Calculation Helper Contract (`src/utils/contrastAuditor.ts`)

```typescript
export interface IContrastAuditor {
  /**
   * Tính Relative Luminance (Độ chói tương đối) của một mã màu HEX theo WCAG 2.1
   */
  getLuminance(hex: string): number;

  /**
   * Tính Tỷ lệ tương phản (Contrast Ratio) giữa 2 màu HEX
   */
  getContrastRatio(foregroundHex: string, backgroundHex: string): number;

  /**
   * Kiểm định toàn bộ bảng màu và trả về báo cáo tương phản
   */
  auditPalette(palette: CustomThemePalette): ContrastAuditResult;
}
```

---

## 2. Theme Context Contract (`src/context/ThemeContext.tsx`)

```typescript
export interface IThemeContext {
  theme: ThemeMode;
  customPalette: CustomThemePalette;
  setTheme: (theme: ThemeMode) => void;
  setCustomPalette: (palette: CustomThemePalette) => void;
  resetCustomPalette: () => void;
}
```
