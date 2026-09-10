# Contract: Textarea Highlight & Issue Selection

**Feature**: `103-textarea-issue-selection`  
**Date**: 2026-09-10  
**Status**: Formalized  

---

## 1. DOM Utility Contract: `scrollAndSelectInTextarea`

**Module**: `src/utils/textareaHighlight.ts`

### Signature
```typescript
export function scrollAndSelectInTextarea(
  textareaEl: HTMLTextAreaElement | null | undefined,
  targetText: string | null | undefined
): boolean;
```

### Preconditions
- `textareaEl`: May be `null`, `undefined`, or a mounted `HTMLTextAreaElement`.
- `targetText`: May be `null`, `undefined`, empty, or a non-empty string.

### Postconditions & Guarantees
1. **Safety**: If `textareaEl` is null/undefined or `targetText` is null/undefined/empty string, the function MUST immediately return `false` without throwing any error.
2. **Match Finding**: If `targetText` is not contained in `textareaEl.value` (`indexOf === -1`), the function MUST return `false` without changing selection or scroll position.
3. **Selection Range**: If found at index `start`:
   - `textareaEl.focus()` is called.
   - `textareaEl.setSelectionRange(start, start + targetText.length)` is called.
   - `textareaEl.selectionStart === start` and `textareaEl.selectionEnd === start + targetText.length`.
4. **Scroll Positioning**:
   - `lineCount` is calculated as the count of `\n` in `textareaEl.value.slice(0, start)`.
   - `lineHeight` is parsed via `parseFloat(window.getComputedStyle(textareaEl).lineHeight)`. If `isNaN` or `<= 0`, fallback is `(parseFloat(window.getComputedStyle(textareaEl).fontSize) || 14) * 1.5`.
   - `textareaEl.scrollTop` is set to `Math.max(0, (lineCount - 2) * lineHeight)`.
   - Returns `true`.

---

## 2. Component Contract: `UnifiedAuditPanel`

**Module**: `src/components/translator-workspace/UnifiedAuditPanel.tsx`

### Prop Extension
```typescript
activeTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
```

### Click Handling Contract
When an issue card is clicked (`handleCardClick(issue)`):
1. If `onIssueClick` callback is supplied, invoke `onIssueClick(issue)`.
2. If `issue.targetText` is defined and non-empty:
   - Call `scrollAndSelectInTextarea(activeTextareaRef?.current, issue.targetText)`.
   - If the call returns `false`:
     - Invoke `showToast({ message: 'Không tìm thấy đoạn văn này trong bản dịch hiện tại, có thể nội dung đã được sửa.', type: 'info' })`.
3. If `issue.targetText` is undefined or empty string:
   - Do not call `scrollAndSelectInTextarea`.
   - Do not show error or toast.

---

## 3. Component Contract: `BilingualEditor`

**Module**: `src/components/translator-workspace/BilingualEditor.tsx`

### Ref Contract
1. Maintain refs:
   ```typescript
   const rawTextareaRef = React.useRef<HTMLTextAreaElement>(null);
   const polishedTextareaRef = React.useRef<HTMLTextAreaElement>(null);
   ```
2. Attach `ref={rawTextareaRef}` to `<textarea id="textarea-raw-translation" ... />`.
3. Attach `ref={polishedTextareaRef}` to `<textarea id="textarea-polished-translation" ... />`.
4. Compute active ref:
   ```typescript
   const activeTextareaRef = activeStage === 'polished' ? polishedTextareaRef : rawTextareaRef;
   ```
5. Pass `activeTextareaRef={activeTextareaRef}` into `<UnifiedAuditPanel ... />`.
