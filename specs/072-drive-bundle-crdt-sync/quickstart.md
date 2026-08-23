# Quickstart: 072 Drive Bundle + CRDT Sync

## Prerequisites

- Node.js 18+ installed
- Project cloned and dependencies installed: `npm install`
- Google OAuth credentials configured (Picker API Key, App ID, Client ID)
- At least one project with chapters in IndexedDB (created via the app UI)

---

## Validation Scenario 1: Bundle Push (Owner)

### Steps
1. Start dev server: `npm run dev`
2. Open the app in browser
3. Open a project that has chapters
4. Go to Google Sync modal → click "Sao lưu lên Google Drive"
5. Verify in Google Drive that a `project_bundle_<projectId>.json` file is created in `AI_Dich_Truyen_Data/`
6. Download and inspect the bundle file: should contain `bundleVersion`, `project`, `chapters[]` with `crdtSnapshot` fields

### Expected Outcome
- Single JSON file on Drive containing all project data
- `project.driveStorageFormat` in IndexedDB is `'bundle'`
- `project.driveFileId` in IndexedDB is the Drive file ID

---

## Validation Scenario 2: Bundle Import (Collaborator)

### Steps
1. Share the bundle file with a second Google account (via Drive sharing)
2. Open the app as the second user
3. Click "Mở dự án được chia sẻ" → single-file Picker opens
4. Select the shared bundle JSON file
5. Verify project and all chapters are imported into local workspace

### Expected Outcome
- Single Picker interaction (no folder picker, no multi-select)
- All chapters visible in the project
- `project.isOwner === false`, `project.driveStorageFormat === 'bundle'`
- No 404 errors, no "Đồng bộ file mới" prompts

---

## Validation Scenario 3: CRDT Merge on Pull

### Steps
1. As User A (owner): edit Chapter 1 paragraph 1, push to Drive
2. As User B (collaborator): edit Chapter 1 paragraph 2 locally (do NOT push)
3. As User B: trigger pull/sync
4. Verify Chapter 1 has BOTH User A's paragraph 1 changes AND User B's paragraph 2 changes

### Expected Outcome
- No data loss — both users' edits preserved
- `crdt_states` store in IndexedDB has updated binary state for Chapter 1
- Console shows CRDT merge log (not timestamp-LWW overwrite)

---

## Validation Scenario 4: Google Picker Sizing

### Steps
1. Set browser zoom to 125%
2. Open any Picker dialog (folder, file, or bundle)
3. Verify the Picker modal fits within viewport with visible header and action buttons

### Expected Outcome
- Picker width ≤ `Math.min(1051, innerWidth * 0.9)`
- Picker height ≤ `Math.min(650, innerHeight * 0.9)`
- All controls visible and clickable

---

## Validation Scenario 5: Migration from Granular to Bundle

### Steps
1. Have a project already using `driveStorageFormat: 'granular'` with `isOwner: true`
2. Open the app after the update
3. Trigger a sync/push operation
4. Verify a new bundle file is created on Drive
5. Verify local project record updated to `driveStorageFormat: 'bundle'`

### Expected Outcome
- Seamless owner migration, no manual steps
- Old granular files left on Drive (not deleted)
- Subsequent syncs use bundle format

---

## Quality Gates

Run all three commands and verify clean output:

```bash
npm run lint    # tsc --noEmit — zero errors
npm test        # vitest run — all tests pass, no skipped
npm run build   # vite build + esbuild — success
```
