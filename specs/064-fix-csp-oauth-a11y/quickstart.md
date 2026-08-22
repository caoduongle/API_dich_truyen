# Quickstart & Verification Guide: CSP Google OAuth & Accessibility Fixes

**Feature**: [`064-fix-csp-oauth-a11y`](./spec.md)  
**Date**: 2026-08-23  

---

## 1. Automated Quality Gate Verification

Execute the standard validation commands defined in the project constitution:

```powershell
# 1. Type check
npm run lint

# 2. Test suite
npm test

# 3. Build verification
npm run build
```

---

## 2. Manual & Functional Validation Scenarios

### Scenario A: Verify CSP Security Headers in Production
1. Run the test suite for security headers:
   ```powershell
   npx vitest run server/__tests__/securityHeaders.test.ts
   ```
2. Verify that `connect-src` contains `https://oauth2.googleapis.com` and `https://www.googleapis.com`.

### Scenario B: Verify External Theme Initialization Script
1. Start the production server or dev server:
   ```powershell
   npm run dev
   ```
2. Open the application in a browser.
3. Verify `/theme-init.js` loads with HTTP 200 and sets `data-theme` on `document.documentElement` without console errors.
4. Verify no `script-src-elem` violation occurs.

### Scenario C: Verify Google Sync Modal Accessibility
1. In the web application, open the **Google Drive Sync** modal.
2. Expand the **Nâng cao (Tùy chỉnh thông tin xác thực)** drawer.
3. Click on the label **"OAuth Client ID"** -> Confirm focus shifts to the Client ID input.
4. Click on the label **"Picker API Key"** -> Confirm focus shifts to the Picker API Key input.
5. In Chrome DevTools Elements panel, inspect both inputs to verify matching `id` and `htmlFor` attributes.
