# Feature Specification: QA Critique Target Text Locating Field

**Feature Branch**: `099-qa-critique-target-text`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Bối cảnh: shared/prompts.ts, hàm buildQaCritiquePayload(), schema hiện tại chỉ yêu cầu Gemini trả về mỗi issue gồm {type, severity, description} — KHÔNG có trường nào chứa đoạn trích tiếng Việt cụ thể gây ra lỗi. So sánh với src/services/hakoQualityEngine.ts (hàm buildAiScanPrompt hoặc tương đương) đã yêu cầu AI trả về field dạng vietnameseSnippet — đây là pattern đã chứng minh hoạt động, cần áp dụng tương tự. Việc này BẮT BUỘC phải làm trước mọi bước khác của Track B: nếu không có đoạn trích định vị, các tính năng "click vào lỗi để highlight trong khung soạn thảo" và "nhờ AI viết lại đúng câu đó" (sẽ làm ở các prompt sau) không có cách nào xác định được vị trí/nội dung cần tác động. Nhiệm vụ: 1. Trong buildQaCritiquePayload() (shared/prompts.ts), thêm 1 trường bắt buộc vào schema issues[], ví dụ targetText: string — yêu cầu rõ trong systemInstruction/prompt rằng AI phải trích dẫn NGUYÊN VĂN (copy chính xác, không diễn giải) đoạn văn tiếng Việt (trong bản dịch đã Polish) liên quan trực tiếp tới lỗi đang báo cáo. Nếu lỗi liên quan tới việc THIẾU nội dung (omission) mà không có đoạn văn tương ứng để trích, cho phép targetText là chuỗi rỗng và ghi rõ trong hướng dẫn prompt cho AI biết khi nào được phép để trống. 2. Cập nhật type DirectQaCritiqueResult trong src/services/directTranslationEngine.ts (và bất kỳ type liên quan nào định nghĩa issue của QA Critique) để phản ánh field mới targetText. 3. KHÔNG cần đổi logic gọi API (hàm qaCritiqueDirect) — chỉ cần payload/schema/type phản ánh đúng field mới, dữ liệu trả về từ Gemini sẽ tự có field này nếu schema yêu cầu đúng. 4. Tìm mọi nơi trong code đang định nghĩa kiểu cho qaIssues (hiện có thể đang là any[] ở 1 vài chỗ, ví dụ props của QaCritiquePanel.tsx) — cập nhật sang type cụ thể có targetText thay vì any, để các bước sau không bị mất type-safety. Ràng buộc: Chỉ được sửa: shared/prompts.ts, src/services/directTranslationEngine.ts, và CHỈ phần khai báo type (không đổi logic UI) trong src/components/translator-workspace/QaCritiquePanel.tsx nếu bắt buộc phải sửa type prop ở đó cho khớp — không đổi giao diện/hành vi của panel này trong prompt này (việc đó thuộc Prompt B2/B3). Không đổi cấu trúc field severity/type/description hiện có, CHỈ THÊM targetText. Không đổi logic Hako Engine (hakoQualityEngine.ts, shared khác) — prompt này chỉ đụng nhánh AI QA Critique. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass — đặc biệt chú ý shared/__tests__/sharedTranslationLogic.test.ts. Dán lại nguyên văn đoạn systemInstruction/schema mới của buildQaCritiquePayload để review thủ công trước khi merge."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Verbatim Snippet Extraction for QA Issues (Priority: P1)

As a literary translator and editor reviewing translated chapters,
I want the AI QA Critique engine to return the exact verbatim Vietnamese text snippet corresponding to each reported issue,
So that downstream editing features can reliably pinpoint, highlight, and offer AI rewriting actions at the precise location in the editor.

**Why this priority**:
Without a verbatim text snippet (`targetText`), editor tools cannot automatically locate where in the translated chapter an issue occurred, blocking all interactive QA correction features (click-to-highlight, inline sentence rewrites).

**Independent Test**:
Can be tested independently by executing `buildQaCritiquePayload` with sample Chinese and Vietnamese text and inspecting the generated Gemini payload:
- Schema mandates a `targetText` property of type `STRING` in `issues.items`.
- `targetText` is marked as a required property in `issues.items.required`.
- System instruction explicitly commands the AI model to copy verbatim without paraphrasing from the Vietnamese translation text.

**Acceptance Scenarios**:
1. **Given** a source Chinese text and a polished Vietnamese translation, **When** `buildQaCritiquePayload` is called, **Then** the returned schema declares `targetText` under `issues.items.properties` with type `STRING`, and includes `"targetText"` in `issues.items.required`.
2. **Given** the QA critique system instruction, **When** evaluated by the AI model, **Then** it instructs the model to extract verbatim excerpts from the Polish translation for addition, repetition, terminology, or phrasing issues.
3. **Given** an issue involving an omission where no corresponding Vietnamese sentence exists, **When** the AI model outputs the issue, **Then** `targetText` is formatted as an empty string `""` as permitted by the instruction.

---

### User Story 2 - End-to-End Type Safety for QA Critique Issues (Priority: P1)

As a developer maintaining the translation workspace and quality pipelines,
I want strongly typed interfaces representing QA Critique issues and results with the mandatory `targetText` field,
So that compile-time type checking prevents runtime errors and eliminates unsafe `any[]` usages across workspace components.

**Why this priority**:
Downstream features in Track B rely on strict type contracts. Replacing `any[]` with concrete types at the data foundation ensures long-term codebase maintainability and prevents subtle bugs.

**Independent Test**:
Can be verified via TypeScript compilation (`npx tsc --noEmit`):
- `DirectQaCritiqueResult` and `DirectQaCritiqueIssue` contain `targetText: string`.
- `QaCritiquePanelProps`, `BilingualEditorProps`, and workspace state definitions use `DirectQaCritiqueIssue[]` instead of `any[]`.
- All type checks pass without any errors.

**Acceptance Scenarios**:
1. **Given** `DirectQaCritiqueResult` in `src/services/directTranslationEngine.ts`, **When** inspected by the TypeScript compiler, **Then** its `issues` property is typed as `DirectQaCritiqueIssue[]` (or equivalent) rather than `any[]`.
2. **Given** `QaCritiquePanelProps` in `src/components/translator-workspace/QaCritiquePanel.tsx`, **When** checking the `qaIssues` prop, **Then** it is typed with the concrete issue interface containing `targetText`.
3. **Given** existing caller components (such as `BilingualEditor.tsx` and `useWorkspaceState.ts`), **When** passing `qaIssues`, **Then** types align without `any` casts or compiler diagnostics.

---

### User Story 3 - Graceful Handling of Omission Errors with Empty Snippets (Priority: P2)

As a translation reviewer reviewing omission errors,
I want omission issues to clearly indicate the absence of Vietnamese text via an empty `targetText`,
So that the UI and highlight logic know there is no text snippet in the Vietnamese editor to highlight, while still showing the full issue explanation and affected Chinese context.

**Why this priority**:
Omission errors are unique because the text exists in the Chinese raw source but is completely absent from the Vietnamese output. The system must specify a clear protocol (`targetText === ""`) so UI highlight components don't crash or falsely highlight unrelated text.

**Independent Test**:
Can be verified by testing mock responses where `type === 'omission'` and `targetText === ''`, ensuring downstream consumers parse and accept the object cleanly.

**Acceptance Scenarios**:
1. **Given** an omission issue returned by Gemini with `targetText: ""`, **When** parsed by `qaCritiqueDirect`, **Then** the resulting object preserves `targetText: ""` without mutation or rejection.
2. **Given** the system instruction in `shared/prompts.ts`, **When** read by the AI, **Then** it clearly states that `targetText` MUST be an empty string `""` if and only if the issue is an omission with no corresponding translated text.

---

### Edge Cases

- **AI returns undefined or missing `targetText`**: Downstream consumers or parsers should gracefully default `targetText` to `""` if an uncompliant AI response lacks the field.
- **AI returns snippet with minor whitespace differences**: Prompt instructions explicitly mandate verbatim copying (`NGUYÊN VĂN`) without adding quotation marks or modifying punctuation.
- **Empty issues list**: When translation is valid (`isValid: true`), `issues` is an empty array `[]` and `targetText` validation is trivially satisfied.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `buildQaCritiquePayload` in `shared/prompts.ts` MUST include `targetText` of type `STRING` in the `issues.items.properties` JSON schema.
- **FR-002**: `buildQaCritiquePayload` MUST include `"targetText"` in `issues.items.required`, alongside `"type"`, `"severity"`, and `"description"`.
- **FR-003**: The `systemInstruction` in `buildQaCritiquePayload` MUST explicitly instruct the AI to provide a verbatim quotation (`NGUYÊN VĂN`) of the Vietnamese text snippet in `targetText` for detected issues, while explicitly allowing an empty string `""` for omission issues that have no corresponding Vietnamese text.
- **FR-004**: `src/services/directTranslationEngine.ts` MUST define a concrete interface (e.g. `DirectQaCritiqueIssue`) containing `type`, `severity`, `description`, and `targetText: string`, and use it in `DirectQaCritiqueResult.issues`.
- **FR-005**: All consumers of QA issues (`QaCritiquePanel.tsx`, `BilingualEditor.tsx`, `useWorkspaceState.ts`) that currently use `any[]` for `qaIssues` MUST be updated to use the typed issue interface.
- **FR-006**: Existing issue fields (`type`, `severity`, `description`) MUST remain unchanged in structure and enum values.
- **FR-007**: No changes MUST be made to Hako Quality Engine (`src/services/hakoQualityEngine.ts`), API calling mechanics, or UI layout/rendering logic.

### Key Entities

- **DirectQaCritiqueIssue**: Represents an individual quality issue detected during QA Critique.
  - `type`: `'omission' | 'addition' | 'repetition' | 'terminology' | 'other'`
  - `severity`: `'critical' | 'warning' | 'info'`
  - `description`: Detailed explanation of the issue.
  - `targetText`: Exact verbatim Vietnamese text excerpt from the polished translation (or `""` if omission).
- **DirectQaCritiqueResult**: The overall critique result containing `isValid: boolean`, `issues: DirectQaCritiqueIssue[]`, and `successKeyIndex: number`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of generated QA critique schemas include `targetText` as a required string field.
- **SC-002**: 0 occurrences of `any[]` typing for `qaIssues` in `directTranslationEngine.ts`, `QaCritiquePanel.tsx`, `BilingualEditor.tsx`, and `useWorkspaceState.ts`.
- **SC-003**: 100% pass rate on all automated test suites (`vitest run`), specifically including updated QA critique payload tests in `shared/__tests__/sharedTranslationLogic.test.ts`.
- **SC-004**: Strict verification gates (`tsc --noEmit`, `vitest run`, `vite build`) succeed with 0 warnings/errors.

## Assumptions

- The Gemini model adheres to structured output JSON schemas when `responseSchema` is provided.
- Downstream Track B features (issue highlighting in editor, AI single-sentence rewriting) will consume `targetText` for text searching and diffing.
- Existing translation flow and UI behavior remain completely unaffected visually by this typing and schema addition.
