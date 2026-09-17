# Feature Specification: Project Write Boundary Serialization & Quota Error Isolation

**Feature Branch**: `142-project-write-boundary`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Audit feedback on snapshot 3744d6a: queue project chưa bao phủ queue chapter (orphan chapter resurrection); 404 không rotate nhưng vẫn bị ghi nhận failure của key; cross-tab project serialization"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comprehensive Project Write Boundary & Orphan Child Resurrection Guard (Priority: P1) 🎯 MVP

As a translator editing chapters while background auto-save or cloud sync is active,
I want deleting a project to guarantee that no concurrent or queued chapter writes can resurrect orphan chapter records in IndexedDB,
So that when a project is deleted, all its chapters and CRDT states are permanently and completely wiped from the device.

**Why this priority**:
Currently, `deleteProjectFromDB()` is serialized against `saveProjectToDB()` and `atomicSaveProjectBundle()`, but `saveChapterToDB()`, `saveChaptersToDB()`, and `saveCrdtState()` execute on independent write paths. If an auto-save (`useChapterCRDT`) or Drive granular sync write is queued or in-flight when a project is deleted, the chapter write can settle after deletion, causing child-record / orphan chapter resurrection in IndexedDB.

**Independent Test**:
Simulate an in-flight `saveChapterToDB()` or `saveCrdtState()` concurrently with `deleteProjectFromDB()` on the same project. Verify that:
1. Operations execute in strict FIFO order under the project's serialization boundary.
2. If a chapter or CRDT write executes after `deleteProjectFromDB()` has committed, the write aborts cleanly because the parent project no longer exists, leaving 0 orphan chapters and 0 CRDT records in IndexedDB.

**Acceptance Scenarios**:

1. **Given** an in-flight or queued `saveChapterToDB(chapter)` when `deleteProjectFromDB(projectId)` is called, **When** execution resolves, **Then** all writes for that project are serialized through `projectWriteChains.get(projectId)`, ensuring `deleteProjectFromDB` clears all child records cleanly.
2. **Given** a `saveChapterToDB(chapter)` or `saveCrdtState(state)` operation whose execution begins after `deleteProjectFromDB(projectId)` has already deleted the parent project, **When** the write attempts to commit, **Then** it detects the parent project no longer exists and aborts without persisting orphan records into `chapters` or `crdt_states`.
3. **Given** multiple chapters being saved via `saveChaptersToDB(chapters)`, **When** queued, **Then** each chapter write is serialized under its respective `projectId` chain and cleans up settled promises.

---

### User Story 2 - Gemini Non-Credential (404 Resource/Model) Quota Isolation (Priority: P2)

As an application user utilizing personal Gemini API keys,
I want non-credential errors such as HTTP 404 (model not found / deprecated endpoint) to fail fast without degrading key health statistics or tripping circuit breakers,
So that my API keys remain healthy and available for valid models, and quota statistics accurately reflect credential health.

**Why this priority**:
Currently, HTTP 404 is classified as non-retryable `RESOURCE_NOT_FOUND` and fails fast without rotating keys, but it still passes through `recordFailure()`, incrementing `keyStats.errorsTotal`, `consecutiveErrors`, and potentially placing the key into `Degraded` status. Because 404 indicates a model or resource path issue (not a key quota or auth failure), the key itself should not be penalized.

**Independent Test**:
Mock Gemini API returning HTTP 404 for a requested model. Call `callGemini()` with multiple keys. Verify that:
1. The request fails fast on attempt 1 with `RESOURCE_NOT_FOUND`.
2. No key rotation occurs (keys 2..N are not called).
3. The provider attempt is recorded, but `keyStats.errorsTotal`, `keyStats.consecutiveErrors`, and `circuitBreakerStatus` for key 1 remain completely unpenalized (errorsTotal does not increment).
4. Logical request failure is recorded for the operation.

**Acceptance Scenarios**:

1. **Given** an API call returning HTTP 404 (`RESOURCE_NOT_FOUND`), **When** error processing occurs in `geminiClient.ts`, **Then** the request throws immediately on key 1 without rotating keys and without calling `localQuotaTracker.recordFailure` on the key's health metrics.
2. **Given** a non-credential error (404), **When** checking `localQuotaTracker.getQuotaStatus()`, **Then** the key's `consecutiveErrors` remains 0 and `healthState` remains `Healthy` (unless previously degraded).

---

### User Story 3 - Cross-Tab Project Write Serialization via Web Locks API (Priority: P2)

As a user with multiple browser tabs open to the application,
I want project write and delete operations across different tabs to serialize cleanly,
So that concurrent writes from different tabs do not collide, corrupt IndexedDB state, or overwrite newer changes with stale data.

**Why this priority**:
`projectWriteChains` provides reliable FIFO serialization within a single JavaScript execution context (tab). However, across multiple browser tabs, separate `projectWriteChains` Maps do not share promises. Using the browser-native Web Locks API (`navigator.locks`) allows cross-tab project-level mutual exclusion with zero external dependencies and graceful in-memory fallback.

**Independent Test**:
Simulate concurrent writes across contexts simulating multiple tabs on the same `projectId`. Verify that `navigator.locks.request` coordinates execution so that only one write transaction per project executes at a time across tabs.

**Acceptance Scenarios**:

1. **Given** a browser environment supporting `navigator.locks`, **When** project write/delete operations execute, **Then** they acquire a project-scoped lock (`project-write-${projectId}`) before executing the serialized write chain.
2. **Given** an environment where `navigator.locks` is undefined (such as Node.js test runners or legacy browsers), **When** write operations execute, **Then** they fall back transparently to in-memory `projectWriteChains` serialization without throwing errors.

---

### Edge Cases

- What happens if `saveChapterToDB(chapter)` is called with a chapter that lacks a `projectId` property?
  The system performs a fast lookup on `chapters` store by `chapter.id` to determine the existing `projectId`, routing through that project's write chain. If no project association can be found, the write proceeds directly.
- What happens if a user rapid-clicks "Xóa dự án" while multiple chapters are auto-saving?
  All queued auto-saves finish or cleanly abort once deletion completes, leaving no lingering chapters.
- What happens if `navigator.locks.request` rejects or times out?
  Errors bubble up through the existing `withRetry` error handler and `StorageResult` classification, ensuring IndexedDB transactions are safely aborted.
- What happens if a Gemini request returns HTTP 400 (Bad Request) vs HTTP 404 (Not Found)?
  Both represent non-retryable client/request errors. Neither rotates keys. Neither should penalize key health as a credential failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST route all `saveChapterToDB`, `saveChaptersToDB`, and `saveCrdtState` operations through the same project-level serialization boundary (`projectWriteChains.get(projectId)`) as `saveProjectToDB`, `atomicSaveProjectBundle`, and `deleteProjectFromDB`.
- **FR-002**: System MUST verify parent project existence before committing a chapter or CRDT write when executed from the serialization queue. If the parent project does not exist, the write MUST abort cleanly to prevent orphan record creation.
- **FR-003**: System MUST clean up settled promise references from `projectWriteChains` upon completion of chapter and CRDT operations to prevent memory leaks.
- **FR-004**: System MUST NOT record key failure (`recordFailure`) or increment key error statistics (`keyStats.errorsTotal`, `consecutiveErrors`) when Gemini API returns HTTP 404 (`RESOURCE_NOT_FOUND`).
- **FR-005**: System MUST record logical request failure (`recordLogicalFailure`) for 404 errors while keeping individual key health state intact.
- **FR-006**: System MUST coordinate project-level write operations across multiple browser tabs using `navigator.locks` when available, falling back gracefully to in-memory serialization when unavailable.
- **FR-007**: System MUST provide test helper utilities (`waitForProjectWrites(projectId)`) to allow deterministic asynchronous assertions across test suites.

### Key Entities

- **ProjectWriteChain**: In-memory and cross-tab serialization queue keyed by `projectId` that gates all create, update, and delete operations across `projects`, `chapters`, and `crdt_states`.
- **ClassifiedGeminiError**: Structured error representation containing error category, retryability, and cooldown recommendation.
- **InternalKeyStats**: Per-key health and quota tracking record maintained by `LocalQuotaTracker`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% elimination of orphan chapter resurrection: When a project is deleted concurrently with chapter saves, 0 orphan chapter records remain in IndexedDB after all promises settle.
- **SC-002**: 100% accurate key quota health on 404: Zero key error counts or health degradations recorded on HTTP 404 model/resource errors.
- **SC-003**: Seamless cross-tab serialization: Zero concurrency conflicts or unhandled lock rejections across multiple browser contexts.
- **SC-004**: Strict quality gate compliance: `npm run lint`, `npm test`, and `npm run build` pass with 100% success (0 type errors, 0 failed tests, 0 skipped tests).

## Assumptions

- Target browser environment supports IndexedDB v2+ and optionally Web Locks API (`navigator.locks`).
- Auto-save hooks (`useChapterCRDT`) provide `projectId` on chapter objects or rely on store resolution.
- API keys in Gemini requests are valid format strings; 404 errors stem from non-existent model identifiers or deprecated endpoints.

