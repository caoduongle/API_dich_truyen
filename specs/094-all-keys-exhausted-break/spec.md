# Feature Specification: All API Keys Exhausted Fast-Break & Error Taxonomy

**Feature Branch**: `094-all-keys-exhausted-break`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Bối cảnh: src/services/directGeminiClient.ts, hàm callGeminiDirect(), khi vòng lặp thử hết toàn bộ API key (rawKeys) đều thất bại vì rate limit, đoạn code hiện tại throw ra một Error thường, không có cách nào để code gọi nó phân biệt được đây là 'hết quota toàn bộ' với các lỗi khác. Hậu quả cụ thể ở src/services/hakoQualityEngine.ts, hàm runAiQualityScan(): vòng for xử lý từng chương có catch riêng, khi gặp lỗi (bất kỳ loại nào) chỉ push 1 issue cảnh báo rồi CONTINUE sang chương kế tiếp. Nếu lỗi là 'hết quota toàn bộ key' (xảy ra ngay từ chương đầu), thì TẤT CẢ các chương còn lại sẽ lần lượt lặp lại y hệt việc thử xoay hết toàn bộ key (đều thất bại) trước khi mới chịu bỏ qua — vừa chậm vô ích, vừa tạo ra N issue cảnh báo giống hệt nhau làm rối bảng kết quả. Nhiệm vụ: 1. Trong directGeminiClient.ts, khi throw lỗi do hết quota toàn bộ key (nhánh 429/RESOURCE_EXHAUSTED), gắn thêm 1 property phân biệt được vào Error (code = 'ALL_KEYS_EXHAUSTED'). Không đổi nội dung message tiếng Việt hiện có. 2. Trong hakoQualityEngine.ts, hàm runAiQualityScan(): trong khối catch của vòng lặp xử lý từng chương, kiểm tra nếu err.code === 'ALL_KEYS_EXHAUSTED' thì: push đúng 1 issue cảnh báo tổng quát, dừng vòng lặp ngay lập tức (break), đảm bảo các chương ĐÃ xử lý xong trước đó vẫn giữ nguyên kết quả. 3. Với các loại lỗi khác, giữ nguyên hành vi hiện tại."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast-Break on Global Quota Exhaustion (Priority: P1)

As a moderator conducting an AI quality inspection across multiple chapters, when all configured API keys have exhausted their quota (HTTP 429 / RESOURCE_EXHAUSTED), I want the scanner to stop immediately after the failing chapter and record a single warning issue, so that the system does not spend minutes fruitlessly rotating through exhausted keys for every remaining chapter.

**Why this priority**: When all keys are exhausted, subsequent chapters are guaranteed to fail. Continuing to attempt every key for every chapter multiplies latency, exhausts network connections, and creates cluttered duplicate warning issues in the results panel.

**Independent Test**: Provide a list of 3 chapters to `runAiQualityScan` where `callGeminiDirect` throws an `ALL_KEYS_EXHAUSTED` error on Chapter 1. Verify that `callGeminiDirect` is called only once, the loop terminates immediately without calling Chapters 2 or 3, and exactly 1 warning issue is emitted.

**Acceptance Scenarios**:

1. **Given** a batch of 3 chapters queued for AI quality review, **When** all API keys return HTTP 429 / RESOURCE_EXHAUSTED on Chapter 1, **Then** the engine records exactly 1 warning issue stating quota exhaustion and terminates without attempting Chapters 2 and 3.
2. **Given** Chapter 1 succeeds and yields 2 quality issues, **When** Chapter 2 encounters quota exhaustion across all keys, **Then** the engine preserves Chapter 1's 2 issues, appends 1 quota exhaustion warning issue, and immediately skips Chapter 3.

---

### User Story 2 - Programmatic Quota Exhaustion Identification (Priority: P1)

As an API consumer calling `callGeminiDirect`, I want errors caused by global quota exhaustion across all available keys to include a distinct property (`err.code === 'ALL_KEYS_EXHAUSTED'`), so that callers can distinguish global rate-limit lockouts from localized chapter defects or transient network failures.

**Why this priority**: Standard `Error` objects with localized string messages cannot be reliably matched without fragile regex parsing. An explicit error code enables robust control flow decisions across callers.

**Independent Test**: Execute `callGeminiDirect` with multiple API keys where all keys respond with HTTP 429. Catch the error and assert that `err.code` strictly equals `'ALL_KEYS_EXHAUSTED'` while the human-readable Vietnamese error message remains intact.

**Acceptance Scenarios**:

1. **Given** all configured API keys fail with HTTP 429 or `RESOURCE_EXHAUSTED`, **When** `callGeminiDirect` completes its final retry attempt, **Then** it throws an Error object with `code === 'ALL_KEYS_EXHAUSTED'`.
2. **Given** the error is thrown, **When** inspecting `err.message`, **Then** the message preserves the existing Vietnamese text (`Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED)...`).

---

### User Story 3 - Isolated Non-Quota Error Resilience (Priority: P2)

As a moderator, when an individual chapter encounters a non-quota error (such as AI content safety rejection, formatting error, or temporary 500 error), I want the quality scanner to log a localized warning issue for that chapter and proceed to scan the remaining chapters, ensuring that one faulty chapter does not prevent inspecting valid chapters.

**Why this priority**: Non-quota errors are often specific to the content of a single chapter. Quota exhaustion is the only condition that affects all chapters globally.

**Independent Test**: Provide 3 chapters where Chapter 1 encounters a generic error (e.g. content safety rejection); verify that Chapter 1 records a warning issue, Chapter 2 and Chapter 3 are still scanned, and results for all chapters are collected.

**Acceptance Scenarios**:

1. **Given** Chapter 1 throws an error where `err.code !== 'ALL_KEYS_EXHAUSTED'`, **When** the error is caught, **Then** the engine records an individual warning issue for Chapter 1 and proceeds to inspect Chapter 2.

---

### Edge Cases

- **Quota exhaustion on first chapter**: 0 chapters succeeded, exactly 1 warning issue is produced, loop breaks at iteration 0.
- **Quota exhaustion on last chapter**: Chapters 1 through $N-1$ have their issues fully preserved, Chapter $N$ produces 1 warning issue, loop finishes naturally.
- **Single API key configured**: If that single key hits 429, `attempt === 0 === rawKeys.length - 1`, error is thrown with `code === 'ALL_KEYS_EXHAUSTED'`.
- **Multiple API keys with partial failures**: Key 1 hits 429, rotates to Key 2 which succeeds. No error is thrown and scanning continues normally.
- **AbortError during scan**: If user cancels, `err.name === 'AbortError'` is rethrown immediately and does not get converted into a quota warning issue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In `src/services/directGeminiClient.ts`, when `callGeminiDirect` exhausts all available API keys due to rate limiting (HTTP 429 or `errStatus === 'RESOURCE_EXHAUSTED'`), the thrown `Error` MUST have its `code` property set to `'ALL_KEYS_EXHAUSTED'`.
- **FR-002**: In `src/services/directGeminiClient.ts`, the existing Vietnamese error message string for exhausted keys (`Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED)...`) MUST remain unchanged.
- **FR-003**: In `src/services/hakoQualityEngine.ts`, within `runAiQualityScan`, the per-chapter loop catch block MUST check if `err.code === 'ALL_KEYS_EXHAUSTED'`.
- **FR-004**: When `err.code === 'ALL_KEYS_EXHAUSTED'` is detected, `runAiQualityScan` MUST record exactly ONE general warning issue describing the quota exhaustion.
- **FR-005**: When `err.code === 'ALL_KEYS_EXHAUSTED'` is detected, `runAiQualityScan` MUST immediately terminate its chapter iteration loop (`break`), refusing to call `callGeminiDirect` for any subsequent chapters.
- **FR-006**: When `runAiQualityScan` terminates early due to quota exhaustion, all quality issues discovered in previously completed chapters MUST remain intact in the returned issue array.
- **FR-007**: For all other error types where `err.code !== 'ALL_KEYS_EXHAUSTED'`, `runAiQualityScan` MUST retain its existing behavior: record an individual warning issue for the affected chapter and continue scanning remaining chapters.
- **FR-008**: Only `src/services/directGeminiClient.ts` and `src/services/hakoQualityEngine.ts` (plus associated test files) may be modified.

### Key Entities *(include if feature involves data)*

- **QualityIssue**: The quality defect or warning issue recorded by the inspection engine. When quota is exhausted, the issue has `category: 'other'`, `severity: 'warning'`, `detectedBy: 'ai'`, and an explanatory notice indicating quota exhaustion.
- **GeminiDirectCallError**: An `Error` instance thrown by `callGeminiDirect` with optional property `code: string`. When quota is exhausted across all keys, `code` is `'ALL_KEYS_EXHAUSTED'`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of chapter loops terminate immediately upon encountering `ALL_KEYS_EXHAUSTED` without initiating any further API calls to Gemini.
- **SC-002**: Exactly 1 warning issue is recorded for global quota exhaustion, eliminating $(N - 1)$ redundant duplicate warnings for an $N$-chapter review batch.
- **SC-003**: Existing key-rotation behavior is 100% preserved when earlier keys hit 429 but a subsequent key succeeds.
- **SC-004**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 type errors and 100% test pass rate.

## Assumptions

- **Scope Boundary**: Other callers of `callGeminiDirect` (e.g. `chapterTranslationService.ts`, `directTranslationEngine.ts`) may leverage `err.code === 'ALL_KEYS_EXHAUSTED'` in future features, but are explicitly out of scope for this modification.
- **Error Property Attachment**: Attaching `code` directly to the `Error` instance (`(err as any).code = 'ALL_KEYS_EXHAUSTED'`) is standard JavaScript practice and does not break existing `instanceof Error` or `err.message` consumers.
