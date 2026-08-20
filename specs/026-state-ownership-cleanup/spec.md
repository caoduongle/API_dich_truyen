# Feature Specification: State Ownership & Storage Cleanup

**Feature Branch**: `026-state-ownership-cleanup`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 13 — STATE OWNERSHIP / STORAGE CLEANUP: Rà soát tất cả state đang nằm ở: localStorage, IndexedDB, Context, Server Session, Redis. Tạo source-of-truth matrix. Mỗi loại state quan trọng phải có: source of truth, cache, migration strategy, expiration strategy. Không để cùng một state quan trọng được chỉnh sửa độc lập ở nhiều storage."

---

## Executive Summary

The application currently manages state across multiple storage tiers: browser `localStorage`, client `IndexedDB`, in-memory UI Context/React state, backend ephemeral Server Sessions, and distributed backend `Redis`. Without strict ownership boundaries, overlapping storage causes state drift, desynchronization bugs, stale credentials, and fragmented cache invalidation.

This feature establishes a definitive **Source of Truth Matrix** and architectural cleanup rules. Every piece of state is assigned exactly one authoritative owner, designated cache tiers, explicit migration procedures, and automated expiration/eviction lifecycles.

---

## Source of Truth Matrix

| State Category | Sub-State / Key | Primary Source of Truth | Cache Layer(s) | Migration Strategy | Expiration / Cleanup Strategy |
|:---|:---|:---|:---|:---|:---|
| **Novel & Project Content** | Projects, Chapters, Paragraphs, Custom Glossaries | Client `IndexedDB` (`src/services/db.ts`) | React in-memory state / context | Schema version migrations in IndexedDB (`onupgradeneeded`) | Persistent until manual project deletion or explicit user wipe |
| **API Credentials & Keys** | Gemini API keys, provider tokens | Server Session Store (`sessionStore.ts` via Redis / in-memory) | Client ephemeral memory in `ApiSettings` | Seamless session re-sync when token expires or rotates | Server session TTL: 24h idle expiration; automatic cleanup |
| **Server Auth Credentials** | Access password token (`X-Auth-Token`) | Server Auth Session (`authMiddleware.ts` in Redis / memory) | Client `localStorage` (`x_auth_token`) | Header token verification; fallback to re-login on invalidation | 24-hour expiration; immediate invalidation on `/api/auth/logout` |
| **Active Model Preference** | Currently selected Gemini model ID | Client `localStorage` (`gemini_selected_model`) | React UI State (`useModelObservability`) | Automatic model ID normalization and fallback to default if retired | Persistent until changed by user or reset on model deprecation |
| **Discovered Models Registry** | Dynamic model list & capabilities | Server Model Registry Cache (`modelInfoService.ts`) | Client `localStorage` (`gemini_discovered_models`) | Re-inspected on key addition; merged with built-in default models | Client TTL: 1 hour; Server TTL: 15 minutes; manual refresh on demand |
| **Quota & Rate Limit Usage** | RPM, TPM, RPD, sliding windows | Server Quota Service (`quotaService.ts` Redis / memory) | Client `QuotaPanel` UI snapshot | In-memory atomic reset on date roll (America/Los_Angeles PST) | Daily PST midnight reset; 60-second sliding window for RPM/TPM |
| **Key Health & Circuit Breakers**| Health states (`Healthy`, `Cooldown`, `Degraded`, `RateLimited`, `AuthFailed`) | Server Key State Machine (`quotaService.ts`) | Client Countdown Badges (`QuotaPanel.tsx`) | Non-persistent; initialized on server start | Dynamic TTL cooldown (3s–60s); automatic recovery on success |
| **Translation Chunk Cache** | Partial translation deduplication | Server Chunk Cache (`translationChunkCache.ts`) | In-memory LRU cache | Hashed cache key (content + model + genre + tone + glossary) | 2-hour sliding window; max 500 entries per instance |
| **Idempotency & Request Deduplication**| Idempotency keys & cached responses | Server Idempotency Store (`idempotencyMiddleware.ts`) | Redis / in-memory LRU | Key format `idemp:<key>` | 10-minute fixed TTL; auto-eviction |
| **UI Preferences & Layout State**| Active tabs, editor layout, column widths | Client `localStorage` (`app_ui_prefs`) | React component local state | Versioned JSON schema with graceful default fallbacks | Persistent across sessions; pruned on unknown keys |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single Source of Truth for API Credentials & Sessions (Priority: P1) 🎯 MVP

As a translator using multiple devices or opening multiple browser tabs, I want my API keys and authentication sessions to be strictly managed by the backend session store so that I never experience desynchronized credentials, duplicate prompts, or key leakage across tabs.

**Why this priority**: Credentials and authentication represent high-security, high-impact state. Conflicting storage leads to 401/403 authorization failures and token confusion.

**Independent Test**: Connect with a session token. Rotate or revoke the key on the server. Verify that all tabs receive the updated session state or an unambiguous re-sync prompt without stale local overrides.

**Acceptance Scenarios**:
1. **Given** an active session token stored on the server, **When** the client submits translation requests with `X-Session-Token`, **Then** the server resolves keys exclusively from `sessionStore` without reading outdated client local copies.
2. **Given** a session that has expired after 24 hours, **When** the client makes a request, **Then** the server responds with a clear `401 sessionExpired: true` directive, prompting the client to re-authenticate or re-sync cleanly.
3. **Given** direct keys entered in the UI, **When** session mode is activated, **Then** plain keys are purged from local storage and stored solely in the server session tier.

---

### User Story 2 - Authoritative Project & Content Storage in IndexedDB (Priority: P2)

As a novel translator working on large 100+ chapter books, I want all my project chapters, glossary terms, and translation drafts to live authoritatively in client IndexedDB, with clear memory-cache rules so that the UI never writes conflicting edits to different storage layers.

**Why this priority**: Novel manuscripts and glossaries represent the primary user creative work. Multi-source edits risk severe data corruption or lost work.

**Independent Test**: Load a 50-chapter project into IndexedDB. Edit chapters in the translation workspace. Check that the UI state directly synchronizes to IndexedDB transactions and that no stale mirror copies exist in `localStorage`.

**Acceptance Scenarios**:
1. **Given** a project stored in IndexedDB, **When** a chapter is translated or edited, **Then** changes are committed atomically to IndexedDB as the sole persistent source of truth.
2. **Given** memory caches in React hooks (`useProjectStorage`), **When** an IndexedDB transaction completes, **Then** in-memory state reflects the latest database state without drift.
3. **Given** large translation texts (> 5MB), **When** checking `localStorage`, **Then** no manuscript data or chapter bodies are serialized into `localStorage`.

---

### User Story 3 - Server-Owned Quota, Rate Limiting & Circuit Breakers (Priority: P3)

As an operator running high-throughput translation jobs, I want quota usage, sliding window rate limits, and key health states to be owned strictly by the server Quota Service so that client clocks, browser sleeps, or multiple browser tabs cannot bypass rate limits or falsely reset circuit breakers.

**Why this priority**: Quota tracking and cooldown state must be centralized on the server to prevent 429 quota exhaustion and model throttling.

**Independent Test**: Simulate two concurrent client tabs sending requests through the same backend. Verify both tabs observe consistent server-calculated RPM, cooldown counters, and key health status.

**Acceptance Scenarios**:
1. **Given** multiple client tabs connected to the server, **When** one tab triggers a 429 or 503 error, **Then** the server marks the key into `Cooldown` / `RateLimited` state, and all tabs receive the accurate server state via `/api/quota-status`.
2. **Given** a key in cooldown, **When** the cooldown TTL expires on the server, **Then** the server automatically transitions the key back to `Healthy`, and client countdown badges reflect this state without client-side manual overrides.

---

### User Story 4 - Model Registry & UI Preference Hierarchy (Priority: P4)

As a user customizing preferences, I want model discovery data and UI layout choices to have clearly bounded cache lifecycles and fallback hierarchies so that old obsolete model IDs or stale cached capability lists are automatically cleaned up.

**Why this priority**: Stale model caches cause requests to fail on deprecated models; unbounded UI preferences clutter browser storage.

**Independent Test**: Store an obsolete model ID in `gemini_selected_model` and stale discovered models in `gemini_discovered_models`. Trigger model verification. Assert the system gracefully migrates to the active default model and purges expired registry entries.

**Acceptance Scenarios**:
1. **Given** cached discovered models with timestamp older than 1 hour, **When** the user opens the model selector, **Then** the client marks the cache stale and queries the server for fresh model capabilities.
2. **Given** an invalid or deleted model ID saved in user preferences, **When** the application starts, **Then** the selector falls back gracefully to `DEFAULT_MODEL_ID` and updates the saved preference.

---

## Edge Cases

- **Storage Quota Exceeded on Browser (IndexedDB Quota)**: When browser storage is constrained (< 50MB remaining), the application MUST prompt the user with export options and reject oversized batch imports cleanly.
- **Server Restart / In-Memory Session Loss**: When running in standalone in-memory mode and the server restarts, client requests with expired session tokens MUST receive an explicit `401 sessionExpired: true` allowing automatic re-sync from memory without crashing.
- **Concurrent Multi-Tab Writes**: When two browser tabs edit the same chapter, IndexedDB transactions MUST prevent partial overwrites, and the last committed transaction MUST prevail with consistent timestamps.
- **Redis Disconnection**: When Redis transitions to degraded mode, session and quota state MUST fall back to the in-memory store cleanly without state collisions.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every application state domain MUST have exactly one designated primary Source of Truth as defined in the Source of Truth Matrix.
- **FR-002**: The server session store (`sessionStore.ts`) MUST be the sole authoritative source of truth for runtime API keys and ephemeral session tokens.
- **FR-003**: IndexedDB (`src/services/db.ts`) MUST be the sole authoritative persistent source of truth for projects, chapters, paragraphs, and custom glossary dictionaries.
- **FR-004**: Browser `localStorage` MUST NOT be used to store full chapter texts, project manuscripts, or raw API keys when session token mode is active.
- **FR-005**: Browser `localStorage` usage MUST be restricted to user UI preferences (`gemini_selected_model`, theme, custom limits, UI layout) and short-lived client cache entries with TTL.
- **FR-006**: The server Quota Service (`quotaService.ts`) MUST be the sole authoritative source of truth for RPM/TPM/RPD usage counters, key health states, and circuit breaker statuses.
- **FR-007**: Client-side countdown badges and rate-limit timers MUST function as read-only projections of server-calculated cooldown intervals.
- **FR-008**: Discovered model capabilities cached in client `localStorage` MUST enforce a maximum 1-hour expiration TTL and validate against the server model whitelist on load.
- **FR-009**: Idempotency records in backend Redis / in-memory store MUST enforce a maximum 10-minute expiration TTL.
- **FR-010**: Translation chunk cache on the server MUST enforce a sliding window eviction policy (max 2 hours / 500 entries).
- **FR-011**: All IndexedDB schema migrations MUST be versioned sequentially with backwards-compatible migration steps in `src/services/db.ts`.
- **FR-012**: The application MUST provide a unified storage diagnostic utility allowing users and automated tests to verify storage health and detect orphaned or orphaned cache keys.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Zero Dual-Write Ambiguity**: 100% of state categories have a single authoritative owner; no state is independently mutated across multiple storage tiers without a defined synchronization flow.
- **SC-002**: **Zero Manuscript Leakage in LocalStorage**: Audit confirms 0 KB of manuscript chapter text resides in `localStorage`.
- **SC-003**: **Automatic Stale Cache Eviction**: 100% of client and server caches (models, sessions, idempotency, chunks) expire within their specified TTL without memory bloat.
- **SC-004**: **Session Recovery Time**: In the event of a session token expiry, the client recovers or re-syncs state in under 1 second without data loss.
- **SC-005**: **Clean Quality Verification**: All storage consistency unit and integration tests pass with 100% success rate across both client and server test suites.

---

## Assumptions

- IndexedDB is universally available on modern browsers (Chromium, Firefox, Safari, Edge) for project persistence.
- Server is deployed with Redis for distributed multi-instance environments, or runs the built-in in-memory fallback for local standalone operation.
- Users understand that clearing browser site data / storage will wipe local IndexedDB projects unless exported to backup files (`.json` / `.zip`).
