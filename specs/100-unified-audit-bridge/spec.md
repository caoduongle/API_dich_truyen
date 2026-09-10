# Feature Specification: Unified Audit Issue Types & Bridge Service

**Feature Branch**: `100-unified-audit-bridge`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Bối cảnh: App hiện có 2 hệ thống phát hiện lỗi độc lập với 2 kiểu dữ liệu khác nhau: - QualityIssue (src/types/hakoChecker.ts) — nguồn Hako Engine, severity dạng 'critical'|'major'|'minor'|'warning', có vietnameseSnippet/rawSnippet, có decision pending/confirmed/review_needed/dismissed. - Issue của QA Critique (src/services/directTranslationEngine.ts, sau khi làm xong Prompt B0 đã có thêm targetText) — severity dạng 'critical'|'warning'|'info', chưa có cơ chế decision (confirm/dismiss) nào cả, chỉ hiển thị phẳng. Nhiệm vụ: 1. Tạo file mới src/types/audit.ts, định nghĩa: - type IssueSource = 'hako_rule' | 'ai_critique'; - type UnifiedSeverity = 'error' | 'warning' | 'info'; kèm 1 hàm/bảng map rõ ràng: Hako 'critical'|'major' → 'error', Hako 'minor'|'warning' → 'warning'; QA 'critical' → 'error', QA 'warning' → 'warning', QA 'info' → 'info'. Viết rõ bảng quy đổi này thành 1 object/hàm, không map ngầm rải rác trong code. - interface UnifiedAuditIssue { id: string; source: IssueSource; severity: UnifiedSeverity; title: string; message: string; targetText?: string; suggestion?: string; autoFixable: boolean; status: 'pending' | 'resolved' | 'ignored'; } — CHỈ thêm field khác nếu thực sự cần, không bịa thêm field 'cho đủ đẹp' nếu không dùng tới ở các prompt sau. 2. Tạo file mới src/services/auditBridgeService.ts với 2 hàm thuần (pure function, không gọi API/DB): - mapHakoIssueToUnified(issue: QualityIssue): UnifiedAuditIssue - mapQaIssueToUnified(issue: DirectQaCritiqueIssue, id?: string): UnifiedAuditIssue Với QA issue: status luôn khởi tạo 'pending', autoFixable luôn false (vì cần gọi AI viết lại, không sửa tức thì bằng rule) — sẽ tinh chỉnh ở Prompt B5 nếu cần. Với Hako issue: autoFixable dựa theo field category (ví dụ punctuation/raw_leak có thể autoFixable, còn mistranslation/omission thì không — tự xác định logic hợp lý dựa trên các category liệt kê trong src/types/hakoChecker.ts, giải thích rõ lý do chọn trong code comment). Ràng buộc: CHỈ tạo 2 file mới nêu trên (và file test). KHÔNG sửa bất kỳ file hiện có nào khác trong prompt này. Không thêm dependency mới. Viết unit test đầy đủ ngay trong prompt này. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass. File test mới src/services/__tests__/auditBridgeService.test.ts bao phủ toàn diện."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified Data Contract for Quality Defects (Priority: P1)

As a developer and system architect building Track B inspection interfaces,
I want a unified representation for quality defects coming from both the Hako Quality Engine and the Gemini AI QA Critique engine,
So that downstream workspace components (inspector panels, inline editor highlights, batch resolvers) can consume and operate on a single, standardized defect model without caring about the underlying detection mechanism.

**Why this priority**:
Currently, the codebase has two disjoint defect models (`QualityIssue` in `hakoChecker.ts` and `DirectQaCritiqueIssue` in `directTranslationEngine.ts`) with differing severities, differing field names, and mismatched lifecycle states. Normalizing these through an explicit bridge contract is the indispensable architectural foundation for all unified UI and remediation features.

**Independent Test**:
Can be verified via TypeScript compilation (`npm run lint`):
- `src/types/audit.ts` exports `IssueSource`, `UnifiedSeverity`, `UnifiedAuditIssue`, and explicit severity translation mappings.
- Compiles with zero type diagnostics.

**Acceptance Scenarios**:
1. **Given** `src/types/audit.ts`, **When** inspected for types, **Then** `IssueSource` is `'hako_rule' | 'ai_critique'`, `UnifiedSeverity` is `'error' | 'warning' | 'info'`, and `UnifiedAuditIssue` strictly adheres to the requested shape (`id`, `source`, `severity`, `title`, `message`, `targetText?`, `suggestion?`, `autoFixable`, `status`).
2. **Given** severity level inputs from Hako ('critical', 'major', 'minor', 'warning') and QA Critique ('critical', 'warning', 'info'), **When** mapped using the explicit severity mapping tables/functions, **Then** Hako `critical`/`major` map to `error`, Hako `minor`/`warning` map to `warning`, QA `critical` maps to `error`, QA `warning` maps to `warning`, and QA `info` maps to `info`.

---

### User Story 2 - Deterministic Normalization via Pure Bridge Functions (Priority: P1)

As an auditor and translation reviewer,
I want pure converter functions that normalize heterogeneous defect objects into `UnifiedAuditIssue` records,
So that issues have consistent titles, normalized severity, appropriate auto-fixable flags, and clean lifecycle status.

**Why this priority**:
Normalization must be 100% deterministic, side-effect-free, and thoroughly testable without needing network mocks or database fixtures.

**Independent Test**:
Can be verified via unit tests in `src/services/__tests__/auditBridgeService.test.ts`:
- Calling `mapHakoIssueToUnified` with a `QualityIssue` returns a valid `UnifiedAuditIssue` with mapped severity, snippet mapped to `targetText`, and correct `autoFixable` boolean based on category.
- Calling `mapQaIssueToUnified` with a `DirectQaCritiqueIssue` returns a valid `UnifiedAuditIssue` with `source: 'ai_critique'`, `status: 'pending'`, and `autoFixable: false`.

**Acceptance Scenarios**:
1. **Given** a Hako issue with category `'raw_leak'`, **When** converted via `mapHakoIssueToUnified`, **Then** `source` is `'hako_rule'`, `autoFixable` is `true`, `targetText` matches `vietnameseSnippet`, and `suggestion` matches `suggestedFix`.
2. **Given** a Hako issue with category `'mistranslation'`, **When** converted via `mapHakoIssueToUnified`, **Then** `autoFixable` is `false` because semantic translation defects require human review or AI re-translation rather than deterministic rule replacement.
3. **Given** a Hako issue with decision `'dismissed'`, **When** converted, **Then** `status` is `'ignored'`, whereas `'pending'`, `'confirmed'`, or `'review_needed'` map to `'pending'`.
4. **Given** a QA Critique issue with `targetText: 'đoạn văn bị lỗi'`, **When** converted via `mapQaIssueToUnified`, **Then** `source` is `'ai_critique'`, `targetText` is `'đoạn văn bị lỗi'`, `autoFixable` is `false`, and `status` is `'pending'`.
5. **Given** a QA Critique issue with an omission (`targetText: ''`), **When** converted, **Then** `targetText` is preserved as `''` (or empty string/undefined).

---

### Edge Cases

- **Hako issue without `suggestedFix` or `rawSnippet`**: Bridge function handles optional fields gracefully, setting `suggestion` to undefined or omitting it.
- **QA issue without an explicit ID provided**: Bridge function generates a stable or unique identifier (e.g. `crypto.randomUUID()` or timestamp-based UUID) if one is not passed in.
- **Unknown or unexpected severity/category**: Pure mapper falls back safely to reasonable defaults (`warning`, non-autoFixable) without throwing unhandled runtime exceptions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create `src/types/audit.ts` declaring:
  - `type IssueSource = 'hako_rule' | 'ai_critique';`
  - `type UnifiedSeverity = 'error' | 'warning' | 'info';`
  - `interface UnifiedAuditIssue { id: string; source: IssueSource; severity: UnifiedSeverity; title: string; message: string; targetText?: string; suggestion?: string; autoFixable: boolean; status: 'pending' | 'resolved' | 'ignored'; }`
- **FR-002**: System MUST define explicit, non-scattered severity mapping table/functions in `src/types/audit.ts` (or `auditBridgeService.ts`) mapping:
  - Hako `'critical'` | `'major'` → `'error'`
  - Hako `'minor'` | `'warning'` → `'warning'`
  - QA `'critical'` → `'error'`
  - QA `'warning'` → `'warning'`
  - QA `'info'` → `'info'`
- **FR-003**: System MUST create `src/services/auditBridgeService.ts` containing pure functions:
  - `mapHakoIssueToUnified(issue: QualityIssue): UnifiedAuditIssue`
  - `mapQaIssueToUnified(issue: DirectQaCritiqueIssue, id?: string): UnifiedAuditIssue`
- **FR-004**: `mapQaIssueToUnified` MUST set `status: 'pending'` and `autoFixable: false`.
- **FR-005**: `mapHakoIssueToUnified` MUST determine `autoFixable` based on `issue.category`:
  - Categories with deterministic rule-based replacements (such as `raw_leak`, `repetition`) evaluate to `autoFixable: true`.
  - Semantic categories requiring contextual reasoning (such as `mistranslation`, `omission`, `hallucination`, `inconsistent_name`, `pronoun_gender`, `terminology_drift`, `wrong_chapter`, `other`) evaluate to `autoFixable: false`.
  - In-code comments MUST document the rationale for each category's `autoFixable` classification.
- **FR-006**: The implementation MUST ONLY create `src/types/audit.ts`, `src/services/auditBridgeService.ts`, and `src/services/__tests__/auditBridgeService.test.ts`. No existing application code or UI components shall be modified in this feature.
- **FR-007**: No new NPM dependencies shall be added.

### Key Entities

- **UnifiedAuditIssue**: Standardized defect entity consumable across all audit and translation review surfaces.
- **IssueSource**: Identifier for the source detector (`'hako_rule'` vs `'ai_critique'`).
- **UnifiedSeverity**: Normalized 3-tier severity rating (`'error'`, `'warning'`, `'info'`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of severity levels from both source engines map unambiguously according to the defined lookup table with 0 unhandled branches.
- **SC-002**: 100% test pass rate in `src/services/__tests__/auditBridgeService.test.ts` covering all mapping rules, severity conversions, targetText preservation, and autoFixable category branches.
- **SC-003**: 0 existing application files modified; existing features suffer 0 regressions.
- **SC-004**: Verification commands (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 errors.

## Assumptions

- Hako issues originate from `QualityIssue` in `src/types/hakoChecker.ts`.
- QA Critique issues originate from `DirectQaCritiqueIssue` in `src/services/directTranslationEngine.ts`.
- Future prompts (Prompt B2, B3, B4, B5) will consume `UnifiedAuditIssue` to build the unified issue review drawer, inline highlights, and automated batch resolvers.
