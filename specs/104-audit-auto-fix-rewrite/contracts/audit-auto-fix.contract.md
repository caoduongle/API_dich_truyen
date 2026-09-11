# Contract Specification: Auto-Fix and Targeted AI Sentence Rewriting

**Feature Branch**: `104-audit-auto-fix-rewrite`  
**Date**: 2026-09-10  
**Status**: Formal Contract  

---

## 1. Contract: `handleApplyAuditFix`

### Signature
```typescript
function handleApplyAuditFix(issue: UnifiedAuditIssue): boolean
```

### Preconditions
- `issue` must be an object satisfying `UnifiedAuditIssue`.
- `issue.targetText` must be a non-empty string.
- `issue.suggestion` must be a non-empty string.

### Invariants & Postconditions
- MUST determine active text source (`rawTranslation` if `activeStage === 'raw'`, otherwise `polishedTranslation` with fallback to `rawTranslation`).
- MUST check `currentText.indexOf(issue.targetText) !== -1`.
- If match is NOT found:
  - MUST NOT alter translation state.
  - MUST display warning toast: `"Nội dung đã thay đổi, không thể áp dụng sửa nhanh, vui lòng chạy lại kiểm định"`.
  - MUST return `false`.
- If match IS found:
  - MUST compute `const newText = currentText.replace(issue.targetText, issue.suggestion)`.
  - MUST invoke the exported setter (`handlePolishedTranslationChange` or `handleRawTranslationChange`) to trigger CRDT Yjs updates across collaborators.
  - MUST return `true`.

---

## 2. Contract: `rewriteSentenceDirect`

### Signature
```typescript
function rewriteSentenceDirect(params: DirectRewriteSentenceParams): Promise<DirectRewriteSentenceResult>
```

### Input Schema
- `targetText`: String, length > 0.
- `context`: Optional surrounding context (string).
- `issueMessage`: Optional critique guidance (string).
- `apiKeys`: Non-empty array of valid Gemini API keys.
- `model`: Optional string (defaults to `gemini-2.5-flash`).

### Output Schema
- `rewrittenSentence`: Non-empty rephrased Vietnamese string.
- `successKeyIndex`: Non-negative integer indicating the winning API key index.

### Network Behavior & Token Bounds
- MUST invoke `callGeminiDirect`.
- MUST NOT include the full chapter content in the payload.
- MUST handle errors using the existing error taxonomy (`ALL_KEYS_EXHAUSTED`, 429, etc.).

---

## 3. Contract: `UnifiedAuditPanel` UI Behaviors

### 3.1 Heuristic Auto-Fix
- For any issue with `issue.autoFixable === true && issue.suggestion`:
  - Renders button labeled "Sửa ngay" with tone `primary` / `sm`.
  - Clicking "Sửa ngay" invokes `onApplyFix(issue)` (or the bound handler).
  - On `true` return: issue status switches to `'resolved'`, count updates.

### 3.2 AI Sentence Rewrite
- For any issue where `issue.source === 'ai_critique' && Boolean(issue.targetText)`:
  - Renders button labeled "Nhờ AI viết lại câu này" with Sparkles icon.
  - Clicking button triggers `rewriteSentenceDirect` with targeted payload.
  - While fetching: button shows spinner with label "Đang viết lại..." and is disabled.
  - On success: card expands to show an inline preview comparing original excerpt and AI rewrite.
  - Preview offers:
    - "Áp dụng": calls `onApplyFix({ ...issue, suggestion: rewrittenText })`. On success, marks issue as `'resolved'` and closes preview.
    - "Hủy": closes preview without calling `onApplyFix`.

