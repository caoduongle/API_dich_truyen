# Quickstart & Verification Guide: Project Sharing & Drive Collaboration

**Feature Directory**: `specs/052-drive-collaboration`
**Date**: 2026-08-22

---

## 1. Automated Verification Commands

```bash
# 1. Typecheck (Must be 100% clean)
npm run lint

# 2. Unit & Integration Tests (vitest)
npm test

# 3. Production Build
npm run build
```

---

## 2. End-to-End Collaboration Scenarios

### Scenario A: Owner Migrates & Shares Project
1. User A logs in with Google.
2. In Project List or Sync Modal, click **"Chia sẻ"** for Project 1.
3. System automatically creates subfolder `AI_Dich_Truyen_Data/{projectId}/` and uploads `project.json` and separate `chapter_*.json` files.
4. User A inputs User B's Google email (`userB@gmail.com`) and clicks **"Cấp quyền"**.
5. Verify User B appears in the collaborator list.
6. Verify on `drive.google.com` that User A's unshared projects remain flat monolithic files.

### Scenario B: Collaborator Opens Shared Project via Google Picker
1. In an Incognito window or separate browser, User B logs in with Google (`userB@gmail.com`).
2. User B clicks **"Mở dự án được chia sẻ"**.
3. Google Picker dialog opens. User B selects User A's shared folder.
4. System downloads `project.json` and all `chapter_*.json` files into User B's local IndexedDB.
5. User B can now read and edit the project locally.

### Scenario C: Concurrent Non-Conflicting Chapter Edits
1. User A translates Chapter 1 and clicks **"Đồng bộ"**.
2. User B translates Chapter 2 and clicks **"Đồng bộ"**.
3. User A clicks **"Đồng bộ"**.
4. Both Chapter 1 and Chapter 2 are updated in the shared folder and in both users' workspaces without any conflict.

### Scenario D: Same-Chapter Conflict Resolution
1. Both User A and User B translate Chapter 3 simultaneously.
2. User A clicks **"Đồng bộ"** (uploads Chapter 3).
3. User B clicks **"Đồng bộ"** -> Chapter Conflict Modal appears for Chapter 3.
4. User B chooses **"Lưu thành bản sao"** -> User B's local translation is saved as `Chương 3 (Bản sao)`, and User A's version is pulled as `Chương 3`.
