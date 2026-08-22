# Feature Specification: Empty Default Google Drive Inputs in Advanced Settings

**Feature Branch**: `062-empty-default-drive-inputs`

**Created**: 2026-08-23

**Status**: Ready

**Input**: User description: "Sửa lỗi UI trong file src/components/google-sync/GoogleSyncModal.tsx. Hiện tại khi mở modal và bấm 'Tùy chỉnh', 2 ô input đang tự động hiển thị sẵn giá trị key MẶC ĐỊNH của hệ thống do gọi getClientId()/getPickerApiKey() fallback về .env. Yêu cầu: Thêm getCustomClientId() và getCustomPickerApiKey() chỉ đọc từ localStorage (trả về '' nếu chưa có); Khởi tạo state input bằng 2 method này; Sau khi reset set input về ''; Thêm placeholder hướng dẫn để trống dùng mặc định; Giữ nguyên logic đăng nhập và mở Picker fallback ngầm về .env; Đảm bảo chất lượng toàn diện."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Empty Input Fields with Informative Placeholders (Priority: P1)

As a user opening the Advanced Settings drawer in the Google Drive Sync modal, I want the OAuth Client ID and Picker API Key input fields to be completely empty by default (showing informative placeholders) instead of pre-filling the system's build-time environment keys, so that I don't have to manually delete existing default strings before typing my own custom credentials and the system keys remain confidential.

**Why this priority**: Eliminates user confusion, prevents accidental modification or leakage of system-level default environment keys, and provides a clean, standard customization UX.

**Independent Test**: Open the Google Sync modal without custom keys saved in `localStorage`, expand the Advanced Settings section, and verify that both input fields are empty string `""` with placeholder text `"Để trống để dùng ... mặc định của hệ thống..."`.

**Acceptance Scenarios**:

1. **Given** no custom credentials in `localStorage`, **When** the user expands the Advanced Settings drawer, **Then** the Client ID input is empty with placeholder `"Để trống để dùng Client ID mặc định của hệ thống..."`.
2. **Given** no custom credentials in `localStorage`, **When** the user expands the Advanced Settings drawer, **Then** the Picker Key input is empty with placeholder `"Để trống để dùng Picker API Key mặc định của hệ thống..."`.
3. **Given** empty inputs and default environment variables present, **When** the user clicks "Đăng nhập Google" or "Mở dự án được chia sẻ", **Then** the system transparently utilizes the build-time environment credentials for the operation.

---

### User Story 2 - Smooth Custom Key Persistence & Clear Revert Behavior (Priority: P2)

As an advanced user customizing my own Google Cloud credentials, I want to input my keys, have them persisted to `localStorage`, see them accurately populated when re-opening the modal, and cleanly reset them back to empty inputs (reverting to system defaults) with a single click of "Mặc định".

**Why this priority**: Provides clear feedback and predictable lifecycle management for custom credential overrides.

**Independent Test**: Enter custom keys, save, re-open modal to verify populated inputs, click "Mặc định" to reset, and verify inputs become empty and custom keys are removed from `localStorage`.

**Acceptance Scenarios**:

1. **Given** the user inputs custom keys and clicks "Lưu", **When** saved, **Then** keys are written to `localStorage` and the status badge updates to "Tùy chỉnh riêng".
2. **Given** custom keys exist in `localStorage`, **When** reopening the modal and expanding Advanced Settings, **Then** the inputs display the custom key values (masked by default).
3. **Given** custom keys exist, **When** the user clicks "Mặc định" (reset), **Then** `localStorage` is cleared, the input state is set to empty `""`, and the status badge returns to "Đã cấu hình sẵn".

---

### Edge Cases

- **User saves empty string**: If user clicks "Lưu" with an empty string or spaces, `localStorage` entry is removed and system falls back to default.
- **SSR / window undefined**: `getCustomClientId()` and `getCustomPickerApiKey()` safely return `""` when `window` is undefined.
- **External session state change**: When auth state changes with a new client ID, input updates cleanly without overriding unsaved user typing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `googleAuthService` MUST provide a `getCustomClientId(): string` method that exclusively reads `CUSTOM_CLIENT_ID_KEY` from `localStorage` and returns `""` if not set (no `.env` fallback).
- **FR-002**: `googlePickerService` MUST provide a `getCustomPickerApiKey(): string` method that exclusively reads `CUSTOM_PICKER_KEY` from `localStorage` and returns `""` if not set (no `.env` fallback).
- **FR-003**: `GoogleSyncModal.tsx` MUST initialize `clientIdInput` with `googleAuthService.getCustomClientId()` and `pickerKeyInput` with `googlePickerService.getCustomPickerApiKey()`.
- **FR-004**: `handleResetClientId()` and `handleResetPickerKey()` in `GoogleSyncModal.tsx` MUST reset input states to empty string `""` upon clearing `localStorage`.
- **FR-005**: Both input fields MUST render clear placeholders:
  - Client ID: `placeholder="Để trống để dùng Client ID mặc định của hệ thống..."`
  - Picker Key: `placeholder="Để trống để dùng Picker API Key mặc định của hệ thống..."`
- **FR-006**: Existing `getClientId()` and `getPickerApiKey()` methods MUST preserve their `.env` fallback behavior to ensure runtime OAuth PKCE and Picker operations function without regression.

### Key Entities

- **`googleAuthService`** (`src/services/googleAuthService.ts`): Client ID resolution service.
- **`googlePickerService`** (`src/services/googlePickerService.ts`): Picker API key resolution service.
- **`GoogleSyncModal`** (`src/components/google-sync/GoogleSyncModal.tsx`): Sync and credential customization modal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 characters of default environment credentials appear inside input fields when opened without custom keys in `localStorage`.
- **SC-002**: 100% of custom keys saved persist across modal close/reopen and display correctly.
- **SC-003**: Clicking "Mặc định" immediately clears custom keys and sets input value to `""` in 100% of test runs.
- **SC-004**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly.

## Assumptions

- Preserving `getClientId()` / `getPickerApiKey()` intact ensures zero risk of regression for actual network operations while achieving a completely clean UI presentation.
