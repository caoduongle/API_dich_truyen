# Feature Specification: Hide Default Google Drive Credentials in UI

**Feature Branch**: `057-hide-drive-credentials-ui`

**Created**: 2026-08-22

**Status**: Ready

**Input**: User description: "Modal 'Đồng Bộ & Cộng Tác Google Drive' (src/components/google-sync/GoogleSyncModal.tsx) hiện hiển thị trực tiếp giá trị mặc định của Google OAuth Client ID và Google Picker API Key kèm nút 'Thay đổi' cho phép sửa trực tiếp trong UI chính. Yêu cầu: Không hiển thị chuỗi ký tự mặc định; hiển thị trạng thái 'Đã cấu hình sẵn'; ô nhập khi sửa dùng type='password' hoặc che ký tự kèm toggle ẩn/hiện tương tự ApiSettings.tsx; giữ nguyên 100% logic OAuth PKCE và Picker."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Pre-Configured Credential Status for Standard Users (Priority: P1)

As a translator opening the Google Drive Sync modal, I want to see a clean, reassuring "Đã cấu hình sẵn" (Pre-configured) status for Google OAuth and Google Picker without seeing long raw credential strings, so that the interface looks clean, professional, and does not create the false impression of exposed sensitive keys.

**Why this priority**: Directly solves the core UX issue where standard users perceive raw credential strings as "leaked" sensitive tokens, while eliminating clutter from the main sync dialog.

**Independent Test**: Open the Google Drive Sync modal when environment variables (`VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_PICKER_API_KEY`) are present, and verify that the raw strings are completely hidden, showing only status indicators (e.g. green "Đã cấu hình sẵn" badge).

**Acceptance Scenarios**:

1. **Given** the app has default credentials configured in environment variables, **When** the user opens the "Đồng Bộ & Cộng Tác Google Drive" modal, **Then** the raw Client ID and Picker API Key strings are NOT displayed in plain text anywhere in the main view.
2. **Given** default credentials are present, **When** viewing the configuration area, **Then** the UI displays an intuitive status badge/message indicating "Đã cấu hình sẵn" (or "Hệ thống đã thiết lập sẵn") with a subtle collapsible/advanced settings trigger.
3. **Given** the user clicks "Đăng nhập Google", **When** logging in with default credentials, **Then** the OAuth 2.0 PKCE flow initiates and completes normally without requiring manual credential interaction.

---

### User Story 2 - Secure Custom Credential Override with Masked Input (Priority: P2)

As an advanced user or self-hoster who wants to use their own custom Google Cloud Client ID or Picker API Key, I want to expand an advanced configuration section and input my custom keys using masked password fields with an eye-toggle (Show/Hide), matching the design pattern in `ApiSettings.tsx`.

**Why this priority**: Preserves flexibility for users who need custom Google Cloud projects while ensuring entered keys are masked by default against shoulder-surfing.

**Independent Test**: Expand the advanced configuration section, enter a custom Client ID / API Key with `type="password"`, toggle the eye icon to verify input, save to localStorage, and verify that the custom key is applied.

**Acceptance Scenarios**:

1. **Given** the user wants to use a custom Google OAuth Client ID or Picker Key, **When** clicking the subtle "Tùy chỉnh nâng cao" (Advanced Settings) trigger, **Then** the credential configuration fields are revealed in a collapsible panel.
2. **Given** the custom input field is visible, **When** typing or viewing existing custom keys, **Then** the input field uses `type="password"` by default and displays an `Eye`/`EyeOff` toggle button.
3. **Given** the user clicks the `Eye` button, **When** toggled, **Then** the input switch to `type="text"` to reveal characters for verification, and clicking `EyeOff` re-masks the input.
4. **Given** the user clears their custom key and saves, **When** empty, **Then** the system reverts cleanly to the default build-time environment credentials and restores the "Đã cấu hình sẵn" state.

---

### User Story 3 - Transparent Operation of Shared Project Picker & Drive Sync (Priority: P3)

As a translator collaborating on a shared project, I want the Google Picker dialog and Drive Sync operations to seamlessly use the effective credentials (default or custom) without any UI friction or credential prompts.

**Why this priority**: Ensures zero regression in the existing Google Drive backup, restore, bi-directional sync, and Google Picker folder import workflows.

**Independent Test**: Trigger Google Drive backup ("Sao lưu lên Drive") and Google Picker ("Mở dự án được chia sẻ") to verify both operations execute without credential errors.

**Acceptance Scenarios**:

1. **Given** valid default credentials, **When** clicking "Mở dự án được chia sẻ", **Then** `googlePickerService` initializes using the effective Picker API key and opens the folder selection dialog.
2. **Given** an authenticated Google session, **When** clicking "Đồng bộ 2 chiều", **Then** `googleDriveSyncService` executes the sync pipeline without modal UI glitches.

---

### Edge Cases

- **No environment variable & no custom key**: When neither build-time default nor custom key is set, the status badge MUST display "Chưa cấu hình" (Warning tone) and immediately invite the user to provide a custom Client ID.
- **Custom key deleted**: When a custom key in localStorage is deleted/cleared, the UI MUST seamlessly fall back to the environment variable if available, or show "Chưa cấu hình" if none exists.
- **Mobile screen responsiveness**: The status badge, advanced toggle, and masked input with eye/action buttons MUST not cause horizontal overflow or wrap awkwardly on mobile viewports (`< 640px`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The default values of Google OAuth Client ID and Google Picker API Key (`VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_PICKER_API_KEY`) MUST NOT be rendered as plain text strings in the default modal view.
- **FR-002**: When valid default credentials exist, the modal MUST display a concise status indicator (e.g. `Badge` with "Đã cấu hình sẵn") instead of raw strings.
- **FR-003**: The prominent "Thay đổi" text button in the main header of each credential section MUST be replaced with a subtle, collapsible "Cấu hình nâng cao" (Advanced Settings) section.
- **FR-004**: When editing or entering custom credentials, the input fields MUST use `type="password"` by default and include an `Eye` / `EyeOff` visibility toggle button, adhering to the pattern in `src/components/ApiSettings.tsx`.
- **FR-005**: The UI components MUST use the design system tokens (`bg-ink`, `bg-parchment`, `border-parchment-2`, `Badge`, `Button`, `rounded-[2px]`) defined in `.agents/rules/design-system.md`.
- **FR-006**: Existing OAuth 2.0 PKCE login (`googleAuthService`) and Google Picker (`googlePickerService`) logic MUST remain 100% intact without modifying backend routes or auth protocols.

### Key Entities

- **`GoogleSyncModal`** (`src/components/google-sync/GoogleSyncModal.tsx`): The modal dialog presenting Google Drive sync, account status, and credential management.
- **`googleAuthService`** (`src/services/googleAuthService.ts`): Client-side OAuth 2.0 PKCE manager handling client ID resolution (custom localStorage override vs `VITE_GOOGLE_CLIENT_ID`).
- **`googlePickerService`** (`src/services/googlePickerService.ts`): Client-side Google Picker manager handling Picker API key resolution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the default state, 0 characters of the default Google Client ID or Picker API Key strings are visible on screen.
- **SC-002**: 100% of credential input fields in the advanced settings section default to masked/password mode with working reveal toggles.
- **SC-003**: Google Login, Drive Backup, Drive Restore, Bi-directional Sync, and Google Picker open successfully on first attempt with zero credential regressions.
- **SC-004**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly.

## Assumptions

- Both `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_PICKER_API_KEY` are client-side public identifiers by Google's design, but masking them in the UI eliminates user anxiety and avoids visual clutter.
- The advanced configuration section can be collapsed by default when default credentials exist, and automatically expanded if no credentials exist at all.
- Re-using existing Lucide icons (`Eye`, `EyeOff`, `CheckCircle2`, `Key`, `Settings`, `ChevronDown`, `ChevronUp`) and UI primitives (`Badge`, `Button`) ensures 100% visual consistency with `ApiSettings.tsx` and the "Mực & Chu Sa" design system.
