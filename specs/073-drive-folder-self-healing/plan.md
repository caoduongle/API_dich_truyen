# Implementation Plan: Self-Healing and Graceful Recovery for Missing Google Drive Folders and Files

**Branch**: `073-drive-folder-self-healing` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/073-drive-folder-self-healing/spec.md`

---

## Summary

Implement a robust **self-healing recovery mechanism** and **clear diagnostic error handling** for Google Drive folder/file operations. The system adds a safe, non-throwing existence probe (`fileExists`) to `DriveRestClient`, automatically recreates deleted remote project subfolders during granular sync (`syncGranularProject`), invalidates stale in-memory root folder caches in `ensureAppFolder`, delivers clear Vietnamese diagnostic errors in `importProjectFromSharedFolder`, and preserves batch sync resilience in `pushAllToDrive`.

---

## Technical Context

**Language/Version**: TypeScript 5.x (React 19 frontend, Node.js backend)

**Primary Dependencies**: React 19, Vite, lucide-react, clsx, tailwind-merge, motion (no new dependencies)

**Storage**: IndexedDB (native API) — existing `projects` and `chapters` stores; zero schema mutations required

**Testing**: Vitest (`npm test` / `src/services/google-drive/__tests__/`)

**Target Platform**: Modern Web Browsers (Chrome/Edge/Firefox), Google Drive REST API v3

**Project Type**: Web application (SPA + Express backend)

**Constraints**: `https://www.googleapis.com/auth/drive.file` OAuth scope only, zero new npm dependencies, no schema mutations

**Scale/Scope**: Projects with 1 to 500+ chapters, batch multi-project sync, granular & bundle storage formats

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Strict Quality Gates** | ✅ PASS | `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), and `npm run build` (`vite build`) must pass 100% cleanly without skipped tests. |
| **II. Dependency Minimization** | ✅ PASS | Uses standard Web `fetch` and existing Drive REST endpoints. Zero new npm packages added. |
| **III. Strict Concern Separation** | ✅ PASS | Changes are strictly isolated within `src/services/google-drive/` (`driveRestClient.ts`, `driveGranularSync.ts`) and associated unit tests. Gemini translation pipeline and UI components remain untouched. |
| **IV. Immutable Core Schemas** | ✅ PASS | Zero mutations to `src/types.ts` or IndexedDB stores. Leverages existing `driveFolderId` and `driveFileId` properties. Vietnamese error copy is enhanced for clarity as requested. |
| **V. Atomic Commits & Sync** | ✅ PASS | Scoped cleanly to Google Drive folder self-healing and recovery. |

---

## Project Structure

### Documentation (this feature)

```text
specs/073-drive-folder-self-healing/
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical research & decisions
├── data-model.md        # State transitions & sequence diagrams
├── quickstart.md        # Validation & test execution guide
├── contracts/
│   └── drive-recovery.contract.md  # Service interface contracts
└── checklists/
    └── requirements.md  # Quality validation checklist
```

### Source Code (repository root)

```text
src/
└── services/
    └── google-drive/
        ├── driveRestClient.ts        # [MODIFY] Add fileExists(), add cache validation in ensureAppFolder()
        ├── driveGranularSync.ts      # [MODIFY] Add self-healing in syncGranularProject(), early folder check in importProjectFromSharedFolder()
        ├── driveProjectSync.ts       # [VERIFY] Ensure pushAllToDrive / syncBiDirectional benefit from self-healing
        └── __tests__/
            ├── driveRestClient.test.ts   # [NEW / MODIFY] Unit tests for fileExists & cache invalidation
            └── driveGranularSync.test.ts # [MODIFY] Tests for self-healing sync & import error messages
```

**Structure Decision**: Modifications are contained entirely in `src/services/google-drive/driveRestClient.ts` and `src/services/google-drive/driveGranularSync.ts`, accompanied by comprehensive unit and integration tests in `src/services/google-drive/__tests__/`.

---

## Complexity Tracking

> **Constitution Compliance**: No violations or deviations. Schema and dependencies remain unchanged.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | N/A |

---

## Detailed Design Decisions

### D1: Minimalist Endpoint & Trashed Field Check in `fileExists`

- Call `GET https://www.googleapis.com/drive/v3/files/{fileId}?fields=id,trashed`.
- Return `false` immediately for empty/whitespace IDs without making a network request.
- Return `false` on any non-200 HTTP status (404, 403, 400, etc.) or network failure.
- Return `!data.trashed` when HTTP status is 200 OK.

### D2: Cache Validation in `DriveRestClient.ensureAppFolder`

- Check `if (this.cachedFolderId)`.
- Probe `await this.fileExists(accessToken, this.cachedFolderId)`.
- If valid, return immediately; if invalid/trashed, set `this.cachedFolderId = null` and fall through to query/create.

### D3: Transparent Self-Healing in `DriveGranularSync.syncGranularProject`

- At entry, check `await client.fileExists(accessToken, driveFolderId)`.
- If missing:
  1. Notify user: `message: 'Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới...'`.
  2. Call `await this.migrateProjectToGranularSubfolder(client, accessToken, projectId, onProgress)`.
  3. Return `{ success: true, uploadedChapters: localChapters.length, downloadedChapters: 0, failedPullCount: 0, failedChapters: [], conflicts: [] }`.
- If present: Proceed with standard manifest diff and sync.

### D4: Clear Diagnostic Error in `DriveGranularSync.importProjectFromSharedFolder`

- Check `await client.fileExists(accessToken, sharedFolderId)`.
- If missing: Throw `new Error('Thư mục chia sẻ này không còn tồn tại trên Google Drive (có thể đã bị xoá). Vui lòng chọn lại một thư mục dự án còn tồn tại, hoặc đồng bộ lại (Push) để tạo backup mới.')`.
- If present: Query for `project.json` and proceed.

---

## Verification Plan

### Automated Tests
```bash
# Run unit & contract tests for driveRestClient and driveGranularSync
npx vitest run src/services/google-drive/__tests__/

# Run all test suites
npm test

# Run type check
npm run lint

# Run production build
npm run build
```

### Manual / Integration Verification
- Execute scenarios defined in `specs/073-drive-folder-self-healing/quickstart.md`.
