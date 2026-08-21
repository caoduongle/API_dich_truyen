# Implementation Plan: Client-Side Google Authentication & Google Drive Bi-directional Sync

**Feature Directory**: `specs/051-google-drive-sync`
**Date**: 2026-08-22

---

## 1. Technical Context

- **Goal**: Provide an optional, 100% client-side Google login and Google Drive bi-directional backup/sync for projects, chapters, and glossaries currently stored in IndexedDB.
- **Architecture**:
  - **OAuth 2.0 PKCE for SPA**: Code verifier and challenge generated natively in browser via Web Crypto API (`crypto.subtle`). Authorization code exchanged directly with `https://oauth2.googleapis.com/token`. Zero client secrets, zero server intermediary.
  - **Scope Limitation**: Strictly uses `openid`, `profile`, `email`, and `https://www.googleapis.com/auth/drive.file`. The app can only see and edit files it created in the user's Drive.
  - **Zero Server Token Footprint**: In strict alignment with [`docs/privacy-policy.md`](../../docs/privacy-policy.md), access tokens, user profiles, and synced book files never touch the backend server database or server logs.
  - **Non-blocking / Optional**: Guest users who choose not to log in can continue using all translation and reading capabilities unhindered.
  - **Isolation**: Does not touch or modify the core direct translation engine (`directGeminiClient.ts`, `directTranslationEngine.ts`).

---

## 2. Constitution & Quality Gates Check

- [x] **Principle I (Quality Gates)**: `npm run lint`, `npm test`, and `npm run build` must pass cleanly.
- [x] **Principle II (Dependency Minimization)**: Native Web APIs (`fetch`, `crypto.subtle`, `IndexedDB`) and existing project libraries (`lucide-react`, `motion`) used; 0 new NPM packages required.
- [x] **Principle III (Domain Separation)**: 100% client-side modules; backend server remains unaffected.
- [x] **Principle IV (Core Schemas)**: `src/types.ts` schemas for Project, Chapter, and Glossary are respected and safely serialized to Drive JSON snapshots.
- [x] **Principle V (Review-Driven Development)**: Itemized file plan and Google Cloud setup steps presented for review.

---

## 3. Manual Steps Required on Google Cloud Console (For User)

Before testing the Google Sign-in flow in a live browser, the following manual configuration must be completed in the Google Cloud Console:

1. **Go to Google Cloud Console**: Open [console.cloud.google.com](https://console.cloud.google.com/) and create or select a project.
2. **Enable Google Drive API**:
   - Go to **APIs & Services > Library**.
   - Search for **Google Drive API** and click **Enable**.
3. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services > OAuth consent screen**.
   - Select **External** and click **Create**.
   - Fill in:
     - **App name**: `AI Dịch Truyện`
     - **User support email**: Your Google email
     - **Developer contact email**: Your Google email
     - **Privacy Policy link**: `https://<your-domain>/docs/privacy-policy.md` (or your repo privacy policy link)
   - In **Scopes**, add:
     - `.../auth/userinfo.profile`
     - `.../auth/userinfo.email`
     - `openid`
     - `https://www.googleapis.com/auth/drive.file`
   - In **Test users**, add your Google account email.
4. **Create OAuth 2.0 Client ID**:
   - Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Select **Web application**.
   - Set **Authorized JavaScript origins**:
     - `http://localhost:5173` (for local development)
     - `http://localhost:3000` (for local preview/server)
     - `https://<your-production-domain>` (if deployed)
   - Set **Authorized redirect URIs**:
     - `http://localhost:5173`
     - `http://localhost:3000`
     - `https://<your-production-domain>`
   - Copy the generated **Client ID** (e.g. `123456789-xyz.apps.googleusercontent.com`).
5. **Add Client ID to Project**:
   - Add `VITE_GOOGLE_CLIENT_ID="<your-client-id>"` in `.env` (or configure via the Google Sync modal in the UI).

---

## 4. Proposed Changes & Itemized File List

### New Files to Create

1. **[NEW]** [`src/types/googleAuth.ts`](../../src/types/googleAuth.ts):
   - Type definitions for `GoogleUserProfile`, `GoogleAuthState`, and PKCE challenge.
2. **[NEW]** [`src/types/googleDriveSync.ts`](../../src/types/googleDriveSync.ts):
   - Type definitions for `DriveSyncManifest`, `DriveProjectSummary`, `SyncProgress`, and `SyncConflictInfo`.
3. **[NEW]** [`src/services/pkceHelper.ts`](../../src/services/pkceHelper.ts):
   - Native Web Crypto helpers to generate `code_verifier`, SHA-256 `code_challenge`, and secure state strings.
4. **[NEW]** [`src/services/googleAuthService.ts`](../../src/services/googleAuthService.ts):
   - Google OAuth 2.0 PKCE authorization code generator, popup/redirect handling, token direct exchange, user profile retrieval, and memory/session management.
5. **[NEW]** [`src/services/googleDriveSyncService.ts`](../../src/services/googleDriveSyncService.ts):
   - Google Drive REST API v3 client (`drive.file` scope): folder discovery/creation (`AI_Dich_Truyen_Data`), multipart JSON upload, JSON download, manifest management, and 2-way sync reconciliation with IndexedDB.
6. **[NEW]** [`src/components/google-sync/GoogleSyncModal.tsx`](../../src/components/google-sync/GoogleSyncModal.tsx):
   - Modal dialog providing Google login status, Client ID configuration, manual Push (Backup), Pull (Restore), Bi-directional Sync triggers, and real-time progress indicators.
7. **[NEW]** [`src/components/google-sync/GoogleUserButton.tsx`](../../src/components/google-sync/GoogleUserButton.tsx):
   - Header navigation button rendering Google avatar/login button and sync status icon badge.
8. **[NEW]** [`src/services/__tests__/pkceHelper.test.ts`](../../src/services/__tests__/pkceHelper.test.ts):
   - Unit tests for PKCE verifier and challenge generation.
9. **[NEW]** [`src/services/__tests__/googleDriveSyncService.test.ts`](../../src/services/__tests__/googleDriveSyncService.test.ts):
   - Unit tests for manifest serialization, folder discovery, and bi-directional timestamp reconciliation.

### Existing Files to Modify

10. **[MODIFY]** [`src/App.tsx`](../../src/App.tsx):
    - Integrate `GoogleUserButton` into top header bar and render `GoogleSyncModal` when triggered.
    - Check for incoming Google OAuth redirect query params (`code`, `state`) on app load.
11. **[MODIFY]** [`.env.example`](../../.env.example):
    - Document optional `VITE_GOOGLE_CLIENT_ID` configuration.
12. **[MODIFY]** [`README.md`](../../README.md) & [`docs/privacy-policy.md`](../../docs/privacy-policy.md):
    - Update documentation highlighting optional Google Drive backup with `drive.file` minimal scope and zero server token storage.

---

## 5. Verification Plan

### Automated Tests
- `npx vitest run src/services/__tests__/pkceHelper.test.ts`
- `npx vitest run src/services/__tests__/googleDriveSyncService.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build` (`vite build` + esbuild)

### Manual Verification
- Verify Google OAuth PKCE login flow directly in browser.
- Verify Drive folder creation and JSON upload under `drive.file` scope.
- Verify download/restore into IndexedDB.
- Verify guest mode continues working without Google login.
