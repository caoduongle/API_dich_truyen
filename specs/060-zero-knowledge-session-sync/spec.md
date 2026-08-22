# Feature Specification: Zero-Knowledge Session Sync

**Feature Directory**: `specs/060-zero-knowledge-session-sync`  
**Feature Branch**: `060-zero-knowledge-session-sync`  
**Created**: 2026-08-22  
**Status**: DRAFT  

---

## 1. Executive Summary & Objective

### Objective
Eliminate transmission and storage of user raw API keys (plaintext) on the application's backend server, while **preserving the session-sync mechanism** (`POST /api/session-keys`, `X-Session-Token` header, sliding-window TTL, automatic 401 resynchronization, and revocation).

### Key Architectural Shifts
1. **Zero-Knowledge Sync Payload**: The browser transforms user API keys into one-way cryptographic SHA-256 hashes (`keyHashes`) using client-side Web Crypto (`crypto.subtle.digest`) before transmitting to `/api/session-keys`.
2. **Simplified Server Session Store**: Server validates strict 64-character lowercase hex format (`/^[0-9a-f]{64}$/`) and stores hashes directly in session memory/Redis without AES-256-GCM encryption layers, removing `ENCRYPTION_MASTER_KEY` and public fallback risks.
3. **Client-Direct Operations**: Model listing (`models-for-key`), model verification (`verify-model`), and quick term translation (`quick-translate-term`) transition to direct browser-to-provider requests (`generativelanguage.googleapis.com` via `x-goog-api-key`).
4. **Ephemeral Middleware for Complex Processing**: Multi-part glossary analysis and chapter alignment routes (`analyze-glossary`, `analyze-guidelines`, `extract-glossary`, `align-chapter`) transition to `requireEphemeralApiKeys` (keys exist solely in request memory for the duration of execution, never persisted in session store or Redis).
5. **Hash-Based Quota Tracking**: `quotaService.ts` operates on `keyHashes` with idempotent SHA-256 hashing; key masking is formatted client-side.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1: Zero-Knowledge Session Synchronization (Priority: P1) 🎯 MVP
**As a** privacy-conscious translator,  
**I want** my API key credentials to never be transmitted or stored in plaintext or reversible form on the application server during session synchronization,  
**So that** even if the application server is fully compromised, my private API keys cannot be recovered.

#### Acceptance Scenarios:
1. **Session Key Hash Sync**: When API keys are saved or modified in the client, `syncSessionKeysToServer` computes SHA-256 hex hashes client-side and transmits `{ keyHashes: string[] }` to `POST /api/session-keys`.
2. **Strict Hex Hash Validation**: The server validates that each element in `keyHashes` matches `/^[0-9a-f]{64}$/`, rejecting malformed or plaintext keys with HTTP 400.
3. **Session Store Persistence**: The server stores `keyHashes` without AES encryption, maintaining existing sliding-window TTL, token validation, and deletion behaviors.
4. **Automatic 401 Re-sync**: When a request returns HTTP 401 due to expired session token, `apiClient.ts` automatically re-hashes client-stored keys, establishes a fresh session token, and retries the failed request.
5. **Hash-Based Quota Status**: `fetchQuotaStatus` sends `keyHashes` to `/api/quota-status`; server tracks usage metrics by hash, while `QuotaPanel` formats key masks locally for display.

---

### User Story 2: Client-Direct AI Verification & Simple Term Translation (Priority: P1)
**As a** user configuring AI models and translating terms,  
**I want** model discovery, verification, and quick term translations to connect directly from my browser to Gemini,  
**So that** no API keys travel through application backend endpoints for these frequent operations.

#### Acceptance Scenarios:
1. **Direct Model Discovery**: Fetching models for an API key (`listModelsDirect`) calls `GET https://generativelanguage.googleapis.com/v1beta/models` directly with `x-goog-api-key`.
2. **Direct Model Verification**: Verifying model access (`verifyModelDirect`) executes a minimal prompt directly against Gemini, classifying permission and availability client-side.
3. **Direct Quick Term Translation**: `QuickAddTermModal` executes `callGeminiDirect` using a shared prompt builder, bypassing the `/api/quick-translate-term` server route.
4. **Backend Route Decommissioning**: Legacy `/api/models-for-key` and `/api/verify-model` server endpoints are removed or deprecated.

---

### User Story 3: Ephemeral Request Middleware for Complex Glossary Analysis (Priority: P2)
**As a** translator running glossary analysis on large files,  
**I want** complex analysis requests to use transient in-memory keys only when processing that specific request,  
**So that** my keys are never stored in any session cache or Redis database.

#### Acceptance Scenarios:
1. **Ephemeral Middleware**: Routes requiring server processing (`analyze-glossary`, `analyze-guidelines`, `extract-glossary`, `align-chapter`) employ `requireEphemeralApiKeys`, reading keys only from `req.body.apiKeys` and discarding them immediately upon request completion.
2. **Explicit Client Opt-In**: `apiClient.ts` automatically strips `apiKeys` from request bodies by default; only authorized calls with `allowApiKeysInBody: true` transmit ephemeral keys.

---

### User Story 4: Security Hardening & Documentation Truth (Priority: P2)
**As an** auditor or developer,  
**I want** configuration files, privacy policies, and security guides to accurately reflect the zero-knowledge session architecture,  
**So that** documentation and code behavior are 100% aligned with zero discrepancies.

#### Acceptance Scenarios:
1. **Environment Configuration Cleanup**: `ENCRYPTION_MASTER_KEY` and unused `SESSION_SECRET` references are removed from `.env.example` and server code.
2. **Documentation Accuracy**: `docs/privacy-policy.md` and `SECURITY.md` accurately document the zero-knowledge hash sync architecture and the temporary ephemeral status of complex glossary routes.

---

## 3. Functional Requirements

- **FR-001**: `src/utils/apiClient.ts` MUST compute SHA-256 hex digest (`crypto.subtle.digest`) on `key.trim()` before sending to `POST /api/session-keys` as `{ keyHashes: string[] }`.
- **FR-002**: `server/services/sessionStore.ts` MUST store `keyHashes: string[]` directly without AES encryption, and MUST remove all decryption, master key resolution, and encryption helper functions.
- **FR-003**: `server/utils/validation.ts` MUST validate each `keyHashes` item against `/^[0-9a-f]{64}$/`.
- **FR-004**: `server/controllers/sessionController.ts` MUST operate exclusively on `keyHashes`.
- **FR-005**: `server/services/quotaService.ts` `hashApiKey(input)` MUST be idempotent (if input is already 64-char hex, return input as-is).
- **FR-006**: `server/controllers/quotaController.ts` MUST accept `keyHashes` in request body and return quota records indexed by `keyHash`.
- **FR-007**: `src/components/QuotaPanel.tsx` MUST compute key masking client-side and match server responses by `keyHash`.
- **FR-008**: `src/services/directGeminiClient.ts` MUST provide `listModelsDirect(apiKey)` and `verifyModelDirect(apiKey, modelId)`.
- **FR-009**: Quick term translation in `QuickAddTermModal.tsx` MUST execute client-direct via `callGeminiDirect` with shared prompt logic.
- **FR-010**: `server/routes/api.ts` MUST replace `resolveApiKeysMiddleware` with `requireEphemeralApiKeys` on `analyze-glossary`, `analyze-guidelines`, `extract-glossary`, and `align-chapter`.
- **FR-011**: `src/utils/apiClient.ts` `apiFetch` MUST strip `apiKeys` by default unless `allowApiKeysInBody: true` is explicitly provided.
- **FR-012**: `docs/privacy-policy.md`, `SECURITY.md`, and `.env.example` MUST be updated to remove legacy master key references and document current zero-knowledge session guarantees.

---

## 4. Success Criteria

- **SC-001 (Zero Key Leaks)**: Inspecting browser Network tab during full workflow (key input, translation, model verify, quota check, quick term translate) reveals **zero** occurrences of raw API key strings in requests to the app domain (outside of explicit ephemeral analysis calls).
- **SC-002 (Zero Encryption Residue)**: `grep` across `server/services/sessionStore.ts` and `server/controllers/sessionController.ts` returns zero matches for `apiKeys`, `ENCRYPTION_MASTER_KEY`, `encryptApiKeys`, or `decryptApiKeys`.
- **SC-003 (Session Continuity)**: User session token authentication, sliding-window expiration, and automatic 401 retry resynchronization work with 100% reliability.
- **SC-004 (Quality Gates)**: 100% pass on `npm run lint`, `npm test`, and `npm run build`.

---

## 5. Scope Boundaries

- **In Scope**:
  - Transitioning session sync payload to SHA-256 hashes.
  - Removing AES session encryption and master key fallbacks.
  - Client-direct model discovery, model verification, and quick term translation.
  - Ephemeral in-memory handling for remaining complex server routes.
  - Hash-based quota status calculation and client-side masking.
  - Updating security documentation and `.env.example`.
- **Out of Scope**:
  - Full client-side porting of multi-stage chunked glossary extractors (`glossaryController.ts` 593 lines) — deferred to follow-up spec.
  - Altering core translation prompt engineering or CRDT real-time sync mechanisms.
