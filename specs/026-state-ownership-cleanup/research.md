# Research: State Ownership & Storage Cleanup

**Feature**: State Ownership & Storage Cleanup  
**Directory**: `specs/026-state-ownership-cleanup/`  
**Date**: 2026-08-20  

---

## 1. Executive Research Summary

An exhaustive audit of the codebase revealed 5 distinct storage tiers currently in use:
1. **Browser `localStorage`**: Key-value synchronous browser storage used for UI preferences, model selection, custom limits, auth tokens, session token pointers, and legacy API key migration.
2. **Browser `IndexedDB`**: Asynchronous transactional client database used for story projects, chapters, split paragraphs, and custom project glossaries.
3. **Client In-Memory / React State & Contexts**: Ephemeral UI state (`useAIConfig`, `useModelObservability`, `useProjectStorage`, `I18nContext`).
4. **Backend In-Memory / Server Sessions**: Ephemeral session store (`sessionStore.ts`), model info cache (`modelInfoService.ts`), translation chunk cache (`translationChunkCache.ts`), and in-memory quota tracking (`quotaService.ts`).
5. **Backend Distributed `Redis`**: Optional distributed persistence for session tokens, quota metrics, and idempotency locks with graceful degradation to in-memory fallback.

---

## 2. Research Decisions & Storage Boundaries

### Decision 1: Single Source of Truth for API Credentials & Tokens
- **Decision**: Server Session Store (`sessionStore.ts` via Redis or memory) is the **sole authoritative source of truth** for runtime API keys. The client holds only an opaque ephemeral session token string (`gemini_session_token`) or in-memory state in `sessionStorage` / React state.
- **Rationale**: Storing raw API keys permanently in `localStorage` creates security risks (XSS exfiltration) and multi-tab synchronization conflicts. Session tokens decouple client identity from sensitive credentials and allow server-side key rotation.
- **Legacy Migration**: Any legacy plaintext `gemini_api_keys` detected in `localStorage` are automatically migrated to `sessionStorage` and immediately purged from `localStorage`.
- **Alternatives Considered**: Storing encrypted keys in `localStorage` was rejected because the client still possesses the decryption key, leaving raw keys vulnerable to script inspection.

---

### Decision 2: Single Source of Truth for Creative Content & Projects
- **Decision**: Client `IndexedDB` (`src/services/db.ts` across `projects` and `chapters` object stores) is the **sole authoritative source of truth** for projects, chapter manuscripts, translated texts, and glossaries.
- **Rationale**: IndexedDB offers transactional integrity, structured indexing (`projectId`), and generous storage quotas (> 1GB). `localStorage` has a strict ~5MB limit and synchronous serialization bottlenecks that freeze the UI when handling novel manuscripts.
- **Cache Layer**: React hooks (`useProjectStorage`) maintain in-memory state during active editing and commit updates atomically to IndexedDB on save/blur.
- **Alternatives Considered**: Mirroring project summaries to `localStorage` for fast loading was rejected due to dual-write drift and storage quota exhaustion.

---

### Decision 3: Single Source of Truth for Quota, Rate Limiting & Key Health
- **Decision**: Server Quota Service (`quotaService.ts`) is the **sole authoritative source of truth** for sliding-window RPM/TPM, daily RPD tallies, circuit breaker states, and cooldown timers.
- **Rationale**: Client-side clocks are unreliable, and multiple browser tabs operating concurrently can exceed rate limits if quota is calculated locally. Server-side centralization guarantees synchronized pacing and consistent 429 backoff.
- **Projection to Client**: Client components (`QuotaPanel.tsx`, `useModelObservability.ts`) consume read-only snapshots via `POST /api/quota-status` and run isolated countdown intervals for visual feedback.
- **Alternatives Considered**: Client-side distributed rate limiting via BroadcastChannel was rejected as fragile and ineffective when users operate across multiple browsers or network devices.

---

### Decision 4: Single Source of Truth for Model Discovery & Verification
- **Decision**: Server Model Info Service (`modelInfoService.ts`) is the **authoritative validator** for model capabilities and verification status. Client `localStorage` (`gemini_discovered_models`) acts strictly as a short-lived cache with a 1-hour TTL.
- **Rationale**: Google Gemini deprecates and releases models dynamically. Caching model lists permanently leads to stale model selections and runtime 404 errors.
- **Validation**: On application startup or when switching models, `useModelObservability` verifies the cached model against `ALLOWED_MODEL_IDS` and defaults gracefully to `DEFAULT_MODEL_ID` if unverified.

---

### Decision 5: Bounded Lifecycles & Expiration Policies

| Layer | Item | TTL / Retention | Eviction Strategy |
|:---|:---|:---|:---|
| **Server Redis / Memory** | Session Tokens | 24 hours idle | Redis TTL / in-memory periodic timer (every 10m) |
| **Server Redis / Memory** | Idempotency Locks | 10 minutes | Redis TTL / in-memory LRU map |
| **Server Memory** | Translation Chunks | 2 hours sliding window | Max 500 entries LRU cache |
| **Server Memory** | Rate Limiter Pacing | 60 seconds sliding window | Periodic cleanup of stale keys (> 30m) |
| **Client LocalStorage** | Discovered Models | 1 hour | Timestamp check on read; re-fetch on expiry |
| **Client LocalStorage** | Selected Model | Persistent until changed | Fallback to default on model deprecation |
| **Client LocalStorage** | Custom Quota Limits | Persistent until changed | Retained per key hash; pruned on orphan key |
| **Client IndexedDB** | Projects & Chapters | Persistent | Explicit user deletion via UI |

---

## 3. Storage Audit & Cleanup Checklist

1. **Purge Check**: Verify no full chapter text or glossary dictionaries are ever written to `localStorage`.
2. **Key Masking Check**: Verify no plain API keys remain in `localStorage` across all flows.
3. **Session Re-sync Check**: Verify expired server sessions trigger clean `401 sessionExpired: true` handling without crashing or hanging client state.
4. **Consistency Verification**: Provide a unified storage health inspection function (`verifyStorageIntegrity`) to assert zero dual-write conflicts in automated tests.
