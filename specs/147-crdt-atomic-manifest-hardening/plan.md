# Implementation Plan: CRDT Atomic Deletion Manifest & Storage Integrity Hardening

**Branch**: `147-crdt-atomic-manifest-hardening` | **Date**: 2026-09-18 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/147-crdt-atomic-manifest-hardening/spec.md)

**Input**: Feature specification from `specs/147-crdt-atomic-manifest-hardening/spec.md`

## Summary

Harden CRDT deletion manifests and storage integrity across all storage write boundaries by:
1. Ghi nhận `deletion_manifest` (status: `"pending"`) và toàn bộ thao tác xóa catalog (`projects`, `chapters`, `crdt_states`) vào **cùng một IDBTransaction nguyên tử**, chỉ dọn physical CRDT DB sau khi transaction đã commit.
2. Mở rộng durable deletion manifest cho cả single-chapter deletion (`deleteChapterFromDB`).
3. Chuẩn hóa và thực thi guard sở hữu chapter `assertChapterOwnership` trên tất cả storage write boundaries (`saveChapterToDB`, `saveChaptersToDB`, `saveProjectToDB`, và `atomicSaveProjectBundle` dùng trong Google Drive sync/bundle import).
4. Thực hiện nghiêm ngặt nguyên lý fail-closed: loại bỏ try/catch nuốt lỗi quanh `destroyCrdtPersistence` / `destroyAllCrdtPersistencesForProject` ở tầng DB wrapper; không nuốt lỗi đọc manifest trong `getPendingDeletionManifests` / `recoverPendingDeletions`.
5. Đảm bảo manifest ghi nhận đầy đủ mọi chapter ID phát hiện trong transaction catalog trước khi commit.

---

## Technical Context

**Language/Version**: TypeScript 5.x / ES2022
**Primary Dependencies**: React 19, Yjs (CRDT), y-indexeddb, Lucide React, Vitest
**Storage**: IndexedDB (client-side single source of truth: `projects`, `chapters`, `crdt_states`, `deletion_manifests` stores, and `crdt_${projectId}_${chapterId}` databases)
**Testing**: Vitest (`npx vitest run`)
**Target Platform**: Browser (Chromium, Firefox, Safari modern web standards)
**Project Type**: Pure Client-Side SPA
**Performance Goals**: IDB transactions commit in < 50ms; zero noticeable UI lag during deletion or bundle synchronization; background recovery executes transparently at startup.
**Constraints**: Pure client-side SPA (no backend server); strictly no new NPM dependencies; strictly no mutation of external types in `src/types.ts`.
**Scale/Scope**: Projects containing up to hundreds of chapters; robust against concurrent multi-tab writes and unexpected process interruptions.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Strict Quality Gates & Verification**:
  - `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), `npm run build` (`tsc && vite build`) must pass 100% cleanly without skipping or disabling any tests.
- [x] **Principle II: Dependency Minimization & Existing Library Reuse**:
  - No new NPM packages added. Leverages existing IndexedDB multi-store transaction APIs and existing project queues.
- [x] **Principle III: Strict Concern Separation & MVC Domain Boundary Preservation**:
  - All storage logic is confined to Model/Service layer (`src/services/db.ts`, `src/services/crdtPersistenceRegistry.ts`). No hooks or UI components imported into services.
- [x] **Principle IV: Immutable Core Schemas & Storage Stability**:
  - Core interfaces in `src/types.ts` remain unchanged. `DeletionManifestRecord` structure in `src/services/db.ts` remains backward compatible.
- [x] **Principle V: Atomic Commits & Documentation Synchronization**:
  - Focused strictly on storage manifest atomicity, single-chapter manifest recovery, FK enforcement across write paths, and fail-closed persistence disposal. Specs, plans, and tests kept in 1:1 synchronization.

---

## Project Structure

### Documentation (this feature)

```text
specs/147-crdt-atomic-manifest-hardening/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Architectural research & technical decisions
├── data-model.md        # Entity definitions & lifecycle state transitions
├── quickstart.md        # Verification scenarios & validation guide
├── contracts/           # Storage lifecycle API contracts
│   └── storage-lifecycle-contracts.md
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── db.ts                          # [MODIFY] Atomic manifest transaction, single chapter manifest, FK validation, fail-closed disposal & recovery
│   ├── crdtPersistenceRegistry.ts     # [VERIFY] Fail-closed provider retention
│   └── __tests__/
│       └── projectDeleteQueue.test.ts # [MODIFY] Comprehensive unit/integration tests for atomic manifest, single chapter manifest, FK bypass guards, fail-closed error propagation
```

**Structure Decision**: Confined to `src/services/db.ts` and its test suite `src/services/__tests__/projectDeleteQueue.test.ts`.

---

## Complexity Tracking

> No violations of project constitutional principles. No unnecessary layers introduced.
