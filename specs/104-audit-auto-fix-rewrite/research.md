# Technical Research: Auto-Fix and Targeted AI Sentence Rewriting

**Feature Branch**: `104-audit-auto-fix-rewrite`  
**Date**: 2026-09-10  
**Status**: Completed  

---

## 1. Context & Architecture Review

In the collaborative translation workspace (`TranslatorWorkspace`), quality inspection produces unified issues (`UnifiedAuditIssue`) combining heuristic rule checks (from Hako Engine) and semantic QA critique (from Gemini).

Currently:
1. Each `UnifiedAuditIssue` already contains `targetText`, `suggestion`, `autoFixable`, and `status`.
2. Workspace state (`useWorkspaceState.ts`) provides `rawTranslation`, `polishedTranslation`, and exports realtime-aware setters `setRawTranslation` (`handleRawTranslationChange`) and `setPolishedTranslation` (`handlePolishedTranslationChange`).
3. These exported setters synchronize mutations across connected clients via CRDT (`useChapterCRDT` wrapping Yjs). Any state update that bypasses these exported handlers causes client desynchronization.

---

## 2. Decision 1: Centralized Text Replacement in `handleApplyAuditFix`

- **Decision**: Implement `handleApplyAuditFix(issue: UnifiedAuditIssue): boolean` directly in `useWorkspaceState.ts`.
- **Target Selection**:
  - Determine which text to modify:
    - If `issue.source === 'hako_rule'`, check `polishedTranslation` first (since heuristic scans run on polished text), falling back to `rawTranslation` if in raw stage.
    - If `issue.source === 'ai_critique'`, check `polishedTranslation` first (since QA critique evaluates polished text against source), falling back to `rawTranslation`.
    - If `activeStage === 'raw'`, prioritize `rawTranslation`.
  - Check `currentText.indexOf(issue.targetText) !== -1`.
  - If not found, do NOT modify text, show toast `"Nội dung đã thay đổi, không thể áp dụng sửa nhanh, vui lòng chạy lại kiểm định"` (type: `warning`), and return `false`.
  - If found, compute `const newText = currentText.replace(issue.targetText, issue.suggestion || '')`.
  - Invoke the exported setter: `handlePolishedTranslationChange(newText)` or `handleRawTranslationChange(newText)`.
  - Return `true`.
- **Rationale**: Strict centralization prevents scattered, inconsistent `string.replace` calls across UI components and guarantees CRDT synchronization across collaborators.
- **Alternatives Considered**:
  - *Ad-hoc replacement in component*: Rejected because it bypasses CRDT hooks and risks race conditions.
  - *Regex global replace*: Rejected because replacing all occurrences could corrupt identical words in unrelated paragraphs; first occurrence matching `indexOf` preserves localized intent.

---

## 3. Decision 2: Targeted Micro-Prompt in `rewriteSentenceDirect`

- **Decision**: Add `rewriteSentenceDirect(params: DirectRewriteSentenceParams): Promise<DirectRewriteSentenceResult>` to `src/services/directTranslationEngine.ts`.
- **Prompt Architecture**:
  - Use `callGeminiDirect` to reuse key rotation, error taxonomy, and request pacing.
  - Keep payload compact: send only `targetText`, local `context` (if available), and `issueMessage` (guidance).
  - Explicitly omit entire chapter body.
  - Schema:
    ```json
    {
      "type": "OBJECT",
      "properties": {
        "rewrittenSentence": {
          "type": "STRING",
          "description": "Câu/cụm từ đã được viết lại hoàn chỉnh theo góp ý biên tập"
        }
      },
      "required": ["rewrittenSentence"]
    }
    ```
- **Rationale**: Minimal latency (<1.5s), negligible token consumption, zero hallucination risk on rest of chapter text.
- **Alternatives Considered**:
  - *Re-running `polishTranslationDirect` on the entire paragraph/chapter*: Rejected due to high token cost, slow response, and risk of unintended edits to approved sections.

---

## 4. Decision 3: Inline Preview & Confirmation Workflow in `UnifiedAuditPanel`

- **Decision**:
  - For `autoFixable: true` issues with existing `suggestion`: Render an immediate "Sửa ngay" action button.
  - For `source === 'ai_critique'` issues with `targetText`: Render a "Nhờ AI viết lại câu này" action button.
  - Track card-specific pending state: `rewritingCardId: string | null` and `activePreviews: Record<string, string>` (issueId -> AI rewritten text).
  - When AI rewrite completes, display an inline preview box:
    - Original excerpt (highlighted/struck through) vs AI suggested rewording (accented).
    - "Áp dụng" button: calls `onApplyFix({ ...issue, suggestion: rewrittenText })`. On success, sets `issue.status = 'resolved'` and removes preview.
    - "Hủy" button: clears preview without modifying document.
- **Rationale**: Human-in-the-loop verification is critical for AI-generated text. Directly overwriting editor text without review violates translation quality principles.

---

## 5. Decision 4: Local Status Mutation & Counter Synchronization

- **Decision**:
  - Inside `UnifiedAuditPanel`, maintain a local status map or resolved set `resolvedIssueIds: Set<string>`.
  - When an issue is successfully fixed, add its ID to `resolvedIssueIds`.
  - Map issues dynamically: if `resolvedIssueIds.has(issue.id)`, `status = 'resolved'`.
  - This automatically updates the `pendingCount` badge in the filter tabs and reflects instant visual feedback (dimmed card or 'Đã sửa' badge).
- **Rationale**: Keeps UI instantly responsive without requiring an asynchronous re-scan of the entire chapter after every single one-word fix.

