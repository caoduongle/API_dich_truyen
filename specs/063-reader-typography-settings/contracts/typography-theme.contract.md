# Contract: Typography Settings & Theme Context Interface

## 1. Module Definition
- **Types**: `src/types/theme.ts`
- **Context**: `src/context/ThemeContext.tsx`
- **Component**: `src/components/common/CustomThemeModal.tsx`

---

## 2. Interface Contract

```typescript
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
```

---

## 3. UI Presentation & CSS Guarantees

1. **CSS Variables**:
   - `--reader-font-family` MUST be set on `document.documentElement` to the active font option's `fontFamilyCss`.
   - `--reader-font-size` MUST be set on `document.documentElement` to `${readerFontSize}px`.
2. **Font Options**:
   - 7 predefined fonts MUST be selectable.
   - Google Fonts (`roboto`, `merriweather`, `source-serif-4`) MUST dynamically load their Google Fonts CSS.
3. **Font Size Bounds**:
   - `readerFontSize` MUST be strictly constrained to `14 <= fontSize <= 50`.
4. **Modal Integration**:
   - `CustomThemeModal` MUST display the Typography controls and update the live preview block in real-time.
