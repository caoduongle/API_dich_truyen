# Research: 072 Drive Bundle + CRDT Sync

## R1 — Bundle JSON Schema Design

### Decision
Adopt a single `project_bundle.json` file with this schema:

```jsonc
{
  "bundleVersion": 1,
  "exportedAt": "2026-08-23T12:00:00Z",
  "project": { /* StoryProject fields (minus chapters array detail) */ },
  "chapters": [
    {
      /* full Chapter fields */
      "crdtSnapshot": "<base64 Y.Doc state>",   // optional — absent on first push before CRDT lineage exists
      "crdtStateVector": "<base64 Y.encodeStateVector>" // optional — for efficient delta sync later
    }
  ]
}
```

### Rationale
- A single fileId on Google Drive means one `drive.file` grant via Picker covers everything forever.
- `bundleVersion` enables future schema migrations without breaking older clients.
- Chapters retain `crdtSnapshot` exactly as `encodeChapterWithCrdt` currently produces — no format change needed.
- `crdtStateVector` is a tiny addition (~100 bytes) that enables future delta-only sync (not required for MVP but cheap to add).

### Alternatives Considered
1. **ZIP bundle** — rejected: requires extra decompression library, Google Picker can't preview, and JSON is already compact for text-heavy translation data.
2. **Multi-file + batch Permissions API** — rejected: Permissions API requires `drive` full scope, exactly what we're avoiding.
3. **AppData hidden folder** — rejected: AppData is per-user, cannot be shared between collaborators.

---

## R2 — CRDT Lineage Persistence Strategy

### Decision
Persist the Yjs binary state (`Uint8Array` from `Y.encodeStateAsUpdate`) in IndexedDB via a **new object store `crdt_states`** with schema `{ chapterId: string (keyPath), projectId: string (indexed), state: Uint8Array, updatedAt: string }`. This DB version bump (3 → 4) is additive-only.

### Rationale
The existing `y-indexeddb` (IndexeddbPersistence) in `useChapterCRDT.ts` already stores CRDT state in separate IndexedDB databases named `crdt_${projectId}_${chapterId}`, but this is:
1. Tied to the React hook lifecycle (created/destroyed with the editor UI).
2. Not accessible from Drive sync service code (which runs outside React).
3. Uses its own internal DB format incompatible with direct reads.

A dedicated `crdt_states` store in the app's main database solves all three issues and gives sync code direct read/write access to CRDT state.

**Flush points** (when to save CRDT state to `crdt_states`):
1. After every `saveChapterToDB` in the debounced CRDT auto-save (`useChapterCRDT.ts` line 73-89) — piggyback on existing save.
2. After every pull-merge in sync — save the merged doc state.
3. After every push — save the exported doc state.

**Lineage flow**:
```
Local edit → applyTextDiff → Y.Doc (in memory) → exportDocUpdate → crdt_states (IndexedDB)
                                                                        ↓
Push to Drive → read crdt_states → base64 encode → crdtSnapshot in bundle
                                                                        ↓
Pull from Drive → decode base64 → applyDocUpdate to local Y.Doc → merged state → crdt_states + saveChapterToDB
```

### Key Technical Finding
`encodeChapterWithCrdt()` currently creates a **fresh Y.Doc every time** from chapter text, losing all editing lineage. With `crdt_states`, the push flow changes to:
1. Read existing state from `crdt_states[chapterId]`.
2. If exists: create Y.Doc, apply stored state, then `applyTextDiff` for any changes since last flush.
3. If not exists: create fresh Y.Doc from chapter text (first-time migration, same as current behavior).
4. Export and encode.

This preserves editing lineage across sync cycles, making `Y.applyUpdate` between two peers produce meaningful character-level merges instead of "insert all text" conflicts.

### Alternatives Considered
1. **Reuse y-indexeddb stores directly** — rejected: internal format is not documented, hard to read from non-React code, and creates coupling to y-indexeddb library internals.
2. **Store Uint8Array directly in `chapters` store as a new field** — rejected: bloats every chapter read/write even when CRDT data isn't needed (most reads are for display, not sync).
3. **Separate Dexie database** — rejected: project uses native IndexedDB, not Dexie (confirmed by research).

---

## R3 — Merge Strategy for Pull

### Decision
Three-tier merge strategy on pull:

1. **Y.Text fields** (`rawTranslation`, `polishedTranslation`): Full CRDT merge via `Y.applyUpdate`. Character-level conflict resolution, no data loss.
2. **Y.Map fields** (`title`, `status`, `sourceText`, `paragraphs`, `translatedLines`): Per-key LWW via Yjs Map semantics. Each key independently resolves to the most recent write.
3. **Non-CRDT fields** (`createdAt`, `projectId`, etc.): Keep local values; only update `updatedAt` to max of local/remote.

### Merge Algorithm (per chapter)
```
function mergeChapterOnPull(localChapter, remoteChapterWithCrdt):
  1. localState = crdt_states[chapterId] ?? null
  2. if localState exists:
       localDoc = new Y.Doc(); Y.applyUpdate(localDoc, localState)
       // Apply any local text changes not yet flushed
       applyTextDiff(localDoc.getText('rawTranslation'), localChapter.rawTranslation)
       applyTextDiff(localDoc.getText('polishedTranslation'), localChapter.polishedTranslation)
     else:
       localDoc = createChapterYDoc(projectId, chapterId, localChapter)
  3. remoteUpdate = base64Decode(remoteChapterWithCrdt.crdtSnapshot)
  4. Y.applyUpdate(localDoc, remoteUpdate)  // CRDT merge!
  5. merged = readChapterFromYDoc(localDoc, chapterId)
  6. // Preserve non-CRDT local fields
     merged.projectId = localChapter.projectId
     merged.sourceText = merged.sourceText || localChapter.sourceText
     merged.createdAt = localChapter.createdAt
     merged.updatedAt = max(localChapter.updatedAt, remoteChapter.updatedAt)
  7. saveChapterToDB(merged)
  8. saveCrdtState(chapterId, projectId, exportDocUpdate(localDoc))
```

### Risk: Fresh-Doc-vs-Fresh-Doc Merge
When both local and remote have no CRDT lineage (first sync after migration), both docs are created from scratch with full text inserts. `Y.applyUpdate` between them will **concatenate** both texts rather than recognizing them as the same content.

**Mitigation**: Before CRDT merge, check if `localChapter.updatedAt` and `remoteChapter.updatedAt` are within a threshold AND no local `crdt_states` entry exists. In this case, fall back to timestamp-LWW (current behavior) for this one transition sync. On subsequent syncs, the CRDT lineage will be established.

---

## R4 — Google Picker setSize Behavior

### Decision
Add `builder.setSize(width, height)` to both `openFolderPicker` and `openFilePicker` (and the new `openBundlePicker`) in `googlePickerService.ts`.

### Values
```typescript
if (typeof window !== 'undefined') {
  const width = Math.min(1051, Math.round(window.innerWidth * 0.9));
  const height = Math.min(650, Math.round(window.innerHeight * 0.9));
  builder.setSize(width, height);
}
```

### Rationale
- `1051 × 650` are Google's recommended maximum Picker dimensions.
- 90% viewport cap ensures padding on all sides.
- Called before `builder.build()`, after `setOrigin`.
- Window check prevents SSR crashes.

---

## R5 — Migration Path for Existing Granular Projects

### Decision
**Owner-driven migration**:
1. Owner opens app after update → detects `driveStorageFormat === 'granular'` and `isOwner === true` and no `driveFileId` field.
2. System bundles all local chapters with CRDT snapshots into `project_bundle.json`.
3. Uploads bundle to Drive root app folder (not the old subfolder) using `uploadJsonFile`.
4. Updates local project record: sets `driveFileId` to new bundle file ID, sets `driveStorageFormat` to `'bundle'`.
5. Old granular files in subfolder are left orphaned (no automatic deletion to avoid accidental data loss). Owner can manually clean up.

**Collaborator re-import**:
1. Owner shares the new bundle file URL/link with collaborator.
2. Collaborator opens "Mở dự án được chia sẻ" → single-file Picker → selects bundle → imports.
3. Old local granular project data is replaced/updated with bundle data.

### Rationale
- One-time migration cost is acceptable.
- No need for dual-format sync logic — old format is deprecated, not maintained.
- Owner always has full local data, so bundling is lossless.

---

## R6 — Impact on Existing Tests

### Decision
Existing tests import from `'../googleDriveSyncService'` which re-exports from granular/project sync modules. All existing test assertions remain valid:
- `reconcileProjectTimestamps` — unchanged.
- `reconcileChapterTimestamps` — unchanged.
- `serializeProjectForDrive` — unchanged (still used for monolithic format).
- `buildSharedProjectManifest` — kept for backward compatibility but deprecated.
- `formatChapterFileName`, `sanitizeChapterTitleSlug` — unchanged.
- Picker API tests — `openFolderPicker`/`openFilePicker` still exist, new `openBundlePicker` added.

New tests to add:
1. `bundleSync.test.ts` — bundle serialization/deserialization, migration detection.
2. `crdtMergeOnPull.test.ts` — merge scenarios (local+remote changes, fresh-doc fallback).
3. `openBundlePicker` validation in existing `googleDriveSyncService.test.ts`.
