# Phase 1 Data Model: Storage Integrity, Security Parity & Hygiene Remediation

**Feature**: `149-storage-integrity-audit-fixes`  
**Date**: 2026-09-20  
**Status**: Complete  

---

## 1. Storage Queue & Write Serialization

### State Machine: Project Write Serialization

```
                  ┌──────────────────────┐
                  │         IDLE         │
                  │ (no in-flight write) │
                  └──────────┬───────────┘
                             │
                             │ enqueueProjectWrite(projectId, action)
                             ▼
                  ┌──────────────────────┐
                  │        QUEUED        │
                  │ (chained on previous)│
                  └──────────┬───────────┘
                             │
                             │ previous promise settles
                             ▼
                  ┌──────────────────────┐
                  │      EXECUTING       │
                  │ (action() in-flight) │
                  └──────────┬───────────┘
                             │
                             │ action() resolves / rejects
                             ▼
                  ┌──────────────────────┐
                  │       SETTLED        │
                  │ (finally() executed) │
                  └──────────┬───────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
        │ no new write chained                    │ new write chained
        ▼                                         ▼
┌────────────────────────┐              ┌───────────────────┐
│        CLEANED         │              │    NEXT WRITE     │
│ (map.delete(projectId))│              │    (continues)    │
└────────────────────────┘              └───────────────────┘
```

### Invariants
1. **Per-Project Isolation**: A write or delete on `projectId: "proj-A"` NEVER delays or blocks a write or delete on `projectId: "proj-B"`.
2. **Strict Per-Project FIFO**: For a given `projectId`, operation $N+1$ never begins execution until operation $N$ has completely settled (resolved or rejected).
3. **No Resurrection**: A `deleteProjectFromDB(id)` queued after a `saveProjectToDB(project)` runs strictly after the save completes, ensuring the final database state contains no deleted records.

---

## 2. In-Transaction Relational Validation Model

### Single Transaction Execution Lifecycle

```text
[Begin IDBTransaction: readwrite on (projects, chapters, crdt_states)]
  │
  ├── 1. Read existing chapter records for all chapterIds in project.chapters
  │      └── For each record:
  │          if (existing && existing.projectId !== incomingProjectId) {
  │              transaction.abort();
  │              throw RelationalIntegrityViolation;
  │          }
  │
  ├── 2. Put chapter records into CHAPTERS_STORE
  │
  ├── 3. Put project record into PROJECTS_STORE
  │
  └── 4. [Optional] Put CRDT records into CRDT_STATES_STORE
  │
[Transaction.oncomplete -> Resolve promise]
[Transaction.onerror / onabort -> Reject promise]
```

### Invariants
1. **Atomic Abort**: Any foreign key mismatch or constraint error causes the entire transaction to abort, leaving 0 partial writes.
2. **Zero TOCTOU Window**: Reads and writes occur inside the locked transaction bounds, preventing interleaved operations from modifying records between read validation and write execution.

---

## 3. Credential Storage Policy & Schema

### Browser Storage Mapping

| Store | Key | Type | Lifetime | Allowed When |
| :--- | :--- | :--- | :--- | :--- |
| `sessionStorage` | `gemini_api_keys` | `string[]` | Active tab session | Always (active session) |
| `localStorage` | `app_ui_prefs.savedKeys` | `string[]` | Cross-session persistent | `rememberKeys === true` |
| `localStorage` | `app_ui_prefs.rememberKeys` | `boolean` | Cross-session persistent | Always (default: `true`) |
| `localStorage` | `gemini_api_keys` (root) | - | - | **STRICTLY FORBIDDEN** (purged on load) |

### State Transitions for `rememberKeys`

```
┌────────────────────────────────────────────────────────┐
│ rememberKeys: true (Default)                           │
│ - Keys stored in sessionStorage['gemini_api_keys']    │
│ - Keys duplicated to localStorage['app_ui_prefs']     │
│ - UI displays shared device caution                   │
└──────────────────────────┬─────────────────────────────┘
                           │ User toggles rememberKeys -> false
                           ▼
┌────────────────────────────────────────────────────────┐
│ rememberKeys: false (Ephemeral Mode)                   │
│ - localStorage['app_ui_prefs'].savedKeys scrubbed to []│
│ - Keys remain solely in sessionStorage for active tab  │
│ - On tab close / browser restart: keys forgotten       │
└────────────────────────────────────────────────────────┘
```

---

## 4. EPUB Document Package Schema

```text
book.epub (ZIP container)
├── mimetype                           [STORE, application/epub+zip]
├── META-INF/
│   └── container.xml                  [Points to OEBPS/content.opf]
└── OEBPS/
    ├── content.opf                    [Package metadata, manifest, spine]
    ├── nav.xhtml                      [EPUB 3 Nav document]
    ├── toc.ncx                        [EPUB 2 NCX table of contents]
    ├── style.css                      [Typography & styling]
    ├── cover.xhtml                    [Title, author, metadata page]
    └── chapter_*.xhtml                [Individual chapter content]
```

### Package Manifest Invariants
- `mimetype` MUST be the first file in the archive and MUST be uncompressed (`compression: 'STORE'`).
- Every chapter file in `OEBPS/` MUST be listed in `<manifest>` of `content.opf` with `media-type="application/xhtml+xml"`.
- Every spine `<itemref idref="...">` in `content.opf` MUST correspond to a valid manifest `<item id="...">`.
- XML content in all `.xhtml` files MUST have escaped entity delimiters (`&amp;`, `&lt;`, `&gt;`, `&quot;`).
