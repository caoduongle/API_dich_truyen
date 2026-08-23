# Feature Specification: Fix — Collaborator Receives HTTP 404 on Shared Project Import (Google Picker App ID Binding)

**Feature Branch**: `070-fix-picker-app-id-404`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Fix — Cộng tác viên nhận lỗi HTTP 404 khi mở dự án chia sẻ qua Google Picker. Nguyên nhân: googlePickerService.ts thiếu .setAppId(CLOUD_PROJECT_NUMBER) trên PickerBuilder khiến scope drive.file không liên kết quyền đọc per-file cho access token. Yêu cầu: cấu hình VITE_GOOGLE_APP_ID / localStorage / UI, gọi .setAppId(appId) trên cả 2 Picker, validate selectedFiles trước khi tải, và cập nhật tài liệu .env.example/README.md."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collaborator Successfully Imports Shared Project via Picker with App ID (Priority: P1) 🎯 MVP

As an invited collaborator (User B), when I open a shared project using Google Picker, I want the system to bind my Google Cloud Project Number (`appId`) to the Picker instance so that Google Drive grants valid per-file `drive.file` read permissions to my access token, allowing `project.json`, `manifest.json`, and all chapter files to download without encountering HTTP 404 errors.

**Why this priority**: Without `setAppId`, Google Picker fails to bind OAuth `drive.file` token permissions for files created by other users, causing 100% of shared project file downloads to fail with HTTP 404.

**Independent Test**: Configure `VITE_GOOGLE_APP_ID` (or custom App ID in settings). As User B, click "Mở dự án được chia sẻ (Google Picker)", pick the shared folder and select all files in the multi-select picker. Verify that the project metadata and all chapters download cleanly into IndexedDB without 404 errors.

**Acceptance Scenarios**:

1. **Given** a collaborator with a valid Google Cloud App ID (Project Number) configured, **When** they open the folder picker or multi-file picker, **Then** `googlePickerService` builds the Picker instances with `.setAppId(appId)`.
2. **Given** the collaborator selects the shared folder and all project files, **When** the app downloads `project.json`, `manifest.json`, and `chapter_*.json`, **Then** Google Drive API returns 200 OK for all files and the project imports successfully into IndexedDB.
3. **Given** a collaborator attempts to open Google Picker without a configured `appId`, **When** the picker action is initiated, **Then** the application surfaces a friendly Vietnamese warning instructing them to configure the Google Cloud Project Number instead of failing cryptically later.

---

### User Story 2 - Pre-Download Permission Validation & Actionable Guidance (Priority: P1)

As a collaborator importing a shared project or synchronizing new files, if I accidentally omit certain required files (e.g. `project.json` or specific chapters) in the Google Picker dialog, I want the application to detect the missing permissions before attempting downloads and display a clear, consolidated list of unselected files with instructions to select all files (Ctrl+A / Cmd+A), rather than failing with obscure HTTP errors.

**Why this priority**: In a multi-select picker with dozens of chapter files, users may accidentally miss files. Pre-validating against `manifest.json` prevents partial corrupt imports and provides immediate, actionable feedback.

**Independent Test**: Open a shared project containing 5 chapters, but select only 3 chapters in the file picker. Verify that the system stops before failing individual downloads, lists the unselected file names, and prompts the user with instructions to select all files.

**Acceptance Scenarios**:

1. **Given** a file selection from Google Picker, **When** `importProjectFromSharedFolder` runs, **Then** it validates that `project.json` is present in `selectedFiles` before attempting downloads.
2. **Given** `manifest.json` is retrieved, **When** some chapter files defined in `manifest.chapters` are missing from `selectedFiles`, **Then** the system collects all missing file names and displays a consolidated error message: *"Chưa cấp quyền cho các tệp: [danh sách tệp]. Vui lòng mở lại và chọn TẤT CẢ tệp trong hộp thoại Google Picker (Ctrl+A / Cmd+A)."*
3. **Given** all required files are present in `selectedFiles`, **When** validated, **Then** the download proceeds directly without extra roundtrips.

---

### User Story 3 - Google Cloud Project Number Configuration & Documentation (Priority: P2)

As a developer or user deploying the application, I want dedicated environment variable support (`VITE_GOOGLE_APP_ID`), local storage override support, an input field in the Advanced Sync Configuration panel, and clear documentation in `README.md` and `.env.example` explaining how to find the numeric Project Number on Google Cloud Console, so that I can easily configure Google Picker authorization.

**Why this priority**: Cloud Project Number (numeric string) is distinct from Project ID (slug) and OAuth Client ID. Clear UI labels, placeholders, and setup guides prevent user configuration mistakes.

**Independent Test**: Open Google Sync modal -> Cấu hình nâng cao. Verify the "Google Cloud App ID (Project Number)" input field is present, allows saving custom values to localStorage, provides reset capability, and includes guidance notes.

**Acceptance Scenarios**:

1. **Given** `.env.example`, **When** viewed, **Then** it documents `VITE_GOOGLE_APP_ID` with instructions to find the numeric Project Number at Google Cloud Console (IAM & Admin -> Settings -> Project number).
2. **Given** `README.md`, **When** viewed, **Then** the Google Cloud sync setup section details the 3 required credentials: OAuth Client ID, Google Picker API Key, and Cloud App ID (Project Number).
3. **Given** `GoogleSyncAdvancedConfig`, **When** expanded, **Then** it displays an App ID input field with validation, reveal/hide toggle, save/reset actions, and custom status badge.

---

### Edge Cases

- **Missing App ID**: If `appId` is empty or whitespace-only, the Picker does not launch; the UI shows a clear toast: *"Chưa cấu hình Google Cloud App ID (Project Number). Vui lòng nhập trong phần Cài đặt Đồng bộ."*
- **Alphabetical Project ID entered instead of numeric Project Number**: The UI or helper note warns that App ID must be the numeric Project Number (e.g. `123456789012`), not the text Project ID.
- **Picker Cancelled by User**: If the user closes or dismisses the file picker during validation retry, the application returns cleanly to the idle state without corrupted local data.
- **Old Cached App ID in LocalStorage**: Users can click "Đặt lại mặc định" to reset their custom App ID back to the environment default.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support configuring the Google Cloud App ID (Project Number) via environment variable `VITE_GOOGLE_APP_ID`, with local storage fallback (`ai_dich_truyen_google_app_id`) and runtime getter/setter methods in `googlePickerService.ts` and `googleAuthService.ts`.
- **FR-002**: `googlePickerService.openFolderPicker` MUST call `.setAppId(appId)` on its `PickerBuilder` before `.build()`.
- **FR-003**: `googlePickerService.openFilePicker` MUST call `.setAppId(appId)` on its `PickerBuilder` before `.build()`.
- **FR-004**: If `appId` is missing or empty, `openFolderPicker` and `openFilePicker` MUST throw a descriptive Vietnamese error immediately before attempting to load or render the Picker.
- **FR-005**: `GoogleSyncAdvancedConfig.tsx` MUST provide an input field and management actions (save, reset, reveal/hide) for the Google Cloud App ID alongside Client ID and Picker API Key.
- **FR-006**: `importProjectFromSharedFolder` in `driveGranularSync.ts` MUST validate `selectedFiles` before batch downloads; if required files (`project.json` or chapters listed in `manifest.json`) are missing from `selectedFiles`, it MUST throw a consolidated Vietnamese error listing the missing file names and prompting full selection (Ctrl+A / Cmd+A).
- **FR-007**: `.env.example` and `README.md` MUST document `VITE_GOOGLE_APP_ID` with clear instructions on locating the numeric Project Number in Google Cloud Console.

---

### Key Entities

- **Google Cloud App ID (`appId`)**: Numeric identifier (Project Number) representing the Google Cloud project in Google Picker API, linking OAuth tokens to per-file permissions under `drive.file`.
- **Selected File Manifest**: In-memory list of `{ id: string, name: string }` representing user-authorized files returned from Google Picker.
- **Google Sync Configuration**: Client credentials tuple consisting of `clientId`, `pickerApiKey`, and `appId`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of shared project file downloads by invited collaborators succeed without HTTP 404 errors when valid App ID and files are selected.
- **SC-002**: 100% of missing file scenarios produce a single, actionable error message listing the missing file names within 1 second of picker confirmation.
- **SC-003**: Zero obscure or unhandled HTTP 404 errors surfaced to end-users during shared project import.
- **SC-004**: All quality gates (`tsc --noEmit`, `vitest run`, `vite build`) pass cleanly with 0 type errors, 0 failed tests, and 0 new runtime dependencies.

---

## Assumptions

- The OAuth 2.0 PKCE scope remains strictly `drive.file` (`https://www.googleapis.com/auth/drive.file`).
- Project Number is a standard Google Cloud attribute accessible under IAM & Admin -> Settings in the Google Cloud Console.
- Core schema in `src/types.ts` and IndexedDB in `src/services/db.ts` remain immutable.
