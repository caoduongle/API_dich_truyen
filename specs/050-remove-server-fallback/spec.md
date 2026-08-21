# Feature Specification: Remove Server Translation Fallback & Enforce Personal API Keys

**Feature Branch**: `050-remove-server-fallback`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Loại bỏ hoàn toàn luồng dịch dự phòng qua server (ALLOW_SERVER_KEY_FALLBACK và code liên quan). Từ giờ, người dùng BẮT BUỘC phải tự cấu hình API key Gemini riêng để dùng tính năng dịch — không còn key dự phòng nào của server được dùng để gọi Gemini thay người dùng. Lý do: đây là bước cuối để server không còn xử lý bất kỳ nội dung dịch thuật nào của người dùng — khớp với cam kết trong docs/privacy-policy.md (server không chạm vào nội dung dịch của bất kỳ ai). Đọc file đó trước khi bắt đầu. Phạm vi: Xóa/deprecate biến môi trường ALLOW_SERVER_KEY_FALLBACK và logic dùng GEMINI_API_KEY của server làm fallback trong server/services/geminiService.ts và các controller translation liên quan. UI: khi chưa cấu hình key riêng, hiển thị rõ cần thêm API key cá nhân mới dùng được tính năng dịch — không còn 'dùng thử qua server'. server/services/quotaService.ts và các cơ chế key rotation/circuit breaker phía server tồn tại chủ yếu để phục vụ fallback dùng chung — đánh giá phần nào thành dead code sau thay đổi này, nhưng liệt kê rõ trong Implementation Plan trước khi xóa, đừng tự ý xóa hàng loạt. KHÔNG động vào phần server phục vụ static frontend/health check. Đây là breaking change với người dùng hiện tại chưa có key riêng — dừng ở Implementation Plan, cho tôi xem danh sách file bị xóa/đổi trước khi implement."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enforce Personal API Key Requirement in UI (Priority: P1)

As a user without any configured Gemini API key, I want the application interface to clearly inform me that a personal API key is mandatory to use the translation features (with clear guidance on where to configure it), and prevent initiating translation jobs without a key, so that I understand no server-provided trial or fallback key is used and my data remains completely private on my device.

**Why this priority**: This is the primary user-facing touchpoint that sets transparent expectations and enforces the strict zero-server-intermediary privacy policy.

**Independent Test**: Open the application with a clean browser session (no personal keys configured), navigate to the translation workspace or auto-translate view, verify that an explicit notice/modal informs that a personal API key is required, and verify that translation actions are disabled or prompt directly to the API Settings modal.

**Acceptance Scenarios**:

1. **Given** a user has not configured any personal Gemini API key, **When** they navigate to the Translator Workspace or Auto Translator, **Then** a clear notification banner/modal indicates that a personal API key is required to perform translations, with no option for "server fallback / server trial".
2. **Given** a user attempts to start translating a chapter without an API key, **When** they click Translate/Auto-translate, **Then** the application prevents the action and opens or prompts the API Key Configuration modal.
3. **Given** a user configures a valid personal API key in settings, **When** they return to the workspace, **Then** the warning banner clears and translation features become fully available.

---

### User Story 2 - Complete Elimination of Server-Side Translation Fallback (Priority: P1)

As a system administrator and privacy-conscious user, I want the backend server to completely cease processing user translation text and stop using server environment API keys as a fallback mechanism, ensuring strict alignment with the Privacy Policy (`docs/privacy-policy.md`).

**Why this priority**: Fulfills the core security and privacy commitment that the central server never touches, buffers, or processes user translation manuscripts.

**Independent Test**: Verify that the server environment variable `ALLOW_SERVER_KEY_FALLBACK` is removed/deprecated, verify that calling `/api/translate-raw`, `/api/polish-translation`, or `/api/qa-critique` without user credentials immediately returns an explicit HTTP 400/401 requiring client credentials, and verify that the server does not fall back to any internal `GEMINI_API_KEY` for translating user content.

**Acceptance Scenarios**:

1. **Given** an incoming translation request to the server without user credentials, **When** the server receives the request, **Then** it rejects the request with an explicit error indicating personal credentials are required, without invoking any server-side fallback AI generation.
2. **Given** `ALLOW_SERVER_KEY_FALLBACK` is deprecated/removed from the server configuration, **When** the server initializes, **Then** it runs in pure static/utility mode without provisioning a shared server fallback translation pool.
3. **Given** client-side translation occurs, **When** chapters are translated, **Then** 100% of the translation traffic routes directly from the user's browser to Google Gemini API endpoints without touching the backend server.

---

### User Story 3 - Server Architecture Audit & Controlled Dead Code Deprecation (Priority: P2)

As a maintainer, I want server-side components that existed solely to manage shared server fallback quota (such as complex multi-key rotation pools, dynamic pacing queues, and fallback circuit breakers) to be formally audited and systematically deprecated or refactored, ensuring the server remains lightweight and stable for static hosting and health checks.

**Why this priority**: Eliminates obsolete complexity and technical debt while preventing accidental breakage of non-translation server features (such as health checks and model registry).

**Independent Test**: Review the implementation plan for full itemization of dead code vs. required server features, run server unit tests, and confirm that static frontend serving, health endpoints (`/api/health`, `/api/ready`), and model discovery continue operating cleanly.

**Acceptance Scenarios**:

1. **Given** server services previously used for fallback translation (e.g. server concurrency gates for batch translation), **When** surveyed in the implementation plan, **Then** each component is explicitly cataloged as either retained (if used by utilities/health checks) or deprecated/removed.
2. **Given** the server is running after refactoring, **When** health checks (`/api/health`, `/api/ready`) or model metadata endpoints are requested, **Then** they respond instantly with status 200 OK.

---

### Edge Cases

- **User Clears API Key Mid-Operation**: If a user removes their personal key while a translation process is queued, the client halts execution immediately and surfaces a prompt to re-enter a key, without attempting any server fallback.
- **Legacy Session Tokens / Empty Key Arrays**: If a legacy client sends an empty key array or missing credentials to legacy endpoints, the server immediately returns a structured error `NO_PERSONAL_API_KEY_CONFIGURED` rather than attempting a fallback.
- **Server Health Probes**: Backend health and readiness checks continue to operate without requiring any translation API keys or Redis dependencies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST require users to configure at least one personal Gemini API key in order to perform any chapter or text translation.
- **FR-002**: The application UI MUST display clear, prominent guidance when no personal API key is configured, indicating that a personal key is mandatory and that no server fallback exists.
- **FR-003**: The application MUST NOT fall back to any server-provided API key or server-side translation proxy when the user has not configured personal credentials.
- **FR-004**: The system MUST deprecate/remove `ALLOW_SERVER_KEY_FALLBACK` and ensure the backend server never performs AI generation on behalf of uncredentialed translation requests.
- **FR-005**: The system MUST preserve 100% functionality of non-translation server endpoints, including static asset serving, health checks (`/api/health`, `/api/ready`), and model registry/discovery.
- **FR-006**: The system MUST document the breaking change for users currently relying on server fallback keys in the implementation plan and release documentation.
- **FR-007**: All server-side quota management, key rotation, and concurrency queue code that becomes obsolete MUST be cataloged in the Implementation Plan prior to modification or removal.

### Key Entities *(include if feature involves data)*

- **API Credential State**: State indicating whether the user has provided valid personal API keys in client session storage.
- **Translation Guard**: Client-side barrier that prevents translation initiation when `apiKeys` is empty.
- **Server Configuration Profile**: Server environment settings reflecting the deprecation of `ALLOW_SERVER_KEY_FALLBACK`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0% of user translation text is sent to or processed by the central server backend under any circumstances.
- **SC-002**: 100% of uncredentialed translation attempts in the UI are intercepted with clear guidance prompting the user to configure a personal API key before any network calls are dispatched.
- **SC-003**: Server memory footprint and CPU overhead are reduced due to the elimination of shared server translation queues and fallback proxying.
- **SC-004**: Health check endpoints (`/api/health`, `/api/ready`) and static frontend serving achieve 100% uptime and pass all regression test suites.
- **SC-005**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 type errors or test regressions.

## Assumptions

- Users understand that using the application requires obtaining a free or paid Gemini API key from Google AI Studio (`aistudio.google.com/apikey`).
- The privacy policy (`docs/privacy-policy.md`) accurately states the architectural reality: zero translation content is sent to, processed by, or stored on the server.
- Existing projects, glossaries, and chapters saved in client IndexedDB remain 100% intact and unaffected by this change.
