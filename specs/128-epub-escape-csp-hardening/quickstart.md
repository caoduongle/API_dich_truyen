# Quickstart & Verification Guide: Feature 128

## 1. Automated Verification Commands

### Step 1: Text Utility & Escaping Unit Tests
```bash
npx vitest run src/lib/__tests__/text.test.ts src/services/__tests__/zuminovelPublishService.test.ts
```
**Expected Outcome**: All tests pass cleanly, confirming `escapeHtml` escapes `&`, `<`, `>`, `"`, `'` deterministically and ZumiNovel packaging behaves identically.

### Step 2: EPUB Export XML Well-Formedness Test
```bash
npx vitest run src/hooks/__tests__/useEpubExport.test.ts
```
**Expected Outcome**: EPUB files generated from metadata and chapters containing `<`, `>`, `&` produce valid, parseable XML/XHTML documents.

### Step 3: Dependency Integrity Check
```bash
npm run lint && npm run build
```
**Expected Outcome**: Type checks pass with 0 errors and production build succeeds without `y-websocket` or `y-protocols`.

### Step 4: CSP Header Parity Audit
Compare the `Content-Security-Policy` directives across all three files:
- `render.yaml`
- `vercel.json`
- `public/_headers`

Verify:
- 0 occurrences of `ws:` and `wss:`.
- 100% identical strings across all three files.

---

## 2. Browser Verification Protocol (`npm run preview`)

Launch preview server:
```bash
npm run preview
```

Open Chrome DevTools Console (`http://localhost:4173`) and test the 4 key user journeys:
1. **Flow A (Initial Page Load & JSON-LD)**:
   - Check Console for CSP errors (`Refused to execute inline script / Refused to apply inline style`).
   - Validate that JSON-LD structured data script is present and parsed.
2. **Flow B (Google Identity Services Auth)**:
   - Click "Đăng nhập Google" or observe One Tap.
   - Verify GIS popup opens and operates without CSP script blocking.
3. **Flow C (Google Drive Picker)**:
   - Click "Chọn file từ Drive" to trigger Google Picker iframe.
   - Inspect console to confirm Google Picker loads without CSP errors.
4. **Flow D (Custom Theme Customization)**:
   - Open CustomThemeModal and change color palette.
   - Verify dynamic styles update immediately without triggering `style-src` CSP violations.
