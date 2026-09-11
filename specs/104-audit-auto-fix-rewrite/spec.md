# Feature Specification: Auto-Fix and Targeted AI Sentence Rewriting

**Feature Branch**: `104-audit-auto-fix-rewrite`  
**Created**: 2026-09-10  
**Status**: Draft  
**Input**: User description: "Bối cảnh: Sau B0-B4, mỗi UnifiedAuditIssue đã có targetText, suggestion (có thể rỗng), autoFixable. src/components/translator-workspace/useWorkspaceState.ts export setRawTranslation/setPolishedTranslation — đây thực chất là handleRawTranslationChange/handlePolishedTranslationChange (đã CRDT-aware, đồng bộ realtime qua Yjs) — mọi thay đổi nội dung chương BẮT BUỘC đi qua 2 hàm này, KHÔNG được tạo state/setState mới để né qua cơ chế CRDT. Nhiệm vụ: 1. Trong useWorkspaceState.ts, thêm hàm `handleApplyAuditFix(issue: UnifiedAuditIssue)`: nếu issue.autoFixable && issue.suggestion, thực hiện const currentText = <rawTranslation hoặc polishedTranslation tùy theo issue này phát hiện ở giai đoạn nào — xác định qua issue.source và ngữ cảnh hiện có>; const newText = currentText.replace(issue.targetText, issue.suggestion); rồi gọi ĐÚNG setter đã export (setPolishedTranslation hoặc setRawTranslation, TUYỆT ĐỐI KHÔNG gọi thẳng useState setter nội bộ nếu có tên trùng — chỉ dùng giá trị đã export ra ngoài object trả về của hook). Nếu targetText không tìm thấy trong currentText (nội dung đã đổi từ lúc phát hiện lỗi), KHÔNG áp dụng, trả về false/throw lỗi rõ ràng để UI báo 'Nội dung đã thay đổi, không thể áp dụng sửa nhanh, vui lòng chạy lại kiểm định'. 2. Trong src/services/directTranslationEngine.ts, thêm hàm mới `rewriteSentenceDirect(params: { targetText: string; context: string; apiKeys, model,... })` — gọi callGeminiDirect với 1 prompt NHỎ, chỉ yêu cầu viết lại ĐÚNG câu targetText cho mượt hơn/đúng ngữ cảnh hơn (dựa vào issue.message làm chỉ dẫn), KHÔNG dịch lại cả đoạn/cả chương. Tham khảo cách các hàm khác trong file này xây prompt (ví dụ polishTranslationDirect) để giữ phong cách prompt nhất quán, viết prompt mới bằng tiếng Việt giữ đúng văn phong hệ thống đã dùng trong shared/prompts.ts. 3. Trong UnifiedAuditPanel.tsx: với issue autoFixable=true, hiện nút 'Sửa ngay' gọi handleApplyAuditFix; với issue nguồn 'ai_critique' có targetText, hiện nút 'Nhờ AI viết lại câu này' gọi rewriteSentenceDirect, khi có kết quả thì hiện đoạn gợi ý mới cho người dùng XEM TRƯỚC và bấm xác nhận áp dụng (không tự động ghi đè ngay khi AI trả lời, vì đây là nội dung mới hoàn toàn chưa qua Prompt B4 để người dùng verify) — bấm xác nhận thì mới gọi handleApplyAuditFix với suggestion = kết quả AI vừa trả về. 4. Sau khi áp dụng fix thành công (dù Hako hay AI), đổi issue.status thành 'resolved' trong state hiển thị của panel. Ràng buộc: Chỉ sửa: useWorkspaceState.ts, directTranslationEngine.ts, UnifiedAuditPanel.tsx. KHÔNG viết logic thay thế text nào ngoài hàm handleApplyAuditFix duy nhất — không để rải rác nhiều chỗ tự làm string.replace khác nhau. rewriteSentenceDirect PHẢI dùng chung cơ chế xoay API key/xử lý lỗi đã có sẵn qua callGeminiDirect, không viết logic gọi fetch riêng. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass. Test cho handleApplyAuditFix: áp dụng thành công khi targetText khớp; trả về lỗi rõ ràng khi targetText không còn khớp với nội dung hiện tại; xác nhận gọi đúng setter CRDT-aware (mock/spy setPolishedTranslation, KHÔNG spy state nội bộ). Test cho rewriteSentenceDirect: mock callGeminiDirect, assert prompt gửi đi chỉ chứa targetText + context liên quan, không chứa toàn bộ nội dung chương (kiểm tra gián tiếp qua độ dài prompt hoặc cấu trúc payload)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Click Heuristic Auto-Fix for Known Rules (Priority: P1) 🎯 MVP

As a translator or editor reviewing rule-based issues in the `UnifiedAuditPanel`,  
I want to click a single "Sửa ngay" (Apply Fix) button on any auto-fixable issue card,  
So that the offending snippet is immediately replaced with the recommended correction in the collaborative workspace without manual copy-pasting.

**Why this priority**:  
Rule-based fixes (such as missing punctuation spacing, raw Chinese leaks, or known glossary misalignments) have pre-computed, deterministic suggestions. Enabling instant one-click fixes delivers immediate productivity gains and saves repetitive manual editing.

**Independent Test**:  
Mount the editor with an issue having `autoFixable: true` and a valid `suggestion`. Click "Sửa ngay", verify the active translation text updates with the corrected text, real-time collaboration synchronization triggers through the designated text change handlers, the issue badge switches to 'resolved', and success feedback is shown.

**Acceptance Scenarios**:

1. **Given** an issue card with `autoFixable: true` and a defined `suggestion` rendered in `UnifiedAuditPanel`, **When** the user clicks "Sửa ngay", **Then** the system replaces the first occurrence of `targetText` with `suggestion` via the active stage text updater, marks the issue status as `'resolved'`, and updates the UI state.
2. **Given** an issue card where `targetText` is no longer present in the current translation (text drifted or edited), **When** the user clicks "Sửa ngay", **Then** the system aborts the replacement, makes no text changes, and displays a clear non-blocking warning: *"Nội dung đã thay đổi, không thể áp dụng sửa nhanh, vui lòng chạy lại kiểm định"*.
3. **Given** a successful auto-fix application, **When** reviewing the issue counters and filter tabs, **Then** the issue moves to resolved state and live counters update accordingly.

---

### User Story 2 - Targeted AI Sentence Rewriting with Preview Verification (Priority: P2)

As a translator dealing with semantic or stylistic critique issues,  
I want to ask the AI to rewrite just the problematic sentence or phrase and review the proposed rewording before applying it,  
So that I maintain full editorial control over narrative tone without risking unintended wholesale overwrites.

**Why this priority**:  
Unlike heuristic rule fixes, AI-generated rewordings introduce brand-new text variations that require human discretion and verification. A focused, preview-first rewrite flow allows editors to polish rough sentences with minimal token overhead and zero unwanted changes to the rest of the chapter.

**Independent Test**:  
Click "Nhờ AI viết lại câu này" on an AI Critique issue card. Verify an inline loading state appears on that card while a micro-prompt processes the target sentence and local context. Verify the returned suggestion renders in a preview comparison box with "Áp dụng" and "Hủy" options. Click "Áp dụng" and verify the translation updates accurately via the centralized fix handler.

**Acceptance Scenarios**:

1. **Given** an issue from `ai_critique` with `targetText`, **When** the user clicks "Nhờ AI viết lại câu này", **Then** the system sends a lightweight prompt containing only the target text, relevant local context, and critique guidance (without sending the whole chapter), showing an in-progress indicator on that card.
2. **Given** the AI completes the sentence rewrite, **When** results return, **Then** the card displays an interactive preview showing the new suggested phrasing, accompanied by confirmation ("Áp dụng") and dismissal ("Hủy") actions.
3. **Given** the preview is displayed, **When** the user clicks "Áp dụng", **Then** the system invokes the centralized fix handler using the AI suggestion, replaces the text in the active translation, marks the issue as `'resolved'`, and dismisses the preview.
4. **Given** the preview is displayed, **When** the user clicks "Hủy", **Then** the preview is closed without modifying any translation text.

---

### User Story 3 - Centralized Text Replacement & Realtime Collaboration Integrity (Priority: P3)

As a collaborating translator in a multi-user workspace,  
I want all automated fixes and rewrites to propagate through the official realtime change handlers,  
So that my edits never get dropped, desynchronized, or bypassed by internal state silos.

**Why this priority**:  
Prevents subtle synchronization bugs in CRDT/Yjs collaborative editing by strictly funneling all text mutations through the established, exported translation update pathway.

**Independent Test**:  
Simulate an auto-fix and an AI rewrite confirmation, spy on the exported translation setters, and verify that all text replacements pass exclusively through the exported handler without invoking private internal setters or ad-hoc string replacements.

**Acceptance Scenarios**:

1. **Given** multiple fix requests (heuristic or AI), **When** processed, **Then** 100% of text substitutions execute through the single centralized `handleApplyAuditFix` routine.
2. **Given** a text replacement occurs, **When** updating workspace state, **Then** the exported realtime-aware setter is invoked directly.

---

### Edge Cases

- **Target text appears multiple times in the document**: Only the specific occurrence corresponding to the issue snippet is replaced (first match via `indexOf`).
- **Target text edited or deleted after scan**: System returns `false`/informative feedback and cancels replacement without corrupting text.
- **AI rewrite API rate-limit or failure**: Displays error message within the card with a retry option, without breaking the rest of the audit panel.
- **Empty or whitespace-only suggestion**: Prevent applying empty suggestions that would unintentionally delete sentences.
- **Multiple simultaneous rewrites on different cards**: Each card tracks its own independent rewrite and preview state without cross-contamination.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a centralized fix handler `handleApplyAuditFix(issue: UnifiedAuditIssue): boolean` in `useWorkspaceState.ts` that determines the current text based on the active translation stage, validates `targetText` existence, replaces `targetText` with `suggestion`, and invokes the exported realtime-aware setter (`setPolishedTranslation` or `setRawTranslation`).
- **FR-002**: `handleApplyAuditFix` MUST NOT perform replacements if `targetText` is not found in the current text, returning `false` and signaling a clear warning message: *"Nội dung đã thay đổi, không thể áp dụng sửa nhanh, vui lòng chạy lại kiểm định"*.
- **FR-003**: System MUST NOT write any text replacement logic outside `handleApplyAuditFix` (zero duplicate or scattered `string.replace` routines).
- **FR-004**: System MUST provide a dedicated service function `rewriteSentenceDirect(params)` in `src/services/directTranslationEngine.ts` that invokes `callGeminiDirect` with a lightweight Vietnamese prompt targeting solely the specific `targetText`, local context, and issue instruction (omitting the full chapter text).
- **FR-005**: `rewriteSentenceDirect` MUST reuse the existing API key rotation and error handling mechanisms of `callGeminiDirect`.
- **FR-006**: In `UnifiedAuditPanel.tsx`, issue cards with `autoFixable: true` and non-empty `suggestion` MUST display a "Sửa ngay" button that triggers `handleApplyAuditFix`.
- **FR-007**: In `UnifiedAuditPanel.tsx`, issue cards from `ai_critique` with `targetText` MUST display a "Nhờ AI viết lại câu này" button that invokes `rewriteSentenceDirect`.
- **FR-008**: In `UnifiedAuditPanel.tsx`, upon receiving AI rewrite results, the system MUST display an inline preview of the suggested rewording with explicit "Áp dụng" and "Hủy" controls, requiring explicit user confirmation before applying.
- **FR-009**: Upon successful application of any fix (heuristic or AI), the system MUST update the issue status to `'resolved'` in the panel's active state.
- **FR-010**: All modifications MUST remain strictly confined to `useWorkspaceState.ts`, `directTranslationEngine.ts`, and `UnifiedAuditPanel.tsx` (and their respective test files).

### Key Entities

- **UnifiedAuditIssue**: Standardized issue structure containing `id`, `source`, `severity`, `title`, `message`, `targetText`, `suggestion`, `autoFixable`, and `status` (`'pending' | 'resolved' | 'ignored'`).
- **RewriteSentenceParams**: Parameters for targeted rewriting including `targetText`, `context`, `issueMessage`, API credentials, and model configuration.
- **AuditFixResult**: Outcome of the fix execution indicating success/failure and drift notification status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Translators can apply deterministic rule fixes with 1 click in under 100ms.
- **SC-002**: Targeted AI sentence rewrites consume at least 70% fewer input tokens compared to re-polishing the entire chapter.
- **SC-003**: 100% of AI sentence rewrites require explicit user review and confirmation before overwriting editor text.
- **SC-004**: 100% of text replacements pass through the single centralized, realtime-aware handler with zero ad-hoc string manipulations.
- **SC-005**: Drifted text errors produce 0 uncaught exceptions and 100% accurate warning messages.
- **SC-006**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 diagnostics.

## Assumptions

- Collaborative workspace synchronization is handled by the exported setters in `useWorkspaceState.ts`.
- Quality issues are detected on either the raw translation or polished translation depending on the active stage when the scan was executed.
- Local sentence context (e.g. surrounding paragraph) provides sufficient context for the model to rephrase natural Vietnamese sentences.
