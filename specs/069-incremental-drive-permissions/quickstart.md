# Quickstart & Verification Guide: Incremental Drive Permissions

**Feature**: `069-incremental-drive-permissions`
**Date**: 2026-08-23

---

## 1. Prerequisites

- Node.js 18+ and npm installed
- Google Cloud project with Google Drive API and Google Picker API enabled
- Test Google accounts (Owner: User A, Collaborator: User B)

---

## 2. Automated Test Verification

Run all unit tests and quality verification commands:

```bash
# Typecheck
npm run lint

# Vitest tests
npm test

# Production build
npm run build
```

---

## 3. Manual Scenario Walkthroughs

### Scenario 1: First-Time Import of Shared Project
1. User A (Owner) shares a project folder `AI_Dich_Truyen_Data/proj_xxx` with User B (Collaborator) via `ShareProjectModal`.
2. User B logs into Google inside AI Dịch Truyện.
3. User B clicks **"Mở dự án được chia sẻ (Google Picker)"** in `GoogleSyncModal`.
4. First Picker opens: User B selects the shared folder.
5. Second Picker opens automatically, showing files within that folder (`project.json`, `manifest.json`, `chapter_*.json`).
6. User B selects all files and confirms.
7. System imports project and chapters cleanly into IndexedDB with zero errors.

### Scenario 2: Synchronizing Newly Added Chapters
1. User A adds 3 new chapters to the project and pushes to Google Drive.
2. User B opens `ShareProjectModal` or runs Two-Way Sync in `GoogleSyncModal`.
3. If User B runs Two-Way Sync first:
   - Existing chapters sync cleanly.
   - A warning notification displays: *"Đã đồng bộ X/Y chương — còn 3 chương mới cần bấm 'Đồng bộ file mới'"*.
4. User B clicks **"Đồng bộ file mới"**:
   - The multi-file picker opens pre-anchored to the project folder.
   - User B selects all files and confirms.
   - All 3 new chapters are downloaded and populated in User B's local workspace.
