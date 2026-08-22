# Implementation Plan: Zero-Knowledge Session Sync

**Feature Directory**: `specs/060-zero-knowledge-session-sync`  
**Feature Branch**: `060-zero-knowledge-session-sync`  
**Spec**: [`specs/060-zero-knowledge-session-sync/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/060-zero-knowledge-session-sync/spec.md)  

---

## 1. Plan Overview & Summary

This feature eliminates the transmission and storage of raw plaintext user API keys on the application's backend server, replacing them with client-side SHA-256 hashes (`keyHashes`) for session tracking, sliding-window TTL, and quota indexing.

Key operations (model listing, verification, and quick term translation) are ported to client-direct browser requests to Gemini (`generativelanguage.googleapis.com`), while complex multi-step glossary analysis endpoints adopt ephemeral in-memory processing (`requireEphemeralApiKeys`) with explicit client opt-in.

---

## 2. Proposed Changes by Phase

### Phase 1: Core Session Sync Transition to SHA-256 Hashes
- **`src/utils/apiClient.ts`**:
  - Implement `sha256Hex(text: string): Promise<string>` using `crypto.subtle.digest`.
  - Update `syncSessionKeysToServer(keys: string[])` to compute hashes and send `{ keyHashes: string[] }`.
  - Update `apiFetch` to strip `apiKeys` by default unless `allowApiKeysInBody: true`.
- **`server/services/sessionStore.ts`**:
  - Remove `encryptApiKeys`, `decryptApiKeys`, `decryptApiKeysWithStatus`, `SessionDecryptionError`, `getEncryptionKey`, and `ENCRYPTION_SALT`.
  - Store `keyHashes: string[]` in `SessionData` without AES encryption.
  - Add strict hex validation `/^[0-9a-f]{64}$/` in `createSession`.
  - Rename `getSessionKeys` to `getSessionKeyHashes` with clear semantics.
- **`server/utils/validation.ts`**:
  - Update `validateSessionKeysBody` to validate array of 64-char hex strings.
- **`server/controllers/sessionController.ts`**:
  - Update handlers to operate on `keyHashes`.

### Phase 2: Hash-Based Quota Status & Client Masking
- **`server/services/quotaService.ts`**:
  - Make `hashApiKey(input: string)` idempotent (returns input immediately if already matching `/^[0-9a-f]{64}$/`).
  - Update `maskApiKey(input: string)` to safely format hashes or raw keys.
- **`server/controllers/quotaController.ts`**:
  - Accept `keyHashes` in request body and return quota records indexed by `keyHash`.
- **`src/utils/apiClient.ts`**:
  - Update `fetchQuotaStatus` to compute hashes before dispatching `{ keyHashes }`.
- **`src/components/QuotaPanel.tsx`**:
  - Compute key masking client-side using local keys and map with server quota snapshots.

### Phase 3: Client-Direct Model Discovery, Verification & Quick Term Translation
- **`src/services/directGeminiClient.ts`**:
  - Add `listModelsDirect(apiKey: string): Promise<ModelInfoItem[]>`.
  - Add `verifyModelDirect(apiKey: string, modelId: string): Promise<VerifyModelResponse>`.
- **`src/utils/apiClient.ts`**:
  - Update `fetchModelsForKey` and `verifyModel` to delegate to `listModelsDirect` and `verifyModelDirect`.
- **`src/components/translator-workspace/QuickAddTermModal.tsx`**:
  - Replace server `/api/quick-translate-term` fetch with `callGeminiDirect` using shared prompt formatting.
- **`server/routes/api.ts`**:
  - Remove or deprecate server endpoints `/api/models-for-key`, `/api/verify-model`, and `/api/quick-translate-term`.

### Phase 4: Ephemeral Middleware & Safe Transport for Complex Glossary Routes
- **`server/routes/api.ts`**:
  - Create `requireEphemeralApiKeys` middleware and replace `resolveApiKeysMiddleware` on `analyze-glossary`, `analyze-guidelines`, `extract-glossary`, and `align-chapter`.
- **`src/components/TranslatorWorkspace.tsx`**, **`src/components/ProjectFormModal.tsx`**, **`src/components/GlossaryManager.tsx`**, **`src/hooks/useExportFiles.ts`**, **`src/hooks/useGlossaryScan.ts`**:
  - Explicitly pass `allowApiKeysInBody: true` when calling complex server analysis endpoints.

### Phase 5: Security Hardening, Privacy Policy Alignment & Quality Gates
- **`shared/text.ts` & `server/utils/logger.ts`**:
  - Generalize `redactApiKey` to sanitize OpenAI, Anthropic, and Google API keys.
- **`.env.example` & Documentation**:
  - Remove `ENCRYPTION_MASTER_KEY` and unused `SESSION_SECRET` references.
  - Update `docs/privacy-policy.md` and `SECURITY.md`.
- **Unit & Quality Tests**:
  - Update unit tests in `sessionStore.test.ts`, `credentialStorage.test.ts`, and controller tests.
  - Run `npm run lint`, `npm test`, and `npm run build`.

---

## 3. Verification Plan

- Run `npm run lint` (0 type errors).
- Run `npm test` (all unit test suites pass).
- Run `npm run build` (production build succeeds).
- Execute manual network audit in Chrome DevTools verifying zero raw key leakage on standard API endpoints.
