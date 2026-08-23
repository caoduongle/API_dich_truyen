# Implementation Plan: Single-File Bundle Storage, CRDT Merge on Pull, and Responsive Google Picker

**Branch**: `072-drive-bundle-crdt-sync` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/072-drive-bundle-crdt-sync/spec.md`

## Summary

Replace the multi-file granular Google Drive sync architecture (separate `project.json`, `manifest.json`, `chapter_*.json` files) with a single unified `project_bundle.json` file per project. This eliminates the root cause of `drive.file` permission gaps (404 errors, duplicate files) by reducing shared project data to one fileId. Simultaneously, wire up the existing Yjs CRDT infrastructure for merge-on-pull (instead of destructive overwrite), persist CRDT lineage in IndexedDB, fix Google Picker responsive dimensions, and deprecate the Spec 069 "Đồng bộ file mới" workaround.

## Technical Context

**Language/Version**: TypeScript 5.x (React 19 frontend, Node.js backend)

**Primary Dependencies**: React 19, Vite, yjs, y-indexeddb, y-websocket, lucide-react, clsx, tailwind-merge, motion

**Storage**: IndexedDB (native API, not Dexie) — version 3 → 4 upgrade needed for `crdt_states` store

**Testing**: vitest (unit tests in `src/**/__tests__/`)

**Target Platform**: Browser (Chrome/Edge/Firefox), Google Drive REST API v3

**Project Type**: Web application (SPA + Express backend in same repo)

**Constraints**: `drive.file` OAuth scope only (non-negotiable), offline-capable client-side storage, no new npm dependencies

**Scale/Scope**: Projects with 1-500+ chapters, 2-5 concurrent collaborators

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Strict Quality Gates | ✅ PASS | `npm run lint`, `npm test`, `npm run build` required before completion |
| II. Dependency Minimization | ✅ PASS | Uses only existing `yjs`, `y-indexeddb` — no new dependencies |
| III. Strict Concern Separation | ✅ PASS | Changes are in sync services (`src/services/`) and DB layer — not touching translation pipeline or backend Gemini API |
| IV. Immutable Core Schemas | ⚠️ JUSTIFIED | Additive-only changes: new `driveFileId` optional field on `StoryProject`, new `'bundle'` value for `driveStorageFormat` union, new `crdt_states` IndexedDB store. No existing fields modified or removed. See Complexity Tracking below. |
| V. Atomic Commits | ✅ PASS | Changes scoped to Drive sync + CRDT merge + Picker — single feature, same code paths |

## Project Structure

### Documentation (this feature)

```text
specs/072-drive-bundle-crdt-sync/
├── plan.md              # This file
├── research.md          # Phase 0 output — technical decisions & rationale
├── data-model.md        # Phase 1 output — entity schemas & relationships
├── quickstart.md        # Phase 1 output — validation scenarios
├── contracts/
│   └── bundle-sync-service.contract.md  # Phase 1 output — service interfaces
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── types.ts                          # [MODIFY] Add driveFileId?, extend driveStorageFormat union
├── types/
│   └── googleDriveSync.ts            # [MODIFY] Add ProjectBundle, BundleChapterData, CrdtStateRecord types
├── services/
│   ├── db.ts                         # [MODIFY] DB version 3→4, crdt_states store, CRUD helpers
│   ├── crdtDocManager.ts             # [MODIFY] Add mergeChapterCrdt() utility
│   ├── googlePickerService.ts        # [MODIFY] Add openBundlePicker(), setSize() on all builders
│   ├── googleDriveSyncService.ts     # [MODIFY] Add bundle sync facade methods, re-exports
│   └── google-drive/
│       ├── driveRestClient.ts        # (unchanged)
│       ├── driveProjectSync.ts       # [MODIFY] Route bundle-format projects to bundle sync
│       ├── driveGranularSync.ts      # [MODIFY] Add buildProjectBundle(), pushBundle(), pullBundle(), importBundle()
│       └── driveBundleSync.ts        # [NEW] Bundle sync module (alternative: extend driveGranularSync.ts)
├── components/
│   └── google-sync/
│       ├── GoogleSyncModal.tsx       # [MODIFY] Replace 2-step Picker with single-file bundle Picker
│       └── ShareProjectModal.tsx     # [MODIFY] Remove "Đồng bộ file mới" card & button
├── hooks/
│   └── useChapterCRDT.ts            # [MODIFY] Piggyback CRDT state save to crdt_states store
└── __tests__/                        # Various test directories
    ├── services/__tests__/
    │   ├── googleDriveSyncService.test.ts   # [MODIFY] Add bundle-related assertions
    │   ├── granularSyncReconciliation.test.ts # (unchanged — existing assertions still valid)
    │   ├── crdtDocManager.test.ts            # [MODIFY] Add merge scenario tests
    │   └── bundleSyncMerge.test.ts           # [NEW] CRDT merge on pull tests
    └── components/google-sync/__tests__/
        └── GoogleSyncModal.test.ts           # [MODIFY] Update for single-file Picker flow
```

**Structure Decision**: Changes are concentrated in the existing `src/services/google-drive/` module and `src/services/` layer. A new `driveBundleSync.ts` file encapsulates bundle-specific logic (build, push, pull, import, migrate) to avoid bloating `driveGranularSync.ts` further while reusing `DriveRestClient` for all Drive API calls.

## Complexity Tracking

> **Justified Constitution deviations**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Add `driveFileId` to `StoryProject` | Bundle sync needs to track the single Drive file ID separately from `driveFolderId` (folder-based) | Reusing `driveFolderId` for a non-folder entity would be semantically confusing and break existing format detection logic |
| Add `'bundle'` to `driveStorageFormat` | Need to distinguish bundle projects from granular/monolithic for routing sync logic | Using a separate boolean `isBundleFormat` would be redundant with the existing discriminated union |
| New `crdt_states` IndexedDB store (DB v4) | CRDT lineage must persist outside React lifecycle for sync service access | Storing in `chapters` store would bloat every chapter read; y-indexeddb's internal stores aren't accessible from service code |

---

## Detailed Design Decisions

### D1: Bundle File Location on Google Drive

Bundles are uploaded to the **root app folder** (`AI_Dich_Truyen_Data/`) with filename `project_bundle_<projectId>.json`. This is simpler than creating project subfolders and avoids the permission issue entirely — the collaborator only needs `drive.file` access to this one file.

### D2: Reconciliation Strategy in `syncBiDirectional`

For `driveStorageFormat === 'bundle'` projects:
1. Compare project-level `updatedAt` timestamps.
2. If `push`: call `pushBundle()`.
3. If `pull`: call `pullBundle()` which internally performs per-chapter CRDT merge.
4. If `in_sync`: no-op.

This replaces the per-chapter loop in `syncGranularProject` with a single bundle download + per-chapter CRDT merge.

### D3: CRDT Merge Safety Net

When no CRDT lineage exists for a chapter (first sync, or legacy migration):
- Check if `crdt_states[chapterId]` is null AND the remote `crdtSnapshot` is present.
- If both are fresh (no shared history): apply timestamp-LWW fallback for this chapter only.
- On successful LWW resolution: save the winning state as initial CRDT lineage.
- Subsequent syncs will have shared lineage and use true CRDT merge.

This prevents the "double-insert" problem documented in the spec's risk section.

### D4: `openBundlePicker` vs Modifying `openFilePicker`

Create a **new** `openBundlePicker()` method rather than adding flags to `openFilePicker()`:
- Different semantics: single-select vs multi-select.
- Different MIME type filter: `application/json` only.
- Cleaner API surface.
- `openFilePicker()` still available for any remaining non-bundle use cases.

### D5: "Đồng bộ file mới" Deprecation Scope

Remove from:
- `ShareProjectModal.tsx`: The card (lines ~316-356), `handleSyncNewFiles`, `isSyncingNewFiles` state, `syncNewFilesProgress` state.
- `GoogleSyncModal.tsx`: Toast message referencing "Đồng bộ file mới" in `handleBiDirectionalSync` (line ~243).
- `driveGranularSync.ts`: `failedPullCount` and `failedChapters` tracking remains but the UI message changes from "cần bấm Đồng bộ file mới" to a generic error message.

Keep intact:
- `openFolderPicker()` — still useful for monolithic format or folder browsing.
- `openFilePicker()` — still useful for non-bundle scenarios.
- `syncGranularProject()` — still needed for legacy granular projects that haven't migrated.

### D6: IndexedDB Migration (v3 → v4)

In `db.ts` `handleDBUpgrade`:
```typescript
if (oldVersion < 4) {
  const store = db.createObjectStore('crdt_states', { keyPath: 'chapterId' });
  store.createIndex('projectId', 'projectId', { unique: false });
}
```
This is additive-only. No existing stores are modified. The migration runs automatically on first app open after update.
