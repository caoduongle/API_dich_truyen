# Research & Architecture Decisions: Zero-Knowledge Session Sync

**Feature Directory**: `specs/060-zero-knowledge-session-sync`  
**Feature Branch**: `060-zero-knowledge-session-sync`  

---

## 1. Technical Context & Security Problem

### Current Deficiencies Identified
1. **Raw Key Transmission During Session Sync**: `useAIConfig.ts` triggers `syncSessionKeysToServer(apiKeys)`, sending plaintext API keys to `/api/session-keys` automatically whenever keys are entered or modified.
2. **Server-Side AES Encryption Complexity & Fallback Exposure**: `sessionStore.ts` encrypted keys with AES-256-GCM using `ENCRYPTION_MASTER_KEY || SESSION_SECRET || "default_dev_master_key_for_session_encryption_only"`. If the environment variable was omitted, production ran with a public fallback key.
3. **Redundant Server Relay for AI Operations**: Model listing (`models-for-key`), model validation (`verify-model`), and simple term translation (`quick-translate-term`) were channeled through server endpoints, requiring raw key availability on the backend.
4. **Quota Tracking**: `quotaService.ts` only requires stable key hashes for tracking counters; it never executes Gemini API requests directly.

---

## 2. Architecture & Design Decisions

### Decision 1: Client-Side SHA-256 Hash Generation for Session Sync
- **Decision**: Client computes SHA-256 hex string (`crypto.subtle.digest`) on `key.trim()` using browser Web Crypto API and transmits `{ keyHashes: string[] }` to `POST /api/session-keys`.
- **Rationale**:
  - SHA-256 is a one-way cryptographic hash function. Even under total server compromise, plaintext API keys cannot be recovered.
  - Preserves session token lifecycle, sliding-window expiration, and automatic resynchronization without exposing raw credentials.
- **Alternatives Considered**:
  - *Asymmetric public-key encryption to server*: Rejected because the server would still have the private key to decrypt, violating zero-knowledge principles.
  - *Deleting session sync entirely*: Rejected because rate-limiting, custom RPM tracking, and quota indexing require server session correlation.

### Decision 2: Elimination of AES-256-GCM Layer in `sessionStore.ts`
- **Decision**: Remove `encryptApiKeys`, `decryptApiKeys`, `decryptApiKeysWithStatus`, and `ENCRYPTION_MASTER_KEY`. Store `keyHashes` directly in Redis and memory.
- **Rationale**:
  - SHA-256 hashes of high-entropy API keys (30–100+ chars) are already one-way irreversible strings. Adding AES encryption over hashes adds architectural complexity and configuration risk without security benefit.
- **Validation Rule**: Strict server validation with regex `/^[0-9a-f]{64}$/` for every item in `keyHashes`.

### Decision 3: Client-Direct Model Discovery, Verification, and Quick Translation
- **Decision**:
  - `listModelsDirect(apiKey)` and `verifyModelDirect(apiKey, modelId)` implemented in `src/services/directGeminiClient.ts`.
  - `QuickAddTermModal.tsx` calls `callGeminiDirect` using a shared prompt builder.
  - Server endpoints `/api/models-for-key`, `/api/verify-model`, and `/api/quick-translate-term` decommissioned.
- **Rationale**: Direct browser-to-Gemini connection eliminates raw key transit through application backend.

### Decision 4: Ephemeral Middleware for Multi-Stage Glossary Processing
- **Decision**: For remaining complex server processing (`analyze-glossary`, `analyze-guidelines`, `extract-glossary`, `align-chapter`), use `requireEphemeralApiKeys`.
- **Rationale**:
  - Allows chunked/multi-step analysis without risking regression on large files.
  - Keys exist exclusively in request scope memory and are discarded immediately upon request completion (zero session/Redis persistence).
  - Explicit client opt-in via `apiFetch(url, { allowApiKeysInBody: true })` ensures keys are stripped from all other API requests.

---

## 3. Risk Assessment & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Historical quota stats mismatch | Medium | Low | Make `quotaService.ts` `hashApiKey` idempotent: if input matches `/^[0-9a-f]{64}$/`, return as-is. |
| Double-hashing on client or server | Low | Medium | Client hashes once before dispatch; server checks 64-char hex format and avoids re-hashing. |
| Token refresh race conditions | Low | Low | Existing `registerSessionSyncCallback` and retry in `apiClient.ts` handles transparent 401 re-sync. |
