# Research & Architectural Decisions: Remove Server Fallback & Enforce Personal API Keys

**Feature Directory**: `specs/050-remove-server-fallback`
**Date**: 2026-08-22

---

## 1. Context & Problem Statement

In previous versions, the backend server supported an optional `ALLOW_SERVER_KEY_FALLBACK=true` configuration and fell back to `process.env.GEMINI_API_KEY` when a user had not configured personal API keys. 

While convenient for demos, this architecture:
1. Contradicts the strict privacy commitment in [`docs/privacy-policy.md`](../../docs/privacy-policy.md) ("Server không nhận, không xử lý, và không lưu trữ bất kỳ nội dung nào trong số này").
2. Creates an unmetered resource cost on the central server.
3. Imposes server-wide concurrency bottlenecks (`MAX_CONCURRENT_REQUESTS = 50`) on uncredentialed users.

Now that **Direct Client Translation** (`specs/049-direct-client-translation`) has established direct browser-to-Gemini REST capabilities, we can completely eliminate the server fallback translation mechanism and enforce that 100% of translation operations require personal API keys.

---

## 2. Decision Log

### Decision 1: Complete Elimination of `ALLOW_SERVER_KEY_FALLBACK`
- **Decision**: Deprecate and remove `ALLOW_SERVER_KEY_FALLBACK` from `server/routes/api.ts`, `server/services/geminiService.ts`, and `.env.example`.
- **Rationale**: Any request reaching the server without valid client credentials (either via `x-session-token` or direct `apiKeys`) will be immediately rejected with `HTTP 400 Bad Request` and an explicit error message prompting the user to configure their own Gemini API key.
- **Alternatives Considered**:
  - *Keep fallback behind an admin toggle*: Rejected because privacy policy commitments apply globally.

### Decision 2: UI Guard & No-Key Notification Strategy
- **Decision**: Update `TranslatorWorkspace.tsx`, `AutoTranslator.tsx`, `App.tsx`, and `useTranslationProcess.ts` so that:
  - Header displays a clear warning/badge when 0 keys are configured.
  - Translation buttons (`Translate`, `Auto-translate`, `Scan Glossary`) check for valid personal keys and immediately open the API Settings modal or trigger a toast if no keys are found.
  - `chapterTranslationService.ts` immediately halts and throws an error if called with empty keys, without attempting any fallback server network call.
- **Rationale**: Intercepting missing keys on the client prevents unnecessary network round-trips and provides instantaneous user feedback.

### Decision 3: Audit of Server Quota & Rotation Code
- **Decision**: Evaluate `server/services/quotaService.ts`, `geminiService.ts`, and `quotaController.ts`:
  - `quotaService.ts`: RETAIN. It provides metrics, rate calculations, and health tracking for server-side utilities (e.g. `/api/quota-status`, `/api/models-for-key`, `/api/verify-model`) when users authenticate via `SessionStore`.
  - `geminiService.ts`: RETAIN core rotation logic for server utility endpoints, but remove the fallback `process.env.GEMINI_API_KEY || ""` line so it strictly requires client-provided keys.
  - Server translation endpoints (`/api/translate-raw`, `/api/polish-translation`, `/api/qa-critique`): RETAIN with strict `resolveApiKeysMiddleware` validation (returning 400 if keys are missing).
- **Rationale**: Keeps server utilities functional for authenticated users while ensuring zero uncredentialed translation processing.

---

## 3. Impact Assessment

| Component | Nature of Change | Breaking? | Notes |
|---|---|---|---|
| `server/routes/api.ts` | Remove `ALLOW_SERVER_KEY_FALLBACK` checks | Yes (for users without keys) | Rejects uncredentialed requests with HTTP 400 |
| `server/services/geminiService.ts` | Remove fallback to `process.env.GEMINI_API_KEY` | Yes (for users without keys) | Requires `apiKeys` array with >= 1 key |
| `src/services/chapterTranslationService.ts` | Remove server fallback branch | Yes (for users without keys) | Throws client error if `apiKeys` is empty |
| `src/components/TranslatorWorkspace.tsx` | Switch manual translation to direct engine | No | Bypasses server, faster & private |
| `src/hooks/useTranslationProcess.ts` | Add pre-flight key check in `handleToggleProcessing` | No | Blocks execution with warning toast |
| `.env.example` | Remove `ALLOW_SERVER_KEY_FALLBACK` | No | Documentation update |
| `docs/api.md`, `README.md` | Update architecture & privacy notes | No | Documentation sync |
