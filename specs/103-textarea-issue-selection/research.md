# Technical Research: Textarea Issue Selection & Smooth Auto-Scroll

**Feature**: `103-textarea-issue-selection`  
**Date**: 2026-09-10  
**Status**: Completed  

---

## 1. Technical Decisions

### Decision 1: Text Selection via `setSelectionRange` over ContentEditable/Overlays

- **Decision**: Retain standard HTML `<textarea>` elements and use native `HTMLTextAreaElement.setSelectionRange(start, end)` combined with `element.focus()`.
- **Rationale**:
  - HTML textareas cannot render inline HTML spans or CSS background color highlights on text subsets.
  - Converting the workspace editor to `contentEditable`, CodeMirror, or Monaco would destabilize the existing real-time CRDT sync (`crdtDocManager.ts`), hotkey bindings (`useHotkeys.ts`), and Chinese character cleaning utilities (`textCleaner.ts`).
  - Native browser text selection (`::selection`) provides instant, familiar visual feedback without altering the DOM tree, layout, or state management.
- **Alternatives Considered**:
  - *Div overlay with transparent textarea*: Fragile sync between overlay font metrics, wrapping, line breaks, and scroll offsets; prone to cross-browser misalignment.
  - *Draft.js / Slate / CodeMirror*: Excessive bundle size and risk of regression against CRDT text bindings.

---

### Decision 2: Scroll Offset Estimation via `getComputedStyle` and Newline Counting

- **Decision**: Calculate target vertical scroll offset using:
  1. `textBefore = textareaEl.value.slice(0, start)`
  2. `lineCount = textBefore.split('\n').length - 1`
  3. `lineHeight = parseFloat(window.getComputedStyle(textareaEl).lineHeight)` (with fallback to `parseFloat(fontSize) * 1.5 || 21`)
  4. `targetScrollTop = Math.max(0, (lineCount - 2) * lineHeight)`
- **Rationale**:
  - Avoids hard-coding line height values that break when typography or theme zoom changes.
  - Adding a 2-line top buffer prevents the highlighted selection from docking flush against the top edge of the textarea, ensuring the user immediately sees the preceding contextual line.
  - Zero external packages required; purely uses native browser APIs (`window.getComputedStyle`, `Math.max`).
- **Alternatives Considered**:
  - *Offscreen canvas or mirror div measurement*: Unnecessary complexity for a line-based editor where text is paragraph-formatted and line-height is uniform.

---

### Decision 3: Textarea Ref Transmission from `BilingualEditor` to `UnifiedAuditPanel`

- **Decision**: In `BilingualEditor.tsx`, attach React refs to the raw and polished textareas:
  - `rawTextareaRef = useRef<HTMLTextAreaElement>(null)`
  - `polishedTextareaRef = useRef<HTMLTextAreaElement>(null)`
  - Pass `activeTextareaRef={activeStage === 'polished' ? polishedTextareaRef : rawTextareaRef}` as a prop to `UnifiedAuditPanel`.
- **Rationale**:
  - Minimal diff footprint. Does not restructure components or alter editor render cycles.
  - Ensures `UnifiedAuditPanel` always interacts with the currently visible translation textarea without querying the global DOM or hard-coding element IDs.
- **Alternatives Considered**:
  - *DOM ID query (`document.getElementById`)*: Brittle and tightly couples UI logic to specific DOM element IDs, violating React component isolation principles.

---

### Decision 4: Non-blocking Notification for Text Drift

- **Decision**: When `scrollAndSelectInTextarea` returns `false`, `UnifiedAuditPanel` invokes `showToast` from `useNotifications`:
  `"Không tìm thấy đoạn văn này trong bản dịch hiện tại, có thể nội dung đã được sửa."` (`type: 'info'`).
- **Rationale**:
  - If a user edits the text after Gemini QA or Hako scanning, the snippet may no longer exist verbatim.
  - Non-blocking toast informs the user why highlighting didn't trigger without interrupting workflow or throwing console errors.

---

## 2. Research Verification Matrix

| Area | Solution | Constraint Satisfaction |
|---|---|---|
| **Text Highlight** | `setSelectionRange(start, start + length)` | Pure `<textarea>`, browser native selection |
| **Viewport Positioning** | `scrollTop` calculation with computed line-height | Dynamic typography, no hardcoded constants |
| **Component Wiring** | `activeTextareaRef` prop passing | Pure React ref, no DOM querying |
| **Error Handling** | Graceful boolean return + info toast | Silent failure with friendly user feedback |
| **Dependencies** | 0 new packages | Constitution Principle II strictly honored |
