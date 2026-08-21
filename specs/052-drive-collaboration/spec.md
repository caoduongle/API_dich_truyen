# Feature Specification: Project Sharing & Multi-User Collaboration via Google Drive

**Feature Branch**: `052-drive-collaboration`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Thêm tính năng 'Chia sẻ dự án & Cộng tác qua Google Drive' cho tối đa vài người dùng, MỞ RỘNG trực tiếp trên nền Google Drive sync cá nhân đã triển khai xong ở specs/051-google-drive-sync — KHÔNG viết lại luồng OAuth 2.0 PKCE đã có (src/services/pkceHelper.ts, src/services/googleAuthService.ts), tái dùng nguyên vẹn; chỉ mở rộng src/services/googleDriveSyncService.ts, src/components/google-sync/GoogleSyncModal.tsx, GoogleUserButton.tsx, và thêm type/service/component mới khi cần. Mô hình cộng tác: Người A (chủ dự án) tạo một sub-folder riêng cho từng dự án tại AI_Dich_Truyen_Data/{projectId}/ trên Drive của A — 051 hiện lưu phẳng project_{id}.json + chapters_{id}.json chung 1 folder gộp, cần tách theo từng project mới chia sẻ riêng lẻ được mà không lộ các dự án khác của A. A bấm nút 'Chia sẻ' mới trong GoogleSyncModal, nhập email Google của B; ứng dụng gọi Drive API Permissions (POST /files/{folderId}/permissions, role: 'writer', type: 'user') để cấp quyền ghi cho B trên đúng folder đó — vẫn nằm trong scope drive.file hiện có vì app chỉ thao tác trên folder do chính nó tạo ra, không xin thêm scope Drive rộng hơn (xác nhận lại đúng hành vi này của Permissions API dưới drive.file ở bước research của /speckit-plan trước khi implement — đây là điểm cần verify kỹ, không giả định suông). B đăng nhập Google bằng đúng luồng PKCE đã có sẵn, bấm 'Mở dự án được chia sẻ', dùng Google Picker (tích hợp MỚI — nạp script Picker qua thẻ script chèn động lúc runtime, KHÔNG thêm NPM package, đúng nguyên tắc Dependency Minimization trong Constitution) để chọn đúng folder A đã chia sẻ — bắt buộc qua Picker vì scope drive.file không cho B liệt kê file B không tự tạo, đây là cách duy nhất Google cho phép cấp quyền tệp đó cho B. Sau khi chọn, lưu driveFolderId tương ứng vào IndexedDB của B, từ đó B Tải về (Pull)/Đẩy lên (Push) bằng đúng luồng sync đã có. Thay đổi lưu trữ bắt buộc: ngay khi A bấm Chia sẻ lần đầu cho 1 dự án, thực hiện migration tách chapters_{projectId}.json (đang gộp toàn bộ chương) thành từng file riêng chapter_{chapterId}.json; dự án CHƯA từng chia sẻ vẫn giữ nguyên hành vi gộp file như 051, không đổi gì cả, để không phá luồng cá nhân đang chạy ổn định. Lý do bắt buộc tách: nếu 2 người sửa 2 chương khác nhau cùng lúc mà vẫn dùng 1 file gộp, mỗi lần lưu sẽ ghi đè lẫn nhau dù không thực sự đụng chương của nhau. Xung đột vẫn kiểm tra theo updatedAt như cơ chế đã có ở User Story 3 của 051 (dialog Keep Local / Use Remote / Save as Copy), nhưng áp dụng ở cấp từng chapter thay vì cấp cả project khi dự án đang chia sẻ. Vì chỉ tối đa vài người cộng tác và không có server trung gian, KHÔNG cần đồng bộ real-time — giữ triết lý pull/push thủ công đã chọn ở 051, không thêm polling hay WebSocket. Trong Implementation Plan, liệt kê rõ các bước THỦ CÔNG MỚI cần làm thêm trên Google Cloud Console so với 051: bật thêm 'Google Picker API' (khác Drive API đã bật sẵn), tạo một API key riêng cho Picker (không phải OAuth Client ID) và giới hạn theo HTTP referrer, thêm email từng người cộng tác vào 'Test users' ở OAuth consent screen nếu app còn ở chế độ Testing — hoặc ghi chú điều kiện chuyển app sang 'In production' mà không cần Google review vì drive.file là scope non-sensitive. Không đụng directGeminiClient.ts/directTranslationEngine.ts. Mọi UI mới (nút Chia sẻ, danh sách cộng tác viên, trigger Picker, dialog xung đột theo chương) phải đọc .agents/rules/design-system.md trước khi viết — tái dùng Button/Badge/Seal/EmptyState sẵn có trong src/components/ui/, không tự chế màu/bo góc/emoji mới; cân nhắc trích xuất Modal.tsx dùng chung như design-system.md đã gợi ý nếu thêm modal Share mới, thay vì viết thêm 1 modal tự chế nữa. Theo AGENTS.md và .agents/rules/context-engineering.md: mỗi task ~4.000 token, implement từng nhóm nhỏ, Review-Driven Development, checkpoint rõ sau mỗi phase. Chạy sau khi specs/051-google-drive-sync đã xong (hiện đã xong toàn bộ 17 task)."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project Sub-Folder Isolation & Granular Chapter File Migration (Priority: P1)

As a project owner (User A), when I decide to share a specific translation project with collaborators, I want the application to automatically organize that project into its own dedicated sub-folder on Google Drive (`AI_Dich_Truyen_Data/{projectId}/`) and migrate its chapter storage from a single monolithic file (`chapters_{projectId}.json`) into individual per-chapter files (`chapter_{chapterId}.json`), while keeping all unshared projects in their standard monolithic format, so that my other private projects remain hidden and multiple collaborators can edit different chapters simultaneously without overwriting each other's work.

**Why this priority**: Subfolder isolation is the foundational security and storage requirement that enables selective project sharing and prevents multi-user chapter overwriting.

**Independent Test**: Create a project with multiple chapters, click "Chia sẻ" in the Google Sync modal for the first time, verify on `drive.google.com` that a new folder `AI_Dich_Truyen_Data/{projectId}/` is created containing `project.json` and separate `chapter_{id}.json` files, and verify that unshared projects continue using the flat monolithic structure without disruption.

**Acceptance Scenarios**:

1. **Given** an unshared project with monolithic storage on Google Drive, **When** the owner initiates the first share action, **Then** the application performs an automatic migration creating a dedicated subfolder `AI_Dich_Truyen_Data/{projectId}/`, uploads `project.json`, and splits all chapters into individual `chapter_{chapterId}.json` files.
2. **Given** multiple unshared projects on the user's Drive, **When** one project is shared, **Then** only the shared project is migrated to a subfolder; all other unshared projects remain in their original flat structure (`project_{id}.json` + `chapters_{id}.json`).
3. **Given** a project that has been migrated, **When** new chapters are added or existing chapters are updated, **Then** the sync engine uploads or updates only the specific modified `chapter_{chapterId}.json` files.

---

### User Story 2 - Share Project with Collaborators via Google Drive Permissions API (Priority: P1)

As a project owner (User A), I want to invite one or more collaborators (User B, User C) by entering their Google email addresses in the Share dialog, so that Google Drive grants them "writer" permissions on that project's specific sub-folder directly via the Drive Permissions API without granting access to my other files.

**Why this priority**: Allows the project owner to grant fine-grained, secure write access to collaborators using Google's native authorization system under the minimal `drive.file` scope.

**Independent Test**: Open the Share dialog for a project, input a valid collaborator email address, click "Cấp quyền", verify via Drive API that a Permission record of type `user` and role `writer` is created on the project sub-folder, and verify that the collaborator appears in the project's collaborator list.

**Acceptance Scenarios**:

1. **Given** an authenticated project owner in the Share dialog, **When** they enter a collaborator's Google email and submit, **Then** the application calls Google Drive Permissions API (`POST https://www.googleapis.com/drive/v3/files/{folderId}/permissions`) with role `writer` and type `user`.
2. **Given** an invalid or non-existent email, **When** Google Drive API returns an error (e.g. 404 or 400), **Then** the application surfaces a clear error notification without corrupting the project or folder state.
3. **Given** an existing collaborator on the project, **When** the owner views the Share dialog, **Then** the list of active collaborators is displayed with option to revoke permissions (`DELETE /files/{folderId}/permissions/{permissionId}`).

---

### User Story 3 - Open Shared Project via Client-Side Google Picker API (Priority: P1)

As an invited collaborator (User B), I want to click "Mở dự án được chia sẻ" in the app, pick the shared project folder via the native Google Picker file selector dialog, and import it into my local IndexedDB, so that I can pull the latest chapters and push my translations using the existing sync engine under the `drive.file` scope.

**Why this priority**: Google Picker is the mandatory, Google-approved mechanism for a public client under `drive.file` to acquire authorized access to a file/folder shared by another user.

**Independent Test**: Log in as User B, click "Mở dự án được chia sẻ", select the folder shared by User A in the Google Picker popup, verify that the project metadata and individual chapter files are downloaded and saved into User B's IndexedDB, and verify that User B's project record stores the `driveFolderId`.

**Acceptance Scenarios**:

1. **Given** User B is logged into Google, **When** User B clicks "Mở dự án được chia sẻ", **Then** the application dynamically loads the Google Picker script (`https://apis.google.com/js/api.js`) if not already loaded, and opens the Google Picker dialog configured with User B's OAuth token and Developer API Key.
2. **Given** User B selects User A's shared folder in the Picker, **When** the Picker returns the folder ID, **Then** the app reads `project.json` and all `chapter_*.json` files from that folder, imports them into IndexedDB, and binds the project to that `driveFolderId`.
3. **Given** a shared project in User B's workspace, **When** User B clicks "Tải về (Pull)" or "Sao lưu (Push)", **Then** the sync engine communicates directly with the shared subfolder on User A's Drive.

---

### User Story 4 - Chapter-Level Granular Sync & Conflict Resolution (Priority: P2)

As a collaborator or project owner, when synchronizing a shared project, I want the system to synchronize each chapter individually based on `updatedAt` timestamps and present a conflict resolution dialog only for chapters that have conflicting simultaneous edits, so that non-conflicting chapters sync seamlessly without overwriting work.

**Why this priority**: Guarantees collaboration safety and fine-grained data integrity when multiple translators work on different chapters of the same book.

**Independent Test**: Simulate two users modifying different chapters and syncing (both succeed without conflict), then simulate two users modifying the same chapter and syncing (triggers chapter-level conflict dialog: Keep Local, Use Remote, Save as Copy).

**Acceptance Scenarios**:

1. **Given** User A edits Chapter 1 and User B edits Chapter 2, **When** both users sync with the shared folder, **Then** both Chapter 1 and Chapter 2 update successfully in the shared subfolder with zero conflicts.
2. **Given** both User A and User B modify Chapter 3 since their last sync, **When** User B synchronizes, **Then** a conflict dialog for Chapter 3 displays local vs. remote timestamps and gives User B the choice: "Giữ bản dịch máy này (Keep Local)", "Dùng bản trên Drive (Use Remote)", or "Lưu thành bản sao (Save as Copy)".
3. **Given** User B chooses "Lưu thành bản sao", **When** resolved, **Then** the local chapter is preserved as a new version/fork in IndexedDB and the remote version is pulled.

---

### Edge Cases

- **Collaborator Email Not Registered with Google**: If a non-Google email is entered, Google Drive API returns an error; the UI displays "Email không phải là tài khoản Google hợp lệ hoặc không thể nhận quyền chia sẻ".
- **Google Picker Popup Blocked**: If the browser blocks the Google Picker popup, the application provides an on-screen retry button and instruction to allow popups.
- **Shared Folder Deleted by Owner**: If User A deletes the folder on Drive, User B's subsequent sync attempt surfaces a clear warning "Thư mục chia sẻ không còn tồn tại trên Google Drive" without deleting User B's local IndexedDB copy.
- **Offline / Token Expired During Collaboration**: If an access token expires while interacting with a shared folder, the client prompts for re-authentication before proceeding.
- **Collaborator Without Gemini Key**: Collaborators can download and view shared translations, but must configure their own personal Gemini API key to run AI translation on chapters.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST reuse the existing OAuth 2.0 PKCE client implementation (`pkceHelper.ts`, `googleAuthService.ts`) with zero modifications to the core auth handshake.
- **FR-002**: The system MUST support migrating a project's Drive storage from flat monolithic files (`project_{id}.json` + `chapters_{id}.json`) to a dedicated sub-folder (`AI_Dich_Truyen_Data/{projectId}/`) containing `project.json` and individual `chapter_{chapterId}.json` files upon first share.
- **FR-003**: Unshared projects MUST continue using the flat monolithic format established in Feature 051 without any breaking changes.
- **FR-004**: The project owner MUST be able to grant or revoke "writer" permissions to collaborators by email using Google Drive Permissions API (`/files/{folderId}/permissions`) under the existing `drive.file` scope.
- **FR-005**: The system MUST dynamically inject and initialize the Google Picker API script (`https://apis.google.com/js/api.js`) at runtime without adding any new NPM package dependencies.
- **FR-006**: Collaborators MUST be able to browse and select shared project folders via Google Picker to establish authorization and bind the `driveFolderId` in local IndexedDB.
- **FR-007**: The sync engine MUST support per-chapter granular Push/Pull for shared projects, uploading/downloading only modified `chapter_{chapterId}.json` files based on timestamp comparison.
- **FR-008**: The system MUST display a chapter-level conflict resolution modal whenever both local and remote copies of a specific chapter have diverged since the last sync.
- **FR-009**: The system MUST maintain a manual Push/Pull sync model without continuous background polling or WebSocket servers.
- **FR-010**: All UI components (Share modal, Collaborator list, Picker trigger, Conflict dialog) MUST strictly adhere to `.agents/rules/design-system.md` using existing UI primitives (`Button`, `Badge`, `Seal`, `EmptyState`) and shared `Modal`.
- **FR-011**: The core translation engines (`directGeminiClient.ts` and `directTranslationEngine.ts`) MUST remain 100% untouched.
- **FR-012**: The Implementation Plan MUST provide clear, step-by-step instructions for manual Google Cloud Console configuration (enabling Google Picker API, creating a dedicated Picker API key with HTTP referrer restriction, and managing test users / production status).

---

### Key Entities *(include if feature involves data)*

- **Shared Project Configuration (`DriveProjectConfig`)**: Metadata stored on the project indicating whether it is shared, its dedicated `driveFolderId`, its `storageFormat` (`'monolithic'` vs. `'granular'`), and owner status (`isOwner`).
- **Collaborator Permission (`CollaboratorPermission`)**: Entity representing an invited collaborator, containing `permissionId`, `emailAddress`, `displayName`, `role` (`'writer'`), and `photoLink`.
- **Chapter Sync Manifest (`ChapterSyncManifest`)**: Manifest file stored in the project subfolder listing each chapter's `id`, `title`, `updatedAt`, `fileId`, and word count.
- **Chapter Conflict State (`ChapterConflictInfo`)**: Entity representing a diverged chapter during sync, containing `chapterId`, `chapterTitle`, `localUpdatedAt`, `remoteUpdatedAt`, `localTextSnippet`, and `remoteTextSnippet`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Multiple users (2–5 collaborators) can collaborate on different chapters of the same translation project simultaneously with 0 chapter overwrites or data loss.
- **SC-002**: First-time project subfolder creation and chapter splitting complete in under 5 seconds for projects with up to 100 chapters.
- **SC-003**: 100% of collaboration operations run directly between client browsers and Google Drive API / Google Picker API, with 0 bytes of project data or tokens routed through the backend server.
- **SC-004**: 0 new NPM packages are introduced (Google Picker is loaded via standard dynamic script element).
- **SC-005**: All existing personal sync workflows for unshared projects continue to work with 100% backward compatibility.
- **SC-006**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 TypeScript errors or test regressions.

---

## Assumptions

- The user will enable the **Google Picker API** in the Google Cloud Console and generate a Browser API Key restricted by HTTP Referrer (`http://localhost:5173`, `http://localhost:3000`, or production domain).
- Collaborators have valid Google accounts and are added as Test Users in the Google Cloud Console OAuth consent screen if the application remains in "Testing" mode.
- The `drive.file` scope permission model in Google Drive correctly allows granting `writer` permissions on app-created folders to other users, and Google Picker allows authorized selection of those shared folders.
