# Feature Specification: Direct Client Translation for Personal API Keys

**Feature Branch**: `049-direct-client-translation`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Cho phép người dùng đã tự cấu hình API key Gemini riêng thực hiện dịch hoàn toàn độc lập với mọi người dùng khác — không có bất kỳ điểm chia sẻ, phụ thuộc, hay ảnh hưởng qua lại nào giữa các người dùng khác nhau khi họ đều dùng key riêng của mình. Người dùng chưa cấu hình key riêng (đang dùng key dự phòng qua ALLOW_SERVER_KEY_FALLBACK) không bị ảnh hưởng — luồng của họ giữ nguyên như hiện tại, vẫn qua server như cũ. Lý do: server hiện đóng vai trò trung gian cho MỌI yêu cầu dịch, kể cả khi người dùng đã có key riêng — khiến ngưỡng MAX_CONCURRENT_REQUESTS = 50 trong server/services/geminiService.ts trở thành nút thắt CHUNG cho tất cả mọi người, dù về lý thuyết các key riêng biệt không hề tranh chấp hạn mức của nhau. Server free tier (0.1 CPU) không cần đứng giữa một tác vụ mà bản chất là giao tiếp trực tiếp giữa trình duyệt người dùng và Gemini. Bối cảnh kỹ thuật đã thống nhất trước: Người có key riêng: trình duyệt tự gọi thẳng Gemini bằng key của chính họ, không đi qua server ở bước gọi AI. KHÔNG dùng bất kỳ cơ chế cache/chia sẻ kết quả nào giữa những người dùng khác nhau. Tách phần dựng prompt + parse JSON và chia chunk sang shared/. KHÔNG cần mang quotaService sang client. KHÔNG xây endpoint kiểm tra/ghi cache nào cho luồng key riêng này."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Direct Translation with Personal API Key (Priority: P1)

As a user who has configured my own personal Gemini API key(s) in the application settings, I want my translation requests to execute directly between my browser and the AI service without passing through the central server for AI generation, so that my translation speed and capacity are fully independent, unconstrained by server limits or other concurrent users.

**Why this priority**: This is the core functionality that eliminates the central bottleneck (`MAX_CONCURRENT_REQUESTS = 50`) on the server, unlocking full throughput for users providing their own credentials.

**Independent Test**: Can be tested by configuring a personal API key in settings, executing a multi-chapter or long-text translation, and verifying that the AI generation requests are initiated directly from the client without interacting with server-side translation/concurrency endpoints, successfully receiving fully translated chapters.

**Acceptance Scenarios**:

1. **Given** a user has configured one or more valid personal API keys in the AI configuration modal, **When** they start translating a chapter or text segment, **Then** the translation is executed directly from their browser to the AI service, completing both translation phases (raw translation with term extraction and contextual polishing) without routing through the server's AI generation queue.
2. **Given** a user is performing direct client translation with a personal API key, **When** the translation completes, **Then** the translated result is saved locally to their workspace database and displayed identically to the server-mediated output.
3. **Given** multiple users are translating simultaneously with their respective personal keys, **When** total concurrent operations exceed the server's threshold, **Then** each user's translation proceeds uninterrupted at their own key's quota speed without any "system overloaded" error.

---

### User Story 2 - Uninterrupted Translation via Server Fallback (Priority: P2)

As a user who has not configured any personal API keys (or is relying on the server default key), I want to continue translating chapters seamlessly through the existing server fallback pipeline without any change in user experience or functionality.

**Why this priority**: Ensures backward compatibility and operational continuity for users without personal keys, preventing regressions in existing deployments where server key fallback is enabled.

**Independent Test**: Can be tested by clearing all personal API keys in settings and executing a translation with server fallback enabled, verifying that requests route through the server pipeline as before and complete successfully.

**Acceptance Scenarios**:

1. **Given** a user has no personal API keys configured in settings, **When** they start a translation request and server fallback is enabled, **Then** the translation request is routed to the server translation pipeline as before.
2. **Given** a user with no personal API keys translates during peak usage, **When** the server reaches its concurrency threshold, **Then** standard server queueing and rate-limiting behaviors apply as expected without crashing.

---

### User Story 3 - Key Rotation & Fault Handling in Direct Mode (Priority: P3)

As a user with multiple configured personal API keys in direct translation mode, I want the client to seamlessly handle rate limits, transient network errors, or key exhaustion by rotating through my configured keys or displaying clear local error notifications, without impacting other users or leaking errors across sessions.

**Why this priority**: Provides client-side resilience and smooth user experience when a personal key hits rate limits or encounters transient errors during long novel translations.

**Independent Test**: Can be tested by configuring two personal keys where the first key is rate-limited or invalid, initiating a translation, and verifying that the client automatically falls back to the second valid key or surfaces the exact error to the user interface.

**Acceptance Scenarios**:

1. **Given** a user configures multiple personal API keys, **When** the active key encounters a rate limit (HTTP 429) or transient provider error, **Then** the client automatically tries the next configured personal key in the user's list.
2. **Given** all configured personal keys fail or are exhausted, **When** direct translation cannot proceed, **Then** the client displays a clear, localized notification explaining the key status directly to the user without affecting server state.

---

### Edge Cases

- **Custom Key Removed Mid-Session**: If a user clears their personal API keys while a batch translation job is in progress or between chapter requests, subsequent requests immediately switch back to the server fallback pipeline (if enabled) or prompt for key configuration.
- **Provider Outage or Network Disconnect**: If the AI provider is unreachable directly from the client's network (e.g., DNS error, firewall, or offline browser), the client shows an immediate connectivity error with retry options rather than waiting on server timeouts.
- **Malformed AI Response**: If the direct AI response cannot be parsed (e.g. truncated JSON or missing translation fields), the client executes its local retry mechanism or marks the specific segment with a parse failure prompt.
- **Mixed Content / Long Chapters**: Very long text segments are partitioned into standardized chunks, translated sequentially or with local concurrency, and reassembled with consistent terminology and context across chunks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST execute AI generation requests directly from the client browser to the AI service when one or more personal API keys are configured by the user.
- **FR-002**: The system MUST NOT route direct client translation requests through server AI execution gates, server concurrency queues, or server rate limiters.
- **FR-003**: The system MUST guarantee complete data and operational isolation for personal key translations—no shared caching, cross-user result lookup, or centralized storage of translation inputs/outputs between different users.
- **FR-004**: The system MUST preserve the existing server-mediated translation workflow for users without configured personal keys when server fallback mode is permitted.
- **FR-005**: The system MUST maintain complete functional equivalence between direct client translation and server translation, including 2-phase translation: Phase 1 (raw translation + terminology extraction) and Phase 2 (contextual polishing).
- **FR-006**: The system MUST use standardized, platform-agnostic prompt generation, text chunking, and response parsing algorithms across both client-side direct execution and server-side execution.
- **FR-007**: The system MUST manage personal API key rotation and error retry strategies locally within the user's browser session without sending telemetry or state to the shared server quota service.
- **FR-008**: The system MUST seamlessly switch execution mode (direct client translation vs. server-mediated fallback) based on the presence of personal API keys in the client session.

### Key Entities *(include if feature involves data)*

- **Credential Context**: Represents the user's active API keys and configuration state (personal keys stored in ephemeral session storage vs. empty/server-fallback mode).
- **Translation Pipeline Execution Context**: Encapsulates the runtime context for a translation job (source novel/chapter text, chunk partitions, extracted glossary terms, active phase, and generated output).
- **Translation Phase Result**: The structured output of each translation phase (raw Vietnamese text with extracted bilingual terminology dictionary for Phase 1; refined, polished Vietnamese prose for Phase 2).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users with configured personal API keys can perform simultaneous translations concurrently with hundreds of other active users without encountering server concurrency bottleneck errors or "system overloaded" limits.
- **SC-002**: Translation throughput, latency, and success rates for a user with a personal key are completely independent of the volume, frequency, or content of translations being requested by other users.
- **SC-003**: Users without personal API keys continue to experience 100% functional continuity of the translation service via the server fallback path without regressions.
- **SC-004**: 100% of translation prompts and output structures produced in direct client mode match the translation accuracy, glossary consistency, and formatting of the existing server translation pipeline.
- **SC-005**: Server CPU utilization and concurrency queue saturation do not increase when users translate via their own personal API keys.

## Assumptions

- Users configuring personal Gemini API keys have sufficient quota associated with their Google AI account and direct outbound HTTPS network access to AI provider endpoints.
- Server fallback remains available for authorized users or environments where `ALLOW_SERVER_KEY_FALLBACK` is enabled on the server.
- Shared translation logic (prompt formatting, chunking algorithms, and response parsing) produces identical outputs regardless of whether executed in the browser runtime or Node.js runtime.
- Client-side key handling remains ephemeral within `sessionStorage` per established security boundaries.
