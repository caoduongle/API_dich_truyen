# Quickstart Validation Guide: Security & Reliability Hardening

**Feature**: [spec.md](./spec.md) | **Branch**: `154-security-reliability-hardening`

This guide outlines runnable verification procedures to validate that the Phase 1 hardening fixes operate correctly end-to-end.

---

## Prerequisites

- Node.js 20+ installed
- Working directory: Repository root (`e:\tailieuhoctap\laptrinhnangcao\th\merged`)
- Dependencies installed (`npm install`)

---

## Verification Scenarios

### 1. In-Memory Key Cache & Ephemeral Storage Audit

**Objective**: Verify that `hashApiKey` does not populate raw keys into `keyHashCache` and `rememberKeys` defaults to `false`.

**Run Command**:
```bash
npx vitest run src/utils/__tests__/apiKeyHash.test.ts src/utils/__tests__/storageAudit.test.ts src/hooks/__tests__/useAIConfig.test.ts
```

**Expected Outcome**:
- `keyHashCache.size` remains `0` after multiple `hashApiKey('AIzaSyExampleKey')` calls.
- `useAIConfig` defaults `rememberKeys` to `false` when `localStorage` has no pre-existing preferences.
- `localStorage['app_ui_prefs']` contains no `savedKeys` unless `rememberKeys` was explicitly enabled.

---

### 2. Model Discovery Timeout & Cancellation Test

**Objective**: Verify that `listModelsDirect` aborts after the designated timeout (15s default, or customized).

**Run Command**:
```bash
npx vitest run src/services/__tests__/directGeminiClient.test.ts
```

**Expected Outcome**:
- Simulated stalled fetch requests abort with a descriptive timeout error.
- Providing an external `AbortSignal` cancels the request immediately.

---

### 3. Structured AI Response Parsing Resilience

**Objective**: Verify that `parseGeminiStructuredResponse` safely handles markdown code fences, malformed formatting, and schema validation failures.

**Run Command**:
```bash
npx vitest run src/lib/__tests__/text.test.ts
```

**Expected Outcome**:
- Markdown wrapped JSON (````json {"terms": []} ````) is cleanly parsed without exception.
- Unparseable strings return the provided fallback value or throw a contextual error rather than a raw V8 SyntaxError.

---

### 4. Build Configuration & Mode Verification

**Objective**: Verify that production builds respect `mode === 'production'` and restricted environment variable loading.

**Run Command**:
```bash
npm run build
```

**Expected Outcome**:
- Vite build completes with exit code 0.
- Production assets have `console.log` and `debugger` statements stripped.

---

### 5. Full Quality Gate Verification

**Objective**: Verify the entire test suite and TypeScript types remain clean without regressions.

**Run Commands**:
```bash
npm run lint
npm test
npm run build
```

**Expected Outcome**:
- `npm run lint` (`tsc --noEmit`): 0 errors.
- `npm test` (`vitest run`): All test suites pass.
- `npm run build`: Production bundle builds successfully.
