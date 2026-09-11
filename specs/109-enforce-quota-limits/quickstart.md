# Quickstart Validation Guide: Enforce Personal Quota Limits & Smart Key Selection

**Feature**: `109-enforce-quota-limits`  
**Date**: 2026-09-11  

---

## 1. Prerequisites

- Node.js 18+ installed
- Dependencies installed: `npm install`
- Working repository with tests: `npm test`

---

## 2. Automated Test Verification

### 2.1 Run Quota & Key Selection Unit Tests
```bash
# Run unit tests covering localQuotaTracker and directGeminiClient
npm test src/services/__tests__/directGeminiClient.test.ts
npm test src/services/__tests__/clientKeyRotation.test.ts
```

**Expected Outcome**:
- All tests pass cleanly.
- Tests verify:
  1. Setting `maxRpd: 5` on Key #1 causes `callGeminiDirect` to bypass Key #1 once 5 requests are recorded.
  2. Bypassing Key #1 does NOT call `fetch` for Key #1 and does NOT increment Key #1's `errorsTotal`.
  3. Key #2 immediately fulfills requests without retry penalties.
  4. When all keys reach their personal limits, `ALL_KEYS_EXHAUSTED` is thrown with 0 HTTP network calls dispatched.

### 2.2 Quality Gates Check (Constitution Principle I)
```bash
# 1. Type check
npm run lint

# 2. Complete test suite run
npm test

# 3. Production build
npm run build
```

**Expected Outcome**:
- `npm run lint` (`tsc --noEmit`): 0 errors.
- `npm test`: 100% tests pass.
- `npm run build`: Vite frontend and esbuild server build successfully.

---

## 3. Manual Browser Verification Flow

1. **Launch Dev Server**:
   ```bash
   npm run dev
   ```
2. **Open Quota & AI Settings**:
   - Open browser at `http://localhost:5173`.
   - Click "Cấu hình AI & Quota" modal.
   - Configure at least 2 Gemini API keys.
3. **Set Custom Personal Limit**:
   - In "Cấu hình Ngưỡng Hạn ngạch (Custom Limits)", set Khóa #1: `Max RPD = 2`.
4. **Execute Translation Tasks**:
   - Trigger 2 small chapter translations.
   - Observe Khóa #1 handling requests 1 and 2 (`2 / 2`).
   - Trigger the 3rd chapter translation.
5. **Verify Enforcement & UI**:
   - Observe that request 3 is automatically routed to Khóa #2.
   - Khóa #1 has **0 errors**, not 90 errors!
   - Retries count does **not** spike.
   - The UI displays Khóa #1 with a clear "Đạt ngưỡng ngày" badge without triggering network failure alerts.
