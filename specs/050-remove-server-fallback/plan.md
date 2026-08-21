# Implementation Plan: Remove Server Translation Fallback & Enforce Personal API Keys

**Feature Directory**: `specs/050-remove-server-fallback`
**Date**: 2026-08-22

---

## 1. Technical Context

- **Problem**: Previous versions permitted `ALLOW_SERVER_KEY_FALLBACK=true` where uncredentialed users could translate through the server's default `GEMINI_API_KEY`. This violates the strict privacy guarantee in [`docs/privacy-policy.md`](../../docs/privacy-policy.md), consumes unmetered server compute/concurrency, and creates shared bottlenecks.
- **Solution**: Completely remove server fallback translation, mandate personal API keys across the UI, and ensure client-side translation dispatches 100% directly to Google Gemini REST API.
- **Breaking Change**: Users without a personal Gemini API key will no longer be able to translate until they obtain and input their own free/paid API key in the settings modal.

---

## 2. Constitution Check

- [x] **Principle I (Quality Gates)**: `npm run lint`, `npm test`, and `npm run build` must pass cleanly.
- [x] **Principle II (Dependency Minimization)**: No new NPM packages added.
- [x] **Principle III (Domain Separation)**: Backend and frontend changes are strictly scoped to removing server fallback and enforcing personal key validation.
- [x] **Principle IV (Core Schemas)**: `src/types.ts` and IndexedDB schemas remain unchanged.
- [x] **Principle V (Review-Driven Development)**: Full itemized list of files to be modified/deleted provided for review prior to implementation.

---

## 3. Dead Code Evaluation & Server Architecture Audit

| File / Component | Role Before Change | Impact of Change | Evaluation & Recommendation |
|---|---|---|---|
| `server/routes/api.ts` (`resolveApiKeysMiddleware`) | Checked `ALLOW_SERVER_KEY_FALLBACK` and allowed requests with 0 keys | Remove fallback check; reject uncredentialed requests with 400 | **MODIFY**: Remove fallback logic, strictly require client keys. |
| `server/services/geminiService.ts` | Defaulted to `[process.env.GEMINI_API_KEY || ""]` if `apiKeys` empty | Remove `GEMINI_API_KEY` fallback; require `apiKeys.length > 0` | **MODIFY**: Remove fallback line. |
| `server/services/quotaService.ts` | Quota scheduler, PST clock, per-key RPM/TPM sliding windows | Still used by `/api/quota-status`, `/api/models-for-key`, `/api/verify-model` for authenticated users | **RETAIN**: Not dead code; required for server utility endpoints. |
| `server/controllers/quotaController.ts` | Handles `/api/quota-status` and quota group inspection | Requires client keys; returns quota stats for user keys | **RETAIN**: Still active for personal key monitoring. |
| `server/controllers/translation/*.ts` (`rawController.ts`, `polishController.ts`, `qaController.ts`) | Server translation endpoints | Now only callable if client explicitly sends personal keys (all uncredentialed requests rejected by middleware) | **RETAIN**: Keep controller logic cleanly using `@shared/prompts`, but protected by middleware. |
| `server/routes/health.ts` (`/api/health`, `/api/ready`, `/api/live`) | Server health and readiness monitoring | Operates independently of translation keys | **RETAIN 100%**: Zero impact on infrastructure monitoring. |
| `.env.example` | Included `ALLOW_SERVER_KEY_FALLBACK=true` | Obsolete config | **MODIFY**: Remove `ALLOW_SERVER_KEY_FALLBACK`. |

---

## 4. Itemized List of Files to Modify / Update

### Backend Files
1. **[MODIFY]** [`server/routes/api.ts`](../../server/routes/api.ts):
   - Update `resolveApiKeysMiddleware` to eliminate `ALLOW_SERVER_KEY_FALLBACK`.
   - Return structured error `400 Bad Request` with `NO_PERSONAL_API_KEY_CONFIGURED` when no client keys are provided.
2. **[MODIFY]** [`server/services/geminiService.ts`](../../server/services/geminiService.ts):
   - Remove fallback to `process.env.GEMINI_API_KEY`.
   - Throw explicit error if `apiKeys` is empty.
3. **[MODIFY]** [`.env.example`](../../.env.example):
   - Remove `ALLOW_SERVER_KEY_FALLBACK` documentation and environment variable.

### Frontend Files
4. **[MODIFY]** [`src/services/chapterTranslationService.ts`](../../src/services/chapterTranslationService.ts):
   - Remove server fallback branch (`apiFetch('/api/translate-raw')`, etc.).
   - If `apiKeys` is empty, throw clear client error immediately without sending network requests.
5. **[MODIFY]** [`src/components/TranslatorWorkspace.tsx`](../../src/components/TranslatorWorkspace.tsx):
   - Update `handleTranslateRaw` and `handlePolish` in single-chapter manual mode to use `translateRawDirect` and `polishTranslationDirect` from `directTranslationEngine.ts`.
   - Pre-flight validate `apiKeys` before analyzing glossary or starting translation.
6. **[MODIFY]** [`src/hooks/useTranslationProcess.ts`](../../src/hooks/useTranslationProcess.ts):
   - In `handleToggleProcessing`, add immediate check for `apiKeys`: show toast notification and block processing if no keys exist.
7. **[MODIFY]** [`src/hooks/useGlossaryScan.ts`](../../src/hooks/useGlossaryScan.ts):
   - In `handleAutoExtractGlossary`, check for `apiKeys` before scanning.
8. **[MODIFY]** [`src/components/ApiSettings.tsx`](../../src/components/ApiSettings.tsx):
   - Update empty key message to emphasize personal key requirement for privacy and zero server storage.
9. **[MODIFY]** [`src/App.tsx`](../../src/App.tsx):
   - Update header label to show key count or warning icon when 0 keys are configured.

### Documentation & Test Files
10. **[MODIFY]** [`docs/api.md`](../../docs/api.md):
    - Update authentication and translation endpoints section to reflect that personal keys are strictly required.
11. **[MODIFY]** [`README.md`](../../README.md):
    - Remove server fallback mentions; highlight 100% direct client translation and zero server storage.
12. **[MODIFY]** [`src/services/__tests__/chapterTranslationService.test.ts`](../../src/services/__tests__/chapterTranslationService.test.ts):
    - Update unit test: verifying that empty `apiKeys` rejects with personal key error instead of calling `apiFetch`.

---

## 5. Verification Plan

### Automated Testing
- `npm run lint` (`tsc --noEmit`) to verify 0 type errors.
- `npm test` (`vitest run`) to verify all 76+ test files pass.
- `npm run build` (`vite build` + esbuild server) to verify production build.

### Manual Verification
- Launch application with 0 keys -> verify clear warning, verify translation is blocked.
- Add personal key -> verify direct translation works smoothly with 0 server translation calls.
- Send uncredentialed curl request to `/api/translate-raw` -> verify HTTP 400 rejection.
