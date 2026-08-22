# Quickstart & Verification Guide: Reader Typography Settings

## 1. Automated Quality Verification

```bash
# 1. Typecheck
npm run lint

# 2. Unit tests
npm test

# 3. Production bundle build
npm run build
```

---

## 2. Targeted Unit Test Execution

```bash
npx vitest run src/context/__tests__/ThemeContext.test.ts
```

---

## 3. Manual Browser Verification Scenarios

### Scenario A: Font Family Selection & Google Font Loading
1. Open `CustomThemeModal` via the Palette/Theme button in the top navigation.
2. Under "Kiểu chữ (Font chữ)", click on "Source Serif 4".
3. **Expected**:
   - The `<link id="google-font-source-serif-4">` is injected into `<head>`.
   - The Live Preview box text immediately changes to Source Serif 4.
   - Click "Lưu", verify that translated text in `BilingualEditor` renders in Source Serif 4.

### Scenario B: Font Size Scaling (14px - 50px)
1. In `CustomThemeModal`, observe the font size counter (e.g. 22px).
2. Click `+` repeatedly until reaching 50px.
   - **Expected**: Live Preview text scales larger smoothly; `+` button is disabled at 50px.
3. Click `-` repeatedly until reaching 14px.
   - **Expected**: Live Preview text scales smaller smoothly; `-` button is disabled at 14px.

### Scenario C: Persistence & Reset
1. Change font to "Roboto" and size to "26px", click "Lưu bảng màu & kiểu chữ".
2. Reload the page (`F5`).
   - **Expected**: Settings remain at "Roboto" and "26px".
3. Re-open modal, click "Khôi phục mặc định".
   - **Expected**: Font resets to "Merriweather" and size resets to "22px".
