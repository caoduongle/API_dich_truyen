# Quickstart Validation Guide: High-Contrast CJK Raw Snippet & Bilingual Evidence Display

**Feature**: `078-fix-raw-snippet-contrast`
**Date**: 2026-08-27
**Status**: Ready

## 1. Automated Verification Scenarios

### 1.1 Type Safety & Static Analysis
Run TypeScript static check:
```bash
npm run lint
```
*Expected Outcome*: Clean exit code 0, no type or JSX errors in `HakoIssueCard.tsx`.

### 1.2 Contrast & Unit Testing
Run Vitest to verify contrast ratios across Light, Sepia, and Dark themes:
```bash
npx vitest run src/utils/__tests__/contrastAuditor.test.ts
```
*Expected Outcome*: All contrast checks pass with ratio $\ge 7:1$ (WCAG AAA).

### 1.3 Production Build
Verify production compilation:
```bash
npm run build
```
*Expected Outcome*: Bundle compiles without errors.

---

## 2. Visual & Theme Switching Validation

1. Start local dev server: `npm run dev`.
2. Open the **Hako Checker** tab and run a review on a chapter with raw leaks or mistranslations.
3. **Light Theme Check**:
   - Verify that the Chinese raw snippet box displays dark, sharp text on the light parchment background.
   - Verify that the Vietnamese translation evidence box has a Cinnabar red left border.
   - Verify that the Chinese raw snippet box has an Amber gold left border.
4. **Theme Switch (Light $\to$ Sepia $\to$ Dark)**:
   - Switch between themes using the theme selector.
   - Confirm that text contrast remains high ($\ge 7:1$) and readable on all 3 themes.
5. **One-Click Copy Check**:
   - Click the "Sao chép" button on the raw snippet header.
   - Confirm the button shows "Đã chép" with a checkmark for 2 seconds and the Chinese text is in the clipboard.
