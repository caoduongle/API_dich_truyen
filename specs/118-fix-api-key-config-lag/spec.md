# Feature Specification: Fix AI Configuration Modal Lag & API Key Lifecycle

**Feature Branch**: `118-fix-api-key-config-lag`

**Created**: 2026-09-12

**Status**: Ready for Planning

**Input**: User description: "hãy kiểm tra lại thật kĩ chỗ này; mỗi khi tôi mở lên thì đều rất lag; khi nhập API key vào thì nhiều lúc còn không nhận; mặc dù có API key rồi mà vẫn báo không có cái nào"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smooth Modal Launch & Responsive Key Input (Priority: P1)

As a user configuring AI settings,
I want the "Cấu hình AI & Bản Thảo" modal to open smoothly without freezing the screen, and I want the API Key input fields to respond instantaneously to my keystrokes and clipboard paste actions,
So that I can enter and manage my credentials without stuttering, delayed typing, or dropped characters.

**Why this priority**:
When the modal opens or when typing an API key, the UI currently experiences severe lag, frame drops, and lost keystrokes because every keystroke triggers global application re-renders and un-debounced network verification calls on incomplete keys. Fast, responsive input is fundamental to user trust and basic usability.

**Independent Test**:
Open the AI configuration dialog and type a 39-character key into the API key input at rapid typing speed (or paste multiple keys). Verify that every character appears smoothly without delay, no input focus is lost, and no background network calls are dispatched for incomplete key inputs.

**Acceptance Scenarios**:

1. **Given** a user clicks the button to open the AI configuration dialog, **When** the dialog appears, **Then** the interface opens smoothly with zero perceptible stutter or freeze on the main thread.
2. **Given** the user is typing an API key character-by-character into any key input slot, **When** keys are typed rapidly, **Then** all characters register accurately in real-time without dropped letters, lag, or input stutter.
3. **Given** an incomplete or in-progress key string is being typed in the input field, **When** the input has not settled or blurred, **Then** the system does not dispatch un-debounced external model discovery or quota verification network requests for incomplete keys.
4. **Given** the user pastes one or more API keys from the clipboard, **When** the paste action completes, **Then** all valid keys are immediately trimmed, populated, and reflected in the count.

---

### User Story 2 - Persistent & Reliable Credential Retention Across Sessions (Priority: P1)

As a returning translator,
I want my configured API keys to be reliably preserved on my local browser environment across page reloads, tab closes, and browser restarts,
So that I do not encounter the baffling "Chưa có API key nào" (No API keys found) empty state every time I reopen the application.

**Why this priority**:
Currently, keys are kept only in session-bound ephemeral storage and explicitly purged from persistent storage, causing all keys to be completely wiped whenever a user closes their browser or opens a new tab. Users are left frustrated that their keys "disappear" between working sessions.

**Independent Test**:
Configure two API keys in the settings dialog, close the browser tab, open a new browser tab/window to the application, and verify that the previously saved keys are automatically restored and recognized with full translation and quota capabilities.

**Acceptance Scenarios**:

1. **Given** a user has entered and saved API keys in the settings modal, **When** the user reloads the page or reopens the app in a new browser tab, **Then** the configured keys remain fully intact and available for use.
2. **Given** a user opens the Quota & Hạn mức tab after reopening the app, **When** keys were previously configured, **Then** the tab displays the active keys and usage stats instead of the "Chưa có API key nào" empty state.
3. **Given** a user explicitly chooses to delete or clear a specific key slot, **When** the deletion is executed, **Then** only that specific key is removed from both active memory and persistent local storage.

---

### User Story 3 - Accurate Model Support & Key Availability Feedback (Priority: P2)

As a user viewing the "Mô hình AI" status card in the configuration dialog,
I want the status indicator to accurately reflect the true availability of my configured keys,
So that the system never displays contradictory or alarming false warnings (such as "Model đang chọn hiện không có API key nào hỗ trợ" or "0 / N key hỗ trợ") when valid keys are configured.

**Why this priority**:
Currently, the card says "Chưa kiểm tra key" or falsely displays "Model đang chọn hiện không có API key nào hỗ trợ" even when the user has 2 valid keys configured, because it conflates "uninspected" with "unsupported". This directly causes user confusion and bug reports where users say "mặc dù có API key rồi mà vẫn báo không có cái nào".

**Independent Test**:
Configure 2 valid API keys and select a standard recommended model (e.g. Gemini 2.5 Flash). Verify that the status card does not display an amber error banner claiming 0 keys support the model when the keys simply have not yet been queried for custom capabilities.

**Acceptance Scenarios**:

1. **Given** a user has configured valid API keys and selected a verified preset model, **When** looking at the Model Summary card, **Then** the card displays a clear, constructive status indicating the model is ready and supported by the configured keys, without displaying false "0 / N key hỗ trợ" warnings.
2. **Given** key inspection has not yet been executed, **When** the status is shown, **Then** the system clearly differentiates between "Chưa kiểm tra chi tiết" (Pending check) versus a confirmed incompatibility, avoiding misleading failure warnings.
3. **Given** a user clicks "Làm mới mô hình" or tests connection, **When** the query succeeds, **Then** the model support counter immediately updates to show the verified supported key count.

---

### User Story 4 - Direct Connection Check & Immediate Health Feedback (Priority: P3)

As a user entering or verifying API keys,
I want a clear, immediate way to test my API keys directly from the settings dialog,
So that I can verify that my keys are active, valid, and connected to Google Gemini before starting translation tasks.

**Why this priority**:
Users often wonder if their newly entered key is recognized or valid. Providing immediate validation feedback eliminates ambiguity and reassures the user.

**Independent Test**:
Enter a key and click the "Kiểm tra kết nối" button; observe a fast, lightweight ping confirmation showing "Khóa hợp lệ" or a clear error message if the key is invalid or quota-exhausted.

**Acceptance Scenarios**:

1. **Given** a user enters an API key, **When** testing the key connection, **Then** the system performs a lightweight verification and displays an instant success indicator.
2. **Given** an invalid or revoked API key, **When** verified, **Then** a clear, friendly error is displayed explaining that the key was rejected by Google Gemini.

---

## Edge Cases

- **What happens when a user types an invalid or partial string?**
  Input fields buffer the text locally without triggering background discovery or quota checks until the input is debounced or submitted.
- **What happens if a user enters duplicate keys or pastes text containing commas/newlines?**
  The system automatically splits, trims whitespace, and deduplicates identical keys.
- **What happens if local storage is restricted or disabled (e.g., incognito mode)?**
  The system gracefully falls back to in-memory/session storage with an informative advisory that credentials will last only for the current tab session.
- **What happens when a user switches between the "Cấu hình AI" and "Quota & Hạn mức" tabs?**
  Shared state is preserved without tearing down or re-fetching unneeded network data.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The AI configuration modal MUST decouple input keystrokes from root application re-renders to ensure smooth, zero-latency typing in key input fields.
- **FR-002**: Key inputs MUST NOT trigger background model discovery or network verification calls on each keystroke while typing incomplete strings.
- **FR-003**: Configured API keys MUST be persistently preserved on the local client environment so that keys are retained across page reloads, tab navigation, and browser restarts.
- **FR-004**: The system MUST automatically sanitize, trim leading/trailing whitespace, and remove empty entries from the API key pool before saving.
- **FR-005**: The Model Status Summary card MUST NOT display the warning "Model đang chọn hiện không có API key nào hỗ trợ" solely because keys have not been inspected yet.
- **FR-006**: The Model Status Summary card MUST distinguish between verified compatible keys, unverified/pending inspection keys, and confirmed incompatible keys.
- **FR-007**: The system MUST provide an instant visual indication of valid key count in both the modal header and the key list section.
- **FR-008**: Opening the AI configuration modal MUST NOT trigger redundant duplicate quota calculations or multiple concurrent background model queries.

---

### Key Entities

- **ClientApiKeyCredential**: Represents a user-provided API key, including its raw/trimmed value, masked representation, storage persistence status, and last validation state.
- **ModelSupportStatus**: Represents the compatibility assessment between a selected model and the active key pool (verified compatible, presumed compatible preset, pending inspection, or confirmed unsupported).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Typing latency in the API key input fields remains under 16ms (60 FPS smooth typing) with zero dropped characters regardless of typing speed.
- **SC-002**: 100% of saved API keys remain preserved and available after closing and reopening the browser window/tab.
- **SC-003**: Zero false-negative "0 / N key hỗ trợ" warnings displayed for standard verified preset models when valid keys are configured.
- **SC-004**: Zero background network discovery calls triggered during intermediate character typing.
- **SC-005**: 100% passing rate on all existing automated test suites (`npm run lint`, `npm test`, `npm run build`).

---

## Assumptions

- Users intend for API keys entered into their personal browser to be remembered on that specific browser until explicitly deleted.
- Standard recommended preset models (e.g., Gemini 2.5 Flash, Gemini 3.1 Flash Lite) are compatible with standard Gemini API keys by default unless an active API check reports otherwise.
- Browser storage (localStorage/IndexedDB) is available in normal browsing mode, with in-memory fallback in restricted privacy modes.
