# Feature Specification: Translation Quality Audit Score (0-100)

**Feature Branch**: `107-audit-quality-score`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Bối cảnh: Hiện KHÔNG có nơi nào trong code tính điểm số 0-100 cho chất lượng bản dịch — cả Hako Engine lẫn AI QA Critique chỉ trả về danh sách issue kèm severity, không có điểm tổng hợp. Đây là tính năng THIẾT KẾ MỚI hoàn toàn, không phải việc nối 2 hệ thống có sẵn — làm sau cùng, độc lập, có thể bỏ qua nếu không cần. Nhiệm vụ: 1. Thiết kế 1 công thức đơn giản, ví dụ: điểm bắt đầu 100, trừ theo severity của mỗi UnifiedAuditIssue đang ở trạng thái 'pending' (ví dụ error trừ 8 điểm, warning trừ 3, info trừ 1, điểm không xuống dưới 0). Viết công thức này thành 1 hàm thuần `calculateAuditScore(issues: UnifiedAuditIssue[]): number` trong src/services/auditBridgeService.ts (file đã tạo ở Prompt B1). 2. Hiển thị điểm này trong UnifiedAuditPanel.tsx dưới dạng 1 chỉ số đơn giản (số + nhãn định tính, ví dụ 90-100 "Xuất sắc", 70-89 "Khá", dưới 70 "Cần rà soát lại" — tự đặt ngưỡng hợp lý, ghi rõ lý do), KHÔNG cần đồng hồ đo (gauge) đồ họa phức tạp ở bản đầu tiên — 1 con số + Badge màu theo mức là đủ, đúng tinh thần tối giản của design-system.md. Ràng buộc: - Chỉ sửa: auditBridgeService.ts, UnifiedAuditPanel.tsx. - Đây là điểm THAM KHẢO, ghi rõ trong UI (ví dụ tooltip nhỏ) rằng đây là ước tính dựa trên số lỗi chưa xử lý, không phải đánh giá tuyệt đối. Tiêu chí hoàn thành: - npm run lint, npm test, npm run build đều sạch/pass. - Test cho calculateAuditScore với vài tổ hợp issue khác nhau, xác nhận điểm không âm, không vượt 100."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant Quality Score Computation (Priority: P1)

As a translator or editor using the Translator Workspace, I want to see an immediate aggregate translation quality score (from 0 to 100) calculated from pending quality issues, so that I can quickly gauge the overall readiness and quality of the current translation before publication.

**Why this priority**: Core mathematical engine and primary user value proposition. Translators receive a clear, single-metric summary of chapter health.

**Independent Test**:
Call `calculateAuditScore` with a variety of issue sets (empty list, mixed errors/warnings/info, high issue counts, resolved/ignored issues). Verify that the returned score starts at 100, deducts points only for pending issues, clamps to [0, 100], and produces expected integers.

**Acceptance Scenarios**:
1. **Given** an empty issue list `[]` or a list where all issues are `resolved` or `ignored`, **When** `calculateAuditScore(issues)` is called, **Then** the returned score is `100`.
2. **Given** a list containing pending issues (e.g. 1 error, 2 warnings, 1 info), **When** `calculateAuditScore(issues)` is called, **Then** the score deducts 8 points for each error, 3 for each warning, and 1 for each info (e.g. 100 - (8*1 + 3*2 + 1*1) = 85).
3. **Given** a high number of critical issues (e.g. 15 errors = -120 points), **When** `calculateAuditScore(issues)` is called, **Then** the score clamps at `0` and never returns a negative number.

---

### User Story 2 - Minimalist Score and Qualitative Tier Indicator in Audit Panel (Priority: P2)

As an editor reviewing issues in `UnifiedAuditPanel`, I want to see the audit score displayed as a clean numeric value (e.g. `85/100`) accompanied by a qualitative badge ("Xuất sắc", "Khá", or "Cần rà soát lại") in the header bar, so that I understand what the number signifies at a glance without visual clutter.

**Why this priority**: Translates abstract numeric deductions into actionable semantic feedback aligned with the "Mực & Chu Sa" design system.

**Independent Test**:
Render `UnifiedAuditPanel` with issues resulting in scores in different tiers (>=90, 70-89, <70). Verify the score number, badge text, and color tone (`polish`, `warning`, `danger`) render correctly in the panel header.

**Acceptance Scenarios**:
1. **Given** an audit score between 90 and 100, **When** rendered in `UnifiedAuditPanel`, **Then** the badge displays "Xuất sắc" with `tone="polish"`.
2. **Given** an audit score between 70 and 89, **When** rendered in `UnifiedAuditPanel`, **Then** the badge displays "Khá" with `tone="warning"`.
3. **Given** an audit score below 70, **When** rendered in `UnifiedAuditPanel`, **Then** the badge displays "Cần rà soát lại" with `tone="danger"`.
4. **Given** an issue is resolved via 1-click fix or AI rewrite, **When** the issue status transitions to `'resolved'`, **Then** the score and badge automatically update in real-time.

---

### User Story 3 - Advisory Reference Transparency (Priority: P3)

As a translator viewing the score, I want clear contextual feedback (via a tooltip/title indicator) explaining that the score is an advisory estimate based on remaining unaddressed issues rather than an absolute mathematical judgment, so that I have the correct expectations about its purpose.

**Why this priority**: Prevents misunderstanding or false precision by ensuring users understand the score is an editorial heuristic.

**Independent Test**:
Hover over the score indicator element in `UnifiedAuditPanel` and verify that the explanatory title/tooltip appears with advisory wording.

**Acceptance Scenarios**:
1. **Given** the audit score widget in `UnifiedAuditPanel`, **When** inspected, **Then** it contains a descriptive title/tooltip stating that the score is an advisory estimate based on unresolved issues.

---

### Edge Cases

- **Zero issues detected**: Score is `100`, badge is "Xuất sắc" (`tone="polish"`).
- **All issues resolved/ignored**: When all issues are resolved (e.g. via Auto-Fix or dismissed), the score returns to `100`.
- **Deduction exceeding 100 points**: Extreme issue loads (e.g. 20 errors = 160 deduction) clamp gracefully to `0` instead of negative values.
- **Mixed statuses**: Only issues with `status === 'pending'` contribute to deductions; issues with `status === 'resolved'` or `status === 'ignored'` do not lower the score.
- **Float handling**: Scores are guaranteed to remain integers (`Math.round`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `src/services/auditBridgeService.ts` MUST export a pure calculation function `calculateAuditScore(issues: UnifiedAuditIssue[]): number`.
- **FR-002**: The scoring formula MUST start from a base score of 100 and deduct points based on the severity of issues with `status === 'pending'`:
  - `error`: -8 points
  - `warning`: -3 points
  - `info`: -1 point
- **FR-003**: The score MUST be clamped to the range `[0, 100]` and returned as an integer.
- **FR-004**: `src/services/auditBridgeService.ts` MUST export a helper `getAuditScoreTier(score: number): { label: string; tone: 'polish' | 'warning' | 'danger' }` with thresholds:
  - 90–100: "Xuất sắc" (tone: `polish`)
  - 70–89: "Khá" (tone: `warning`)
  - 0–69: "Cần rà soát lại" (tone: `danger`)
- **FR-005**: `UnifiedAuditPanel.tsx` MUST render the score and qualitative tier badge in its header bar using existing `Badge` and text primitives without external chart/gauge libraries.
- **FR-006**: The score element MUST provide advisory tooltip text (e.g. via `title` attribute) informing the user that this is an estimate based on unresolved issues, not an absolute rating.
- **FR-007**: When issues are marked resolved (via 1-click fix or AI rewrite), the score MUST update reactively.
- **FR-008**: Code modifications MUST be strictly confined to `src/services/auditBridgeService.ts` and `src/components/translator-workspace/UnifiedAuditPanel.tsx` (plus unit tests).

### Key Entities

- **UnifiedAuditIssue**: Standardized issue entity (`id`, `source`, `severity: 'error' | 'warning' | 'info'`, `status: 'pending' | 'resolved' | 'ignored'`).
- **AuditScoreTier**: Presentation structure containing `label: string` ("Xuất sắc" | "Khá" | "Cần rà soát lại") and `tone: 'polish' | 'warning' | 'danger'`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of score calculations return an integer within `[0, 100]`.
- **SC-002**: Resolving an issue in the panel instantly updates the displayed score in < 50ms without full page reloads.
- **SC-003**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 type errors and 0 test failures.
- **SC-004**: Unit tests cover edge cases (empty list, massive deductions, mixed statuses, boundary scores at 69, 70, 89, 90, 100).

## Assumptions

- Point deductions of 8 for error, 3 for warning, and 1 for info provide an intuitive, balanced scale where 1 critical error brings a chapter to 92 (still decent), but 4 errors reduce it to 68 ("Cần rà soát lại").
- The score is computed reactively from `unifiedIssues` already available in `UnifiedAuditPanel`.
- Design complies strictly with `.agents/rules/design-system.md` using existing primitives (`Badge`, `Seal`, `Tooltip`/`title`).
