# Feature Specification: Hako Quality Checker AI Quota Estimation & Advisory Warning

**Feature Branch**: `098-hako-quota-estimation-warning`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Bối cảnh: src/components/hako-checker/HakoChapterSelector.tsx có nút bắt đầu kiểm định hiển thị dạng "Bắt đầu kiểm định (N chương)" nhưng không cho biết trước sẽ tốn bao nhiêu lượt gọi AI (mỗi chương = 1 lượt gọi Gemini trong runAiQualityScan). App đã có src/services/localQuotaTracker.ts theo dõi quota còn lại theo từng API key (localStorage-based, không gọi network) nhưng chưa được tận dụng ở màn hình này. Nhiệm vụ: 1. Cạnh nút "Bắt đầu kiểm định (N chương)", thêm 1 dòng chú thích nhỏ dạng "~N lượt gọi AI" (N = số chương đã chọn, vì mỗi chương tương ứng 1 lượt gọi AI scan trong pipeline hiện tại — xác nhận lại điều này bằng cách đọc runAiQualityScan trong hakoQualityEngine.ts trước khi code, đừng giả định). 2. Nếu localQuotaTracker.ts có hàm cho biết số lượt gọi còn lại khả dụng (hoặc trạng thái healthy của keys): nếu số lượt gọi còn lại < N (hoặc có key quota bị exhausted), hiển thị 1 cảnh báo nhẹ dạng text amber (dùng token có sẵn: text-amber-300, bg-amber-950/30, border-amber-800/50 — xem design-system.md để biết không được tự chế màu mới): ví dụ "Quota khả dụng có thể không đủ cho toàn bộ N chương đã chọn". 3. Cảnh báo này CHỈ mang tính tham khảo/khuyến cáo, TUYỆT ĐỐI không block người dùng bấm nút bắt đầu kiểm định (không disable nút chỉ vì cảnh báo này). 4. Kiểm tra lại: KHÔNG sửa file nào khác ngoài src/components/hako-checker/HakoChapterSelector.tsx (và file test nếu cần bổ sung test). Không sửa localQuotaTracker.ts (chỉ import dùng những gì đã có)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI Call Estimation Annotation (Priority: P1)

As a translation quality reviewer using the Hako Checker,
I want to see an estimate of how many AI API calls will be consumed for my current chapter selection,
So that I can budget and understand the AI resource consumption before initiating the review scan.

**Why this priority**:
Reviewers currently have no visibility into the cost/resource consumption of running quality checks across multiple chapters. Transparent estimation is fundamental to user confidence and efficient key allocation.

**Independent Test**:
Can be fully tested by selecting any number of chapters $N$ ($1 \le N \le 12$) in `HakoChapterSelector` and verifying that the label `"~N lượt gọi AI"` is displayed adjacent to the start analysis action area.

**Acceptance Scenarios**:

1. **Given** a user has selected 0 chapters in `HakoChapterSelector`, **When** looking at the action footer, **Then** no AI call estimate annotation is displayed (or the start button remains in its disabled empty selection state).
2. **Given** a user selects 3 chapters, **When** the selection updates, **Then** a clear annotation `"~3 lượt gọi AI"` is immediately rendered adjacent to the "Bắt đầu kiểm định (3 chương)" button.
3. **Given** a user adjusts selection from 3 to 7 chapters, **When** the count changes, **Then** the estimation dynamically reflects `"~7 lượt gọi AI"`.

---

### User Story 2 - Advisory Quota Warning for Depleted or Low Capacity (Priority: P1)

As a translation quality reviewer,
I want to receive an unobtrusive visual advisory warning if my configured API keys have exhausted quota or if available keys are insufficient to cover the selected chapters,
While still retaining the freedom to click and execute the review scan if I wish.

**Why this priority**:
Preventing unexpected mid-batch failure due to quota exhaustion without imposing restrictive modal blocks or locking the user out of manual overrides.

**Independent Test**:
Can be tested by simulating an API key state where quota is exhausted (or unavailable) in `localQuotaTracker` and selecting chapters, then observing that an amber advisory badge/banner is shown, and confirming the start button remains clickable.

**Acceptance Scenarios**:

1. **Given** the user's active API keys are healthy with sufficient quota, **When** viewing the chapter selection screen, **Then** no quota warning banner/alert is displayed.
2. **Given** one or all configured API keys have `healthState === 'QuotaExhausted'` or all keys are exhausted/unavailable according to `localQuotaTracker`, **When** the user selects $N \ge 1$ chapters, **Then** an advisory warning is displayed using established amber styling tokens (`text-amber-300`, `bg-amber-950/30`, `border-amber-800/50`) stating that available quota may be insufficient.
3. **Given** the quota advisory warning is visible, **When** the user evaluates the start button, **Then** the start button remains fully clickable and enabled, and clicking it invokes the analysis process normally without blocking.

---

### Edge Cases

- **Zero API keys configured**: If the user has no configured API keys in storage, the system should treat available quota as 0 and display a subtle advisory note, without breaking or throwing runtime exceptions.
- **Dynamic Key Recovery**: When a key recovers from cooldown or reset day rollover, the advisory message updates reactively.
- **Selection cleared ($N = 0$)**: When user clears selection or selects 0 chapters, the advisory warning and estimate are cleanly tucked away or contextualized to zero.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an informational annotation of the form `"~N lượt gọi AI"` adjacent to or within the Start Analysis button container, where $N$ equals the number of currently selected chapters (`selectedChapterIds.length`).
- **FR-002**: System MUST inspect local quota state from `localQuotaTracker` without performing any remote network calls.
- **FR-003**: System MUST display an amber warning message (`text-amber-300`, `bg-amber-950/30`, `border-amber-800/50`) when all keys are exhausted (`QuotaExhausted`), when key health is unavailable, or when estimated available calls across keys is fewer than $N$.
- **FR-004**: System MUST NOT disable, lock, or prevent user interaction with the Start Analysis button solely because of a quota advisory warning.
- **FR-005**: All UI styles MUST strictly adhere to `.agents/rules/design-system.md`, using existing ink, parchment, and amber color tokens with `rounded-[2px]` or `rounded-[3px]`.
- **FR-006**: The implementation MUST ONLY modify `src/components/hako-checker/HakoChapterSelector.tsx` and accompanying test files, preserving `src/services/localQuotaTracker.ts` and `src/services/hakoQualityEngine.ts` unchanged.

### Key Entities

- **Selected Chapter Count ($N$)**: The number of chapters chosen for analysis in the current session ($1 \le N \le 12$).
- **Quota Snapshot**: Information retrieved from `localQuotaTracker.getQuotaStatus()` containing key health states (`Healthy`, `QuotaExhausted`, `RateLimited`, `AuthFailed`) and daily request metrics.
- **Advisory Warning**: A non-blocking visual alert informing the user about potential quota shortages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Reviewers immediately see `"~N lượt gọi AI"` next to the action button within 0 milliseconds of selecting $N$ chapters (instant synchronous React state update).
- **SC-002**: 100% of user clicks on the "Bắt đầu kiểm định" button execute unhindered regardless of whether a quota advisory warning is currently displayed.
- **SC-003**: 100% compliance with design system tokens (no custom red or alien hex colors introduced).
- **SC-004**: Zero regression on existing features; all unit tests and quality checks (`npm run lint`, `npm test`, `npm run build`) pass cleanly.

## Assumptions

- Each chapter sent to `runAiQualityScan` executes exactly 1 direct Gemini API call, as verified by code inspection in `hakoQualityEngine.ts` (lines 150-250).
- Local key health and quota states are tracked client-side in `localQuotaTracker` and can be retrieved via `getQuotaStatus` or `getKeyHealth`.
- Fallback loading of API keys when not provided as props uses `migrateAndLoadApiKeys` or safe credential utilities without throwing exceptions.
