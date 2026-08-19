# Quickstart & Verification Guide: Fix Security Consistency

**Feature**: `006-fix-security-consistency`  
**Date**: 2026-08-19  

## Prerequisites
- Node.js installed in environment
- Dependencies installed (`npm install`)

---

## 1. Automated Verification Commands

### Step 1: Type Checking
```bash
npm run lint
```
*Expected Result*: Clean execution with 0 type errors.

### Step 2: Unit & Integration Tests
```bash
npm test
```
*Expected Result*: 100% test suites pass, including new test cases for `authMiddleware` pseudo-route blocking and `geminiService` error message redaction.

### Step 3: Production Build
```bash
npm run build
```
*Expected Result*: Vite frontend build and esbuild server build complete successfully.

---

## 2. Targeted Verification Scenarios

### Scenario 1: Verify Zero `console.*` in Controllers
Run ripgrep in `server/controllers`:
```bash
npx ripgrep "console\.(log|warn|error)" server/controllers
```
*Expected Result*: 0 matches found.

### Scenario 2: Verify `ALL_KEYS_EXHAUSTED` Redacts Secret
Run targeted vitest on Gemini service test:
```bash
npx vitest run server/services/__tests__/geminiService.test.ts
```
*Expected Result*: Test passes, asserting that keys in `keysToTry` are redacted in the final aggregated error string.

### Scenario 3: Verify Auth Middleware Blocks Suffix Spoofing
Run targeted vitest on Auth controller/middleware test:
```bash
npx vitest run server/controllers/__tests__/authController.test.ts
```
*Expected Result*: Test passes, confirming `/api/fake/health`, `/x/auth/login`, and `/something/auth/status` are blocked with 401.
