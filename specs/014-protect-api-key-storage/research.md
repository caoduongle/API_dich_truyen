# Research & Architecture Decisions: Protect API Key Storage & Credential Lifecycle

## Phase 0: Outline & Technical Research

### 1. Threat Model & Security Boundaries

**Context**: In client-server AI applications, API credentials (such as Google Gemini API keys) are sensitive secrets that give full access to LLM inference quotas and billing accounts. Storing credentials insecurely exposes users to multiple attack vectors:

- **Threat T1: Permanent Insecure Client Storage**: Storing plaintext keys in `localStorage` persists data indefinitely across browser restarts and makes keys readable to any script executing in the origin (XSS vulnerability amplifies into persistent credential theft).
- **Threat T2: Routine Payload Exposure**: Sending raw API keys in HTTP request bodies on every translation or polling request exposes keys in browser Network DevTools, intermediate proxies, and server access logs.
- **Threat T3: Response & Error Leakage**: Upstream error responses (from Google API) or quota endpoints echoing raw key strings.
- **Threat T4: URL Query Parameter Leakage**: Passing keys in URLs leads to browser history, referrer header, and server access log exposure.
- **Threat T5: Storage Migration & Deserialization Crashes**: Malformed, empty, or legacy data in storage causing runtime application boot failure.

---

### 2. Architecture Decisions & Trade-offs

#### Decision 1: Ephemeral Client Storage with Tab-Scoped `sessionStorage` & Safe In-Memory Lifecycle
- **Decision**: Replace default permanent `localStorage` storage of `gemini_api_keys` with `sessionStorage` + React in-memory state.
- **Rationale**: 
  - `sessionStorage` limits credential lifespan to the active browser tab session, eliminating permanent disk residue while preserving convenience during active translation sessions (page reloads within the same tab keep keys).
  - Attempting to "encrypt keys in localStorage with a secret also stored in localStorage" is crypto theater that provides zero security against XSS. Moving to ephemeral memory and `sessionStorage` directly reduces the attack surface and credential lifetime.
- **Alternatives Considered**:
  - *Pure in-memory only (no Web Storage at all)*: Forces user to re-type keys on every page refresh, damaging user experience without substantial security gain over `sessionStorage`.
  - *Keep `localStorage` with client-side symmetric encryption*: Rejected because the encryption key would also reside in the browser, failing to solve the XSS threat model.

#### Decision 2: Backend Session Delegation via Cryptographic `SessionToken`
- **Decision**: Retain the opaque UUIDv4 `SessionToken` architecture:
  - User adds/modifies keys in UI -> Browser POSTs `{ apiKeys }` to `/api/session-keys` once.
  - Server stores keys in `SessionStore` (in-memory Map or Redis) with a 24-hour sliding TTL.
  - Backend responds with `{ sessionToken, keyCount, expiresAt }` (never returning plaintext keys).
  - All subsequent API requests (`/api/translate-raw`, `/api/polish-translation`, `/api/quota-status`, etc.) pass `X-Session-Token: <token>`.
  - Client-side `apiFetch` automatically strips `body.apiKeys` from outgoing request bodies if present, preventing dual/redundant transmission.
- **Rationale**:
  - Raw keys are only transmitted once per session change.
  - Server acts as the execution boundary holding the runtime credentials in ephemeral memory/Redis.
  - Eliminates plaintext keys in routine network traffic.
- **Alternatives Considered**:
  - *Send raw API keys on every translation request*: Exposes keys in network dumps and proxies.

#### Decision 3: Backward-Compatible Legacy Data Migration
- **Decision**: Implement a non-destructive startup migration handler in `useAIConfig`:
  1. On boot, inspect `sessionStorage.getItem('gemini_api_keys')`.
  2. If empty, inspect `localStorage.getItem('gemini_api_keys')`.
  3. If legacy data exists:
     - Safely parse JSON with error handling (fall back to empty array if malformed).
     - Filter and sanitize non-empty string keys.
     - If valid keys found, load them into in-memory state, mirror to `sessionStorage`, and purge `localStorage.removeItem('gemini_api_keys')`.
     - If malformed/invalid, immediately remove the invalid item from `localStorage` to heal the storage state.
  4. Automatically synchronize migrated keys to `/api/session-keys`.
- **Rationale**: Existing users upgrade seamlessly without data loss or crashes, while immediately purging the insecure plaintext storage.
- **Alternatives Considered**:
  - *Ignore legacy storage and force re-entry*: Creates poor user experience on upgrade.
  - *Leave legacy keys in localStorage forever*: Defeats the purpose of the security enhancement.

#### Decision 4: Masked Representation for Quota & UI Display
- **Decision**: The backend `quotaService`, `modelInfoService`, and `quotaController` must only return `maskedKey` (e.g. `AIzaSy...1234`) and non-reversible SHA-256 `keyHash`. Plaintext keys are never echoed back in API responses.
- **Rationale**: Allows the Quota Dashboard and Observability UI to identify and track per-key RPM/TPM and health status without ever exposing secret material in responses.
- **Alternatives Considered**:
  - *Full key in responses*: Direct credential exposure.

#### Decision 5: Universal Secret Redaction & Sanitization
- **Decision**:
  - Server structured logger (`server/utils/logger.ts`) sanitizes any substring matching `AIza[0-9A-Za-z-_]{35}`, Bearer tokens, and key/token query parameters.
  - Error handler in `geminiService.ts` and `modelInfoService.ts` wraps upstream error messages with `redactApiKey`.
  - Zero endpoints allow passing API keys as URL query parameters.
- **Rationale**: Prevents accidental leakage in log aggregation systems, terminal outputs, and client alert dialogs.

---

## Technical Context Summary

- **Frontend**: React 19, TypeScript, `sessionStorage` + React Context (`useAIConfig`, `AIConfigContext`, `apiClient.ts`).
- **Backend**: Express.js, TypeScript, `SessionStore` (in-memory / Redis), `QuotaService`, `Logger`.
- **Storage Boundaries**:
  - Client Permanent: No plaintext API keys in `localStorage` (only `gemini_session_token`, `gemini_selected_model`, etc.).
  - Client Ephemeral: `sessionStorage` (`gemini_api_keys` for active browser tab lifecycle).
  - Server Ephemeral: `SessionStore` (Redis/Memory with 24h sliding TTL).
- **Communication Protocol**: HTTPS / HTTP with `X-Session-Token` and `X-Auth-Token` headers.
