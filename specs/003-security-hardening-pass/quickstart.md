# Quickstart & Validation Guide: Security Hardening Pass

**Feature**: `003-security-hardening-pass`
**Date**: 2026-08-19

This guide describes how to validate all 9 security hardening requirements end-to-end.

---

## 1. Prerequisites & Environment Setup

Ensure test environment has dependencies installed:
```bash
npm install
```

---

## 2. Automated Test Suite

Run all unit and integration tests across backend controllers, services, middleware, and utils:
```bash
npm test
```

### Specific Security Tests to Run
```bash
# 1. Test Logger secret redaction
npx vitest run server/utils/__tests__/logger.test.ts

# 2. Test Input sanitization & Prompt framing
npx vitest run server/utils/__tests__/text.test.ts

# 3. Test Rate Limiter (General & Login-specific)
npx vitest run server/middleware/__tests__/rateLimiter.test.ts

# 4. Test SessionStore (Memory & Redis Active Count)
npx vitest run server/controllers/__tests__/sessionController.test.ts

# 5. Test POST Request Body Validation
npx vitest run server/controllers/__tests__/authController.test.ts
npx vitest run server/controllers/__tests__/translationController.test.ts
```

---

## 3. Type Safety & Production Build

Ensure zero TypeScript type errors and successful build:
```bash
npm run lint    # tsc --noEmit
npm run build   # vite build + esbuild server.ts
```

---

## 4. Production Content Security Policy (CSP) & Real Browser Verification

1. Start the production server:
   ```bash
   NODE_ENV=production PORT=3000 npm run start
   ```
2. Open the application in a browser: `http://localhost:3000`
3. Open Browser Developer Tools (`F12`) -> **Console** tab.
4. Execute key user workflows:
   - Perform a translation (or load existing chapters from database).
   - Open Glossary management and extract terms.
   - Test Exporting files (TXT / Web format / ZIP).
5. **Verify**: The console must report **0 Content-Security-Policy violation errors**.
6. Check response headers using `curl` or Network tab:
   ```bash
   curl -I http://localhost:3000
   ```
   Confirm `Content-Security-Policy` contains `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.

---

## 5. CI/CD & DevSecOps Verification

1. Verify security audit:
   ```bash
   npm audit --audit-level=high
   ```
2. Inspect `.github/workflows/ci.yml`:
   - Contains `permissions: contents: read`.
   - Actions pinned by 40-character commit SHAs.
   - Includes `npm audit` and secret scan steps.
3. Inspect `.github/dependabot.yml`:
   - Configured for `npm` and `github-actions`.
4. Inspect `SECURITY.md`:
   - Contains GitHub Security Advisories reporting workflow and deployment checklist.
