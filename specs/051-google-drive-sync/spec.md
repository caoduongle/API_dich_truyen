# Feature Specification: Client-Side Google Authentication & Optional Google Drive Sync

**Feature Branch**: `051-google-drive-sync`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Thêm đăng nhập Google và đồng bộ Google Drive tùy chọn, thiết kế hoàn toàn client-side — không có bước xử lý OAuth nào chạy trên server. Bối cảnh kỹ thuật bắt buộc: Dùng OAuth 2.0 Authorization Code + PKCE cho public client (SPA) — KHÔNG dùng client secret, KHÔNG có bước trao đổi token qua server. Đăng nhập, làm mới token, và gọi Drive API diễn ra trực tiếp từ trình duyệt. Scope Drive: chỉ dùng 'drive.file' (quyền theo từng tệp — app chỉ đọc/ghi tệp do chính nó tạo ra), KHÔNG dùng scope Drive rộng hơn. Đây là lựa chọn có chủ đích để giữ mức xác minh OAuth ở dạng nhẹ. Đăng nhập chỉ yêu cầu profile cơ bản (tên, email, ảnh đại diện) — không yêu cầu thêm scope nào ngoài profile + drive.file. Đồng bộ Drive hoàn toàn tùy chọn — không đăng nhập vẫn dùng app bình thường (miễn đã có API key AI riêng theo thay đổi trước đó). Access/refresh token KHÔNG lưu ở bất kỳ database phía server nào — chỉ giữ tạm trong bộ nhớ trình duyệt. Đọc docs/privacy-policy.md để bám đúng cam kết đã công bố. Đồng bộ 2 chiều dữ liệu hiện có trong IndexedDB (src/services/db.ts: sách, bản dịch, bảng thuật ngữ) vào một thư mục riêng trong Drive của người dùng. Yêu cầu triển khai: Tính năng MỚI — không đụng vào directGeminiClient.ts / directTranslationEngine.ts đã hoàn thiện. Trong Implementation Plan, liệt kê rõ các bước THỦ CÔNG tôi cần tự làm trên Google Cloud Console (tạo OAuth Client ID loại 'Web application', khai báo Authorized JavaScript origins, bật Google Drive API, điền OAuth consent screen với link đến docs/privacy-policy.md) — đây là việc ngoài phạm vi code, agent không tự làm được. Theo AGENTS.md và .agents/rules/context-engineering.md: mỗi task ~4.000 token, implement từng nhóm nhỏ, Review-Driven Development. Chạy sau khi prompt 'loại bỏ fallback' đã xong."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Client-Side Google Authentication with OAuth 2.0 PKCE (Priority: P1)

As a user, I want to optionally log in with my Google account directly from my browser using OAuth 2.0 PKCE (without any server intermediary or server database storage), so that I can see my profile information (name, email, avatar) in the app header and prepare for personal cloud backup while maintaining 100% data privacy.

**Why this priority**: Establishes the secure client-side authentication boundary and identity foundation needed for interacting with Google APIs directly from the browser.

**Independent Test**: Click "Đăng nhập Google" in the navigation bar, complete the Google OAuth consent screen with minimal scopes (`openid`, `profile`, `email`, `drive.file`), and verify that the browser receives the token directly, displays the user's avatar, name, and email, and stores tokens strictly in client browser memory (zero server API calls).

**Acceptance Scenarios**:

1. **Given** a user is not logged in, **When** they click "Đăng nhập Google", **Then** the browser initiates standard OAuth 2.0 Authorization Code flow with PKCE (`code_challenge` / `code_verifier`), redirecting or opening Google's authentication prompt directly from the client.
2. **Given** the user approves Google login, **When** Google returns the authorization code, **Then** the client directly exchanges it for tokens with `https://oauth2.googleapis.com/token` using the PKCE verifier without sending client secret or hitting the app backend server.
3. **Given** successful login, **When** the profile is fetched from `https://www.googleapis.com/oauth2/v3/userinfo`, **Then** the app displays the user's avatar, display name, and email in the top navigation bar.
4. **Given** an unauthenticated user, **When** they choose not to log in, **Then** all local translation, glossary, and reading features remain 100% accessible (as long as they configure their personal Gemini API key).

---

### User Story 2 - Optional Bi-Directional Google Drive Cloud Sync (Priority: P1)

As an authenticated user, I want my projects, translation manuscripts, chapters, and glossaries currently stored in IndexedDB to automatically or manually sync bi-directionally with a dedicated folder in my own Google Drive, so that I never lose my work across devices or browser clears.

**Why this priority**: Solves the primary limitation of browser-only IndexedDB storage (device isolation and risk of accidental browser cache clearing) while keeping user data strictly between user's browser and their private Google Drive.

**Independent Test**: Log in with Google, create/edit a translation project with chapters and glossary items, click "Đồng bộ Drive" (or enable auto-sync), verify that a dedicated application folder (`AI_Dich_Truyen_Data/`) is created in Google Drive with JSON snapshot files, open the app on another clean browser profile, log in with the same Google account, and verify that the remote data restores cleanly into IndexedDB.

**Acceptance Scenarios**:

1. **Given** a logged-in user with Google Drive authorization (`drive.file` scope), **When** they trigger a sync, **Then** the client checks for the dedicated app folder in Drive (creating it if absent) and uploads project manifests, chapters, and glossary backups.
2. **Given** a clean browser session with no local data, **When** the user logs into Google and clicks "Tải về từ Drive", **Then** the application downloads remote project files and restores all projects, chapters, and glossaries into IndexedDB without data corruption.
3. **Given** existing local data and remote data, **When** synchronizing, **Then** the sync engine performs a timestamp comparison (`updatedAt`) to merge or update changed records without silently overwriting newer local edits.
4. **Given** the `drive.file` scope constraint, **When** interacting with Google Drive, **Then** the application strictly operates only within files/folders created by this application and never requests or accesses other files in the user's Google Drive.

---

### User Story 3 - Offline-First Resilience, Sync Conflict Resolution & Logout (Priority: P2)

As a user, I want clear visibility into sync status (Syncing, Up to date, Conflict, Offline, Error), the ability to manually resolve any synchronization conflicts, and a clean Sign-out mechanism that wipes in-memory credentials without deleting local IndexedDB data.

**Why this priority**: Guarantees data safety during network dropouts, gives users control over conflict resolution, and ensures proper privacy cleanup on sign-out.

**Independent Test**: Disconnect internet or simulate expired token, observe appropriate warning indicators in UI, trigger manual sync once reconnected, and test Sign-out to confirm that session tokens are completely discarded from memory while local IndexedDB books remain intact.

**Acceptance Scenarios**:

1. **Given** an active Google session, **When** the user clicks "Đăng xuất", **Then** in-memory access/refresh tokens are wiped, the UI reverts to the guest state, and local IndexedDB projects remain intact.
2. **Given** an expired access token during a sync operation, **When** Drive API returns HTTP 401, **Then** the client attempts silent token refresh using PKCE/refresh token or prompts the user to re-authorize gracefully.
3. **Given** simultaneous edits where both local and remote versions have been modified since last sync, **When** sync runs, **Then** the user is presented with a clear conflict dialog allowing them to choose (Keep Local, Use Remote, or Save as Copy).

---

### Edge Cases

- **Google Drive Storage Full / Quota Exceeded**: If the user's Google Drive returns `403 Insufficient Storage`, the client catches the error and surfaces a friendly notification without crashing or corrupting local IndexedDB data.
- **Network Interruption During Multi-Chapter Sync**: If network drops mid-upload, already synced files remain valid, and the sync engine tracks dirty flags to resume only unsynced chapters on the next run.
- **Third-Party Cookies Blocked / Popup Blockers**: If Google OAuth popup is blocked by the browser, a fallback redirect or embedded modal warning instructs the user to allow popups for authentication.
- **Zero Server Token Footprint**: Under no circumstances does any client token, code verifier, or Google profile payload ever touch the backend Express server.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST implement Google OAuth 2.0 Authorization Code Flow with PKCE directly on the client side (SPA architecture) without using any client secret or backend token exchange endpoint.
- **FR-002**: The Google OAuth request MUST strictly request only minimal scopes: `openid`, `https://www.googleapis.com/auth/userinfo.profile`, `https://www.googleapis.com/auth/userinfo.email`, and `https://www.googleapis.com/auth/drive.file`.
- **FR-003**: Google login and Google Drive sync MUST be entirely optional; users who choose not to log in MUST retain full access to all local translation, glossary, and export features.
- **FR-004**: All OAuth access tokens, refresh tokens, and user profile data MUST NOT be sent to or stored in any server-side database or log, conforming strictly to `docs/privacy-policy.md`.
- **FR-005**: The Google Drive sync engine MUST operate exclusively on files and folders created by the app (under the `drive.file` scope permission).
- **FR-006**: The sync engine MUST support bi-directional synchronization between client IndexedDB (`projects`, `chapters`, `glossary`) and Google Drive with timestamp-based conflict detection.
- **FR-007**: The UI MUST provide a dedicated Google Account & Sync status widget in the header/modal showing login state, user avatar, email, last sync timestamp, and manual "Đồng bộ ngay" (Sync Now) trigger.
- **FR-008**: The implementation MUST NOT modify the core direct translation engine (`directGeminiClient.ts` / `directTranslationEngine.ts`).
- **FR-009**: The Implementation Plan MUST provide a clear, step-by-step manual setup checklist for the user to configure Google Cloud Console (OAuth Client ID "Web application", Authorized JavaScript origins, Google Drive API enablement, OAuth consent screen configuration).

---

### Key Entities *(include if feature involves data)*

- **Google Auth Session**: Client-side in-memory/session state containing `accessToken`, `idToken`, token expiry, and user profile (`name`, `email`, `picture`).
- **PKCE Pair**: Ephemeral cryptographic `code_verifier` and SHA-256 `code_challenge` generated on-the-fly in browser for secure authorization code exchange.
- **Drive Sync Manifest**: JSON metadata file stored in the user's Google Drive dedicated folder detailing project IDs, version timestamps, and sync checkpoints.
- **Sync State**: Local sync tracking entity storing `lastSyncTime`, `syncStatus` (`idle`, `syncing`, `success`, `error`, `conflict`), and list of pending dirty entities.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of OAuth authentication and Google Drive API communication runs directly between the client browser and Google APIs (`accounts.google.com`, `oauth2.googleapis.com`, `googleapis.com/drive/v3`), with 0 bytes of OAuth data or Drive content routed through the application backend.
- **SC-002**: Users can complete Google Sign-in in under 10 seconds with a standard Google popup/redirect flow.
- **SC-003**: Full project backup (metadata, chapters, and glossary) to Google Drive completes in under 5 seconds for standard projects (< 50 chapters) under normal broadband network conditions.
- **SC-004**: Users without a Google account experience 0 disruption or forced prompts when using the application for translation.
- **SC-005**: All code changes maintain 0 TypeScript errors (`npm run lint`), 100% test pass rate (`npm test`), and successful production build (`npm run build`).

---

## Assumptions

- The user will obtain and configure a valid `VITE_GOOGLE_CLIENT_ID` in their environment or UI settings from the Google Cloud Console.
- The Google Cloud OAuth consent screen is configured with appropriate redirect URIs / Authorized JavaScript origins matching the app's hosting origin (e.g. `http://localhost:5173`, `http://localhost:3000`, or production Cloud Run URL).
- Google Drive's `drive.file` scope is sufficient to create and manage the application's dedicated sync folder and files without requiring full Drive access.
