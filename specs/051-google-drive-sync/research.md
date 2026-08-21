# Research & Architectural Decisions: Client-Side Google Authentication & Google Drive Sync

**Feature Directory**: `specs/051-google-drive-sync`
**Date**: 2026-08-22

---

## 1. OAuth 2.0 Authorization Code with PKCE (Client-Side Only)

### Decision 1: Browser-Native PKCE Cryptography
- **Mechanism**: Use standard Web Cryptography API (`crypto.subtle` and `crypto.getRandomValues`) available in all modern browsers.
- **Code Verifier**: 43–128 character cryptographically random high-entropy string (`[A-Za-z0-9-._~]`).
- **Code Challenge**: `BASE64URL(SHA-256(ASCII(code_verifier)))`.
- **Google OAuth Endpoints**:
  - Authorization Endpoint: `https://accounts.google.com/o/oauth2/v2/auth`
  - Token Endpoint: `https://oauth2.googleapis.com/token`
  - User Info Endpoint: `https://www.googleapis.com/oauth2/v3/userinfo`
- **Zero Client Secret & Zero Server Exchange**:
  - Google's OAuth 2.0 endpoint for Web Applications natively supports authorization code flow with PKCE without requiring a `client_secret`.
  - The client exchanges the authorization code directly with `oauth2.googleapis.com/token` by sending `client_id`, `code_verifier`, `code`, `grant_type=authorization_code`, and `redirect_uri`.
  - No server intermediary is involved.

### Decision 2: Minimal Scope Strategy (`drive.file`)
- **Scopes Requested**:
  - `openid`
  - `https://www.googleapis.com/auth/userinfo.profile`
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/drive.file`
- **Rationale**:
  - `drive.file` gives the application permission only to create, read, and edit files and folders that the application itself created in the user's Google Drive.
  - The application cannot access, list, or view any other files in the user's Drive.
  - Keeps Google OAuth Verification in the lightweight/non-sensitive category, avoiding complex Google verification audits.

### Decision 3: Token In-Memory & Session Storage Lifecycle
- **Tokens**: `accessToken`, `idToken`, `expiresAt`.
- **Storage**: Kept in client application runtime state (`React Context / Service Instance`) and optionally cached in `sessionStorage` (encrypted/session-bound) for tab refreshes.
- **Zero Server Storage**: Absolutely 0 tokens, profile data, or sync manuscripts are sent to the backend database or logged on the server, maintaining 100% adherence to [`docs/privacy-policy.md`](../../docs/privacy-policy.md).

---

## 2. Google Drive Bi-Directional Synchronization Architecture

### Structure in User's Google Drive:
```text
Google Drive Root
└── 📁 AI_Dich_Truyen_Data/               (Folder created with drive.file)
    ├── manifest.json                     (Sync index: project summaries, versions, last sync)
    ├── project_{projectId}.json          (Project metadata, genres, tone, glossary snapshot)
    └── chapters_{projectId}.json         (Complete chapter text, translations, paragraphs)
```

### Sync Protocol:
1. **Folder Discovery & Initialization**:
   - Query Drive API: `mimeType = 'application/vnd.google-apps.folder' and name = 'AI_Dich_Truyen_Data' and trashed = false`.
   - If not found: `POST https://www.googleapis.com/drive/v3/files` to create folder.
2. **Push (Upload Local -> Drive)**:
   - Export project data from IndexedDB via existing methods in `src/services/db.ts`.
   - Perform multipart upload (`POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`) to update or create `project_{id}.json` and `chapters_{id}.json`.
   - Update `manifest.json`.
3. **Pull (Restore Drive -> Local)**:
   - Fetch `manifest.json`.
   - Download project & chapter JSON files.
   - Upsert into IndexedDB via `saveProjectToDB` and `saveChapterToDB`.
4. **Conflict Handling**:
   - Compare `updatedAt` timestamps between local IndexedDB and Drive files.
   - If local `updatedAt` > remote `updatedAt`, local wins on push.
   - If remote `updatedAt` > local `updatedAt`, remote wins on pull.
   - If bidirectional conflict detected (both modified since last sync), prompt user with non-destructive option (Keep Local / Overwrite Remote / Save as Copy).

---

## 3. Manual Google Cloud Console Setup Guide (For User)

These manual steps must be performed in the Google Cloud Console by the user:

1. **Create or Select a Google Cloud Project**:
   - Navigate to [Google Cloud Console](https://console.cloud.google.com/).
   - Click the project dropdown at the top and click **New Project** (e.g. `AI-Dich-Truyen`).
2. **Enable Google Drive API**:
   - In the sidebar, go to **APIs & Services > Library**.
   - Search for **Google Drive API** and click **Enable**.
3. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services > OAuth consent screen**.
   - Choose **External** User Type and click **Create**.
   - Fill in:
     - App name: `AI Dịch Truyện`
     - User support email: (Your Google email)
     - Developer contact email: (Your Google email)
     - Application Privacy Policy link: `https://<your-domain>/docs/privacy-policy.md` (or local file reference)
   - Click **Save and Continue**.
   - In the **Scopes** step, click **Add or Remove Scopes** and select:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
     - `https://www.googleapis.com/auth/drive.file`
   - In **Test Users**, add your Google email address (while in Testing mode).
4. **Create OAuth 2.0 Client ID**:
   - Go to **APIs & Services > Credentials**.
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Name: `AI Dịch Truyện Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (Vite dev server)
     - `http://localhost:3000` (Local production server)
     - `https://<your-cloud-run-url>` (If deployed)
   - **Authorized redirect URIs**:
     - `http://localhost:5173`
     - `http://localhost:3000`
     - `https://<your-cloud-run-url>`
   - Click **Create** and copy the **Client ID** (e.g. `1234567890-xxx.apps.googleusercontent.com`).
5. **Configure Client ID in App**:
   - Set `VITE_GOOGLE_CLIENT_ID="<your-client-id>"` in `.env` or input it into the app's Google Sync configuration modal.
