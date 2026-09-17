# Data Model: CRDT Deletion Error Propagation and Undo Integrity Hardening

## Overview
This document defines entity relationships, relational invariants, and lifecycle transitions for storage cleanup, collaborative editor hydration, and undo backup serialization.

---

## 1. Entities & Storage Mapping

### StoryProject (`projects` store in `novel_translator_db`)
- **Key**: `id` (string, e.g. `proj_1720000000`)
- **Fields**:
  - `title`: string
  - `chapters`: Array<{ id: string; title: string; ... }>
  - `glossary`: Array<TermPair>
  - `updatedAt`: string (ISO 8601)
  - `createdAt`: string (ISO 8601)
- **Invariants**:
  - Root aggregate for all chapters and collaborative records.
  - Project deletion must remove this entity, its associated chapters, CRDT states, and dedicated physical databases.

### Chapter (`chapters` store in `novel_translator_db`)
- **Key**: `id` (string, e.g. `chap_1720000000`)
- **Fields**:
  - `id`: string (UUID or timestamp identifier)
  - `projectId`: string (Foreign key reference to `StoryProject.id`)
  - `title`: string
  - `sourceText`: string
  - `rawTranslation`: string
  - `polishedTranslation`: string
  - `paragraphs`: Array<Paragraph>
- **Invariants**:
  - **Foreign-Key Ownership**: Must belong to an existing `StoryProject`. If an existing chapter with `id` exists in storage with a different `projectId`, re-parenting is prohibited.

### CrdtStateRecord (`crdt_states` store in `novel_translator_db`)
- **Key**: `chapterId` (string)
- **Fields**:
  - `chapterId`: string (Primary key matching `Chapter.id`)
  - `projectId`: string (Foreign key matching `StoryProject.id`)
  - `update`: Uint8Array (Serialized Yjs document update)
  - `updatedAt`: number (epoch ms timestamp)
- **Invariants**:
  - Must specify a valid non-empty `projectId`.
  - The associated chapter must belong to `projectId`. Records with mismatched ownership cannot be saved.

### Dedicated CRDT Database (`crdt_${projectId}_${chapterId}` browser database)
- **Key / Namespace**: IndexedDB database named exactly `crdt_${projectId}_${chapterId}`
- **Stores**: Managed internally by `y-indexeddb` (`updates`, `custom`).
- **Invariants**:
  - Physical database representing local collaborative state.
  - Deletion must confirm physical unlinking via `onsuccess` and wait on `onblocked` up to 5000ms.
  - Deletion must reject on error or persistent block, never resolving on failure.

### In-Memory Persistence Registry
- **Structure**:
  ```ts
  interface RegisteredPersistence {
    provider: CrdtPersistenceProvider;
    projectId?: string;
    chapterId?: string;
  }
  // Mapping: dbName -> Set of RegisteredPersistence instances
  Map<string, Set<RegisteredPersistence>>
  ```
- **Invariants**:
  - Allows multiple provider instances per `dbName` (e.g. across component lifecycle transitions).
  - Destroying a `dbName` destroys all provider instances registered for that database.
  - Scoped project destruction matches exact project identities without naive prefix scanning.

---

## 2. State Lifecycle & Transitions

### Project Deletion & Failure Propagation
```text
[User Triggers Delete]
          ↓
[waitForQueueIdle(projectId)]  <-- Flush pending writes
          ↓
[Snapshot Backup for Undo]    <-- Guaranteed fresh data
          ↓
[Begin Primary Transaction]
  ├─ Delete from projectsStore
  ├─ Delete from chaptersStore (collect chapterIds)
  └─ Delete from crdtStatesStore (collect chapterIds)
          ↓
[Primary Transaction Commit (oncomplete)]
          ↓
[Collect all chapterIds from:
  project.chapters + chaptersStore + crdtStatesStore]
          ↓
[destroyAllCrdtPersistencesForProject(projectId, exactIds)]
          ↓
[executeDeleteDatabase for each crdt_${projectId}_${chapId}]
  ├─ onsuccess  → continue
  ├─ onblocked  → wait up to 5000ms for onsuccess
  └─ onerror/timeout → REJECT
          ↓
  [If ANY DB fails]
          ↓
   REJECT deleteProjectFromDB (Fail-Closed)
          ↓
  [If ALL succeed]
          ↓
   RESOLVE deleteProjectFromDB
```

### Undo & Collaborative Editor Hydration
```text
[User Clicks Undo Toast]
          ↓
[saveProjectToDB(project)]
[saveChaptersToDB(chapters)]
[saveCrdtStates(crdtStates)]
          ↓
[Database Restored in novel_translator_db]
          ↓
[User Opens Restored Chapter in Editor]
          ↓
[createChapterYDoc(projectId, chapterId, initialChapter)]
          ↓
[Connect IndexeddbPersistence(`crdt_${projectId}_${chapterId}`)]
          ↓
[Query getCrdtState(chapterId)]
          ↓
  [If crdtRecord.update exists]
          ↓
[Y.applyUpdate(doc, crdtRecord.update, 'restore-hydration')]
          ↓
[IndexeddbPersistence persists update to fresh dedicated DB]
          ↓
[Editor Active with Restored Lineage & Text]
```
