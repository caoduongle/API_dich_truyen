# Data Model: Storage Hardening, CRDT Persistence & Transaction Durability

**Feature**: `143-storage-hardening-crdt-cleanup`
**Date**: 2026-09-17

## 1. Storage Topology & Relational Boundaries

The client-side storage topology consists of two distinct IndexedDB domains:

```text
Browser Origin Storage
├── Primary Database: "novel_translator_db"
│   ├── ObjectStore: "projects" (keyPath: "id")
│   ├── ObjectStore: "chapters" (keyPath: "id", index: "projectId")
│   ├── ObjectStore: "crdt_states" (keyPath: "chapterId", index: "projectId")
│   └── ObjectStore: "terms" / "cache"
└── Dedicated Chapter CRDT Databases: "crdt_${projectId}_${chapterId}"
    └── Internal stores managed by y-indexeddb (updates, custom)
```

## 2. Entities & Schema Contracts

### Primary Database Entities (novel_translator_db)

#### Chapter Record
- **id**: `string` (UUID or numeric string, Primary Key).
- **projectId**: `string` (Parent project identifier, Indexed). **MANDATORY FOR PERSISTENCE**.
- **title**: `string` (Chapter title).
- **sourceText**: `string` (Raw source text).
- **rawTranslation**: `string` (Optional machine/initial translation).
- **polishedTranslation**: `string` (Optional refined translation).
- **status**: `ChapterStatus` (`'not_started' | 'translating' | 'translated' | 'polishing' | 'completed'`).
- **updatedAt**: `string` (ISO 8601 timestamp).

*Validation Rule (Fail-Closed Orphan Guard)*:
`saveChapterToDB(chapter)` MUST reject or abort saving if `projectId` cannot be resolved from either `chapter.projectId` or an existing chapter record with the same `chapter.id`.

#### Dedicated Chapter CRDT Database
- **Database Name**: `crdt_${projectId}_${chapterId}`
- **Lifecycle**:
  - Created dynamically when chapter is edited in `useChapterCRDT.ts`.
  - Persists real-time Yjs document updates locally.
  - MUST BE PURGED completely via `indexedDB.deleteDatabase(name)` upon `deleteProjectFromDB(projectId)`.

## 3. Transaction State Machine & Durability Lifecycle

```text
[Operation Invoked: saveChapterToDB / saveCrdtState]
          │
          ▼
   [Acquire Web Lock with Retry]
          │
          ▼
   [Queue in In-Memory projectWriteChains]
          │
          ▼
   [Parent Project Existence Check]
          ├── (Not Found / Deleted) ────► [Resolve Cleanly & Abort Write]
          │
          ▼ (Found)
   [Issue objectStore.put(record)]
          │
          ▼
   [Wait for transaction.oncomplete] (NOT putRequest.onsuccess)
          │
          ├── (transaction.onerror / onabort) ──► [Reject with Error]
          │
          ▼ (transaction.oncomplete)
   [Resolve Operation Promise]
          │
          ▼
   [Release Web Lock & Dequeue Next Task]
```
