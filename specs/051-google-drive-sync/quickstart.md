# Quickstart & Verification Guide: Google Auth & Drive Sync

**Feature Directory**: `specs/051-google-drive-sync`
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

## 2. Manual End-to-End Verification Scenarios

### Scenario A: Google Sign-in with OAuth PKCE
1. Configure `VITE_GOOGLE_CLIENT_ID` in `.env` or in the Google Sync Settings modal.
2. In the navigation bar, click **Đăng nhập Google**.
3. Complete the Google authorization dialog.
4. Verify user avatar, name, and email render in the navbar.
5. Inspect Network tab: Confirm requests to `accounts.google.com`, `oauth2.googleapis.com`, and `googleapis.com` are dispatched directly from the browser with 0 calls to backend server endpoints.

### Scenario B: Cloud Backup (IndexedDB -> Google Drive)
1. In the app, create or open a project with several chapters and glossary terms.
2. Click **Đồng bộ Google Drive** -> **Sao lưu lên Drive (Push)**.
3. Open `drive.google.com` in a separate tab.
4. Verify the folder `AI_Dich_Truyen_Data` exists and contains `manifest.json`, `project_*.json`, and `chapters_*.json`.

### Scenario C: Cloud Restore (Google Drive -> IndexedDB)
1. Open a new private/incognito browser window (or clear local IndexedDB).
2. Log in with the same Google Account.
3. Click **Đồng bộ Google Drive** -> **Khôi phục từ Drive (Pull)**.
4. Verify all projects, chapters, and glossary entries are restored into IndexedDB and accessible in the Workspace.

### Scenario D: Guest Mode / Opt-Out Continuity
1. Do not log in (or click Sign-out).
2. Create and translate chapters with a personal Gemini API key.
3. Verify that the app works normally with zero blocking prompts.
