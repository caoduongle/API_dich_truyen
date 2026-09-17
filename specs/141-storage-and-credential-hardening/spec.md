# Feature Specification: Storage Security and Consistency Hardening

**Feature Branch**: `141-storage-and-credential-hardening`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Xử lý 2 vấn đề P1: (1) Xóa project vẫn bypass queue có thể làm project sống lại; (2) rememberKeys giữ làm tùy chọn bật tắt trong cài đặt (mặc định bật), khi bật cho phép lưu app_ui_prefs.savedKeys và chuẩn hóa chính sách với storageAudit/tài liệu kiến trúc, khi tắt thì xóa sạch khỏi localStorage; và các vấn đề P2/P3: Legacy Drive restore chưa atomic như Bundle; crdt_docs vs crdt_states chuẩn hóa; maxTokensPerChunk heuristic; Gemini 404 không xoay key; dọn dẹp queue memory leak; đồng bộ tài liệu kiến trúc client-side."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Queue-Serialized Project Deletion & Resurrection Guard (Priority: P1)

As a user editing and managing novel translation projects,
I want project deletion operations to be queued strictly behind in-flight or pending save operations for the same project,
So that a deleted project is never resurrected by a delayed asynchronous save completing after the delete.

**Why this priority**:
Project deletion is a destructive, high-stakes action. If `deleteProjectFromDB(id)` bypasses the write queue while an `enqueueProjectSave(id)` is awaiting execution or currently executing, the late save writes the project back into IndexedDB. This causes severe data inconsistency, unexpected UI reappearance, and ghost records.

**Independent Test**:
Simulate an active or queued project save (`saveProjectToDB`), immediately trigger project deletion (`deleteProjectFromDB`), and verify that the deletion runs strictly after the save, leaving the project and its chapters deleted without any zombie records. Verify that completed chain promises in the internal queue map are cleaned up to prevent memory growth.

**Acceptance Scenarios**:

1. **Given** an in-flight or queued save operation for project `proj-1`, **When** the user triggers deletion of `proj-1`, **Then** the deletion waits for the save to settle before executing the transaction that removes project metadata, chapters, and CRDT states.
2. **Given** a deletion operation has completed for `proj-1`, **When** the write chain completes, **Then** `proj-1` does not exist in `projects` or `chapters` stores, and the internal write chain map removes the reference to `proj-1` to prevent long-term memory leaks.
3. **Given** a project deletion error occurs, **Then** subsequent operations on other project IDs are unaffected, and the queue remains healthy.

---

### User Story 2 - User-Controlled Key Persistence & Storage Audit Consistency (Priority: P1)

As a user configuring Gemini API credentials,
I want a clear toggle in settings to "Ghi nhớ API Key trên trình duyệt này" (enabled by default) that persists keys in browser storage, with the ability to turn it off for ephemeral session-only storage,
And I want the security policy, documentation, and storage audit (`verifyStorageIntegrity`) to consistently recognize and enforce this policy without false positives or leaks.

**Why this priority**:
API keys are used directly by the browser client. Defaulting `rememberKeys` to enabled provides convenience so users don't have to re-enter keys every session. However, the system architecture, documentation, and audit scanner (`verifyStorageIntegrity`) must align:
- Legacy root key `localStorage['gemini_api_keys']` is strictly forbidden.
- When `rememberKeys === true` (default), `app_ui_prefs.savedKeys` is officially recognized as an intentional user convenience store.
- When the user turns `rememberKeys` off, `savedKeys` is immediately wiped from `localStorage`, keeping keys strictly ephemeral in `sessionStorage`.
- `storageAudit` must inspect `app_ui_prefs`: if `rememberKeys === false` but keys exist in `savedKeys`, it flags a violation and purges them.

**Independent Test**:
1. With `rememberKeys` enabled (default): verify entered keys persist in `app_ui_prefs.savedKeys` and `sessionStorage`, and `verifyStorageIntegrity()` reports valid (no policy mismatch).
2. Toggle `rememberKeys` to OFF in settings: verify `app_ui_prefs.savedKeys` becomes empty (`[]`) immediately, while active keys remain in `sessionStorage` for the current tab.
3. Test audit enforcement: simulate corrupted/inconsistent state where `rememberKeys === false` but `savedKeys` contains keys; verify `verifyStorageIntegrity()` flags a violation and `sanitizeLocalStorage()` cleanses the keys.

**Acceptance Scenarios**:

1. **Given** `rememberKeys` is enabled (default), **When** keys are updated, **Then** keys are stored in `sessionStorage` and persisted in `app_ui_prefs.savedKeys` for cross-session retention, and `verifyStorageIntegrity()` recognizes this as valid.
2. **Given** `rememberKeys` is toggled OFF by the user, **When** state changes, **Then** `savedKeys` in `localStorage.app_ui_prefs` is immediately cleared (`[]`), and keys reside solely in `sessionStorage`.
3. **Given** `localStorage` contains legacy top-level key `gemini_api_keys`, **When** the app loads or audit runs, **Then** the legacy key is migrated and purged immediately.

---

### User Story 3 - Atomic Google Drive Legacy Restore (Priority: P2)

As a user restoring a story project from Google Drive using the legacy/monolithic sync format,
I want the project metadata and all associated chapters to be persisted in a single atomic transaction,
So that network interruptions or parsing failures during chapter downloads do not leave an incomplete, corrupt project in local storage.

**Why this priority**:
`pullBundle()` was hardened into an atomic transaction (`atomicSaveProjectBundle`), but legacy `pullAllFromDrive()` still downloads project JSON, saves it, and then iterates downloading chapters saving them one-by-one. If download fails on chapter 3 of 10, the project is left in a broken partial state.

**Independent Test**:
Trigger `pullAllFromDrive()` with mock network failure on chapter download. Verify that IndexedDB contains neither the project nor any partial chapters, preserving database consistency.

**Acceptance Scenarios**:

1. **Given** a monolithic project and chapters stored on Google Drive, **When** the user pulls the project via `pullAllFromDrive()`, **Then** the system fetches both project metadata and chapter payloads before committing them together using `atomicSaveProjectBundle()`.
2. **Given** a network failure occurs while downloading `chapters_{id}.json`, **Then** the local database is not modified, no orphaned project record is created, and the sync failure is cleanly reported to the user.

---

### User Story 4 - Canonical CRDT Store Name Standardization (Priority: P2)

As a developer and system auditor,
I want the canonical CRDT object store name to be consistently defined and documented as `crdt_states` across all specifications, contracts, and codebases,
So that there is no ambiguity or contract drift between specification documents and production IndexedDB schema.

**Why this priority**:
Production IndexedDB migrations create `crdt_states`. Having contracts and specifications cite `crdt_docs` while code uses runtime fallbacks leads to confusion, incorrect documentation, and fragile maintenance.

**Independent Test**:
Audit all specifications, data contracts, and schema definitions. Verify that `crdt_states` is the designated primary store name, and `crdt_docs` is explicitly tagged solely as a legacy migration fallback.

**Acceptance Scenarios**:

1. **Given** specifications, contracts, and database documentation, **When** referring to the CRDT binary state store, **Then** `crdt_states` is used as the sole primary canonical store name.
2. **Given** an existing IndexedDB instance that was created with the legacy `crdt_docs` store, **When** accessing or saving bundles, **Then** the legacy fallback path remains functional to prevent data loss for existing users.

---

### User Story 5 - Non-Credential Error Fast-Fail & Key Rotation Filtering (Priority: P2)

As a user running AI translations,
I want the Gemini API client to immediately abort and report errors that are not related to credential/quota exhaustion (such as HTTP 404 Model Not Found or invalid request formatting),
So that the system does not fruitlessly rotate through and exhaust all remaining valid API keys or pollute quota health metrics.

**Why this priority**:
If a request fails with HTTP 404 (model deprecated or invalid model name), rotating through keys A, B, and C will produce 404 on every single key, unnecessarily burning provider quota counts, logging false-positive key failures, and delaying user feedback.

**Independent Test**:
Execute an AI call with a simulated HTTP 404 response. Verify that the Gemini client throws immediately without rotating to the next key, and verify that remaining keys are not penalized with failure records.

**Acceptance Scenarios**:

1. **Given** an API request that returns HTTP 404 (Resource/Model Not Found), **When** error classification evaluates the response, **Then** it categorizes the error as non-retryable `RESOURCE_NOT_FOUND`, fails fast, and does NOT rotate to other keys.
2. **Given** an AI response with empty candidate text and no safety block, **When** evaluated, **Then** it produces an explicit error without marking the key as exhausted.

---

### User Story 6 - Bilingual Splitter Packing Heuristic Documentation & Semantics (Priority: P3)

As a translator processing large bilingual chapters,
I want the bilingual text splitter to clearly document that `maxTokensPerChunk` is an accumulative token packing heuristic (target packing budget) that preserves paragraph boundaries,
So that users and developers understand why single large paragraphs are intentionally kept intact rather than sliced mid-sentence.

**Why this priority**:
`maxTokensPerChunk` is an estimation heuristic. Request token limits also include system instructions and glossaries. Clarifying this semantic prevents false expectations of strict provider token ceilings.

**Independent Test**:
Pass a single paragraph whose estimated tokens exceed `maxTokensPerChunk`. Verify that the splitter returns the paragraph intact with correct estimated tokens and emits no truncation warning.

**Acceptance Scenarios**:

1. **Given** a paragraph whose estimated token count exceeds `maxTokensPerChunk`, **When** `splitBilingualContent` executes, **Then** the paragraph is preserved without internal splitting, and the chunk's `estimatedTokens` reflects the true accumulated estimate.
2. **Given** developer documentation and code comments for `maxTokensPerChunk`, **Then** they state clearly that it is a soft target packing heuristic preserving paragraph integrity.

---

### User Story 7 - Architecture Alignment & Client-Side Storage Audit Types (Priority: P3)

As a maintainer reviewing system architecture,
I want `src/utils/storageAudit.ts` type definitions and comments to reflect the pure client-side SPA architecture,
So that obsolete server-side references (e.g. `ServerSession`, `ServerQuota`) do not mislead contributors.

**Why this priority**:
The application has transitioned to a pure client-side SPA with browser IndexedDB and `@google/genai` client SDK. Outdated server references in audit contracts create technical debt and architectural inconsistency.

**Independent Test**:
Verify that `STORAGE_TIER_REGISTRY` in `src/utils/storageAudit.ts` defines sources of truth as client-side entities (`IndexedDB`, `SessionStorage`, `LocalStorage`, `ReactMemory`) without dangling server-side assumptions.

**Acceptance Scenarios**:

1. **Given** `storageAudit.ts`, **When** inspecting storage tier definitions, **Then** sources of truth reflect client-side SPA reality (`IndexedDB`, `SessionStorage`, `LocalStorage`).
2. **Given** storage audit execution, **Then** rules validate client-side boundaries without errors.

---

### Edge Cases

- What happens if a user deletes project A while multiple saves (`saveProjectToDB`) are pending in the write chain?
  All queued saves for project A complete or abort in sequence, followed immediately by the deletion, ensuring the final persistent state in IndexedDB is that project A does not exist.
- What happens if `deleteProjectFromDB` is called for a project ID that is not currently in the queue?
  The operation executes directly inside the serialized chain for that ID, succeeds normally, and cleans up the map entry upon completion.
- What happens if a user disables `rememberKeys` and refreshes the tab?
  Since `sessionStorage` survives page reloads within the same tab, active keys remain loaded for the session, but `localStorage` remains clean without persisted keys.
- What happens if `pullAllFromDrive()` encounters an invalid JSON response for `chapters_{id}.json`?
  The error is caught before any IndexedDB transaction begins, so no partial project metadata is written, leaving local storage intact.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST route `deleteProjectFromDB(id)` through the project's write queue (`projectWriteChains.get(id)`), ensuring strict FIFO execution after all prior saves or bundle operations for that project.
- **FR-002**: System MUST clean up completed promise references in `projectWriteChains` when the queue becomes idle for a project ID, preventing unbounded memory growth.
- **FR-003**: System MUST provide an explicit user setting `rememberKeys` (defaulted to `true`), allowing users to choose between persisting API keys in browser `localStorage` (`app_ui_prefs.savedKeys`) across sessions or keeping them strictly ephemeral in `sessionStorage`.
- **FR-004**: When `rememberKeys` is toggled OFF by the user, the system MUST immediately purge `savedKeys` from `localStorage.app_ui_prefs` (`savedKeys: []`) and retain keys only in active `sessionStorage`.
- **FR-005**: System MUST configure `verifyStorageIntegrity()` to validate that `app_ui_prefs.savedKeys` is allowed when `rememberKeys === true` (or unset), but MUST flag a security violation if `savedKeys` contains keys while `rememberKeys === false`.
- **FR-006**: System MUST maintain the invariant that legacy root key `localStorage['gemini_api_keys']` is forbidden and always automatically migrated and purged.
- **FR-007**: System MUST download all project metadata and chapter content before invoking storage in `pullAllFromDrive()`, and commit them atomically via `atomicSaveProjectBundle()`.
- **FR-008**: System MUST standardize on `crdt_states` as the canonical store name in all specifications, contracts, and schema documentation, retaining `crdt_docs` strictly as an obsolete fallback.
- **FR-009**: System MUST classify HTTP 404 from the Gemini API as a non-retryable error (`RESOURCE_NOT_FOUND`) and terminate the call immediately without rotating to other API keys.
- **FR-010**: System MUST document `maxTokensPerChunk` as an accumulative target packing heuristic that preserves paragraph integrity without splitting individual paragraphs.
- **FR-011**: System MUST align `src/utils/storageAudit.ts` storage tiers, comments, and types with the pure client-side SPA architecture.

### Key Entities

- **ProjectWriteQueue**: Per-project serialized execution chain guaranteeing FIFO ordering for `saveProjectToDB`, `atomicSaveProjectBundle`, and `deleteProjectFromDB`.
- **CredentialStorage**: Dual-tier storage model where active runtime keys reside in `sessionStorage['gemini_api_keys']`, and persistent cross-session retention in `app_ui_prefs.savedKeys` is governed by the user-controlled `rememberKeys` toggle (default: ON).
- **StorageIntegrityAudit**: Deep inspector scanning `localStorage` keys and serialized JSON payloads for forbidden data (unmigrated legacy keys, manuscripts, or keys persisted when `rememberKeys === false`).
- **AtomicDriveBundle**: Single multi-store IndexedDB transaction wrapping project metadata, chapters, and CRDT states during both bundle and monolithic sync pulls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of concurrent delete-after-save operations result in the project remaining permanently deleted from IndexedDB (0% resurrection rate).
- **SC-002**: When `rememberKeys` is toggled OFF, `app_ui_prefs.savedKeys` in `localStorage` is 100% empty, with 0 keys leaked across browser sessions. When `rememberKeys` is ON, storage integrity audit passes with 0 false violations.
- **SC-003**: 100% of monolithic Google Drive restore operations either commit all chapters and project metadata completely or abort with 0 partial writes upon download error.
- **SC-004**: 0 API key rotations occur when encountering HTTP 404 (Resource Not Found), failing fast on the initial attempt.
- **SC-005**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 100% passing test suites and 0 type errors.

## Assumptions

- `rememberKeys` is enabled by default to optimize user experience and eliminate the need to re-enter keys on every page visit, while giving privacy-conscious users an instant toggle to opt into session-only storage.
- Active user credentials during a browser session are stored in `sessionStorage` and in-memory React state, which is cleared when the tab/browser is closed.
- The canonical IndexedDB schema uses `crdt_states` with primary key `chapterId` and index `projectId`. Legacy databases containing `crdt_docs` will continue to be safely read via the existing fallback.
- Single paragraphs exceeding `maxTokensPerChunk` are expected behavior to maintain linguistic coherence in literary translations.
