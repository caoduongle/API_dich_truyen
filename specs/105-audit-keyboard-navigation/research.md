# Technical Research: Keyboard Navigation and Quick Execution for Audit Issues

**Feature Branch**: `105-audit-keyboard-navigation`  
**Date**: 2026-09-11  
**Status**: Completed  

---

## 1. Architectural Context & Hook Analysis

In the workspace, translators review chapters through the `BilingualEditor` and inspect quality findings in `UnifiedAuditPanel`.
Currently:
1. `src/hooks/useHotkeys.ts` registers global keydown listeners on `window` via `useEffect`.
2. It accepts options `{ enableOnFormTags?: boolean; preventDefault?: boolean; enabled?: boolean }`.
3. `enableOnFormTags` defaults to `true`. When set to `false`, it automatically ignores keydown events whose target is `INPUT`, `TEXTAREA`, or `SELECT`.
4. The hook cleans up event listeners on unmount.

---

## 2. Decision 1: Placement of Hotkey Registration

- **Decision**: Implement `focusedIssueIndex`, `useHotkeys('alt+j')`, `useHotkeys('alt+k')`, and `useHotkeys('enter')` directly in `UnifiedAuditPanel.tsx`.
- **Rationale**:
  - `UnifiedAuditPanel` owns the filtered list `filteredIssues`, the active filter tab `activeTab`, and the individual issue card DOM elements.
  - Putting hotkeys directly in `UnifiedAuditPanel` avoids leaking audit-internal navigation state into `BilingualEditor`.
  - Because `useHotkeys` attaches to `window`, as long as `UnifiedAuditPanel` is mounted (which is always the case when the workspace is active), the shortcuts respond immediately.
  - When `UnifiedAuditPanel` unmounts, the listeners are cleanly removed.
- **Alternatives Considered**:
  - *Registering in `BilingualEditor.tsx`*: Rejected because `BilingualEditor` would need to duplicate `filteredIssues` calculation and track audit-specific card refs, needlessly coupling editor logic with panel layout.

---

## 3. Decision 2: Bounded Navigation Clamping & State Synchronization

- **Decision**:
  - Maintain `focusedIssueIndex` state (`number`). Default to `0` when `filteredIssues.length > 0`, and `-1` when `filteredIssues.length === 0`.
  - On `Alt+J`: `setFocusedIssueIndex(prev => Math.min(prev + 1, filteredIssues.length - 1))`.
  - On `Alt+K`: `setFocusedIssueIndex(prev => Math.max(prev - 1, 0))`.
  - When `activeTab` changes or `filteredIssues` shrinks: clamp `focusedIssueIndex` using an effect:
    ```typescript
    useEffect(() => {
      if (filteredIssues.length === 0) {
        setFocusedIssueIndex(-1);
      } else {
        setFocusedIssueIndex((prev) => Math.max(0, Math.min(prev, filteredIssues.length - 1)));
      }
    }, [filteredIssues.length, activeTab]);
    ```
- **Rationale**: Completely prevents array index out-of-bounds errors when toggling filter tabs or applying fixes that remove items from the `'pending'` tab.
- **Alternatives Considered**:
  - *Wrap-around navigation (from last to first)*: Rejected because accidental wrap-around causes jarring jumps during linear review of errors. Linear clamping is the standard convention for list triage.

---

## 4. Decision 3: Strict Collision Prevention for Enter Key

- **Decision**:
  - Register `useHotkeys('enter', handleEnterKey, { enableOnFormTags: false })`.
  - In addition, in `handleEnterKey`, verify:
    ```typescript
    const activeEl = document.activeElement;
    const isFormElement =
      activeEl &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
        activeEl.getAttribute('contenteditable') === 'true');
    if (isFormElement) return;
    ```
  - Only execute if `focusedIssueIndex >= 0 && focusedIssueIndex < filteredIssues.length`.
  - Action routing:
    - If `focusedIssue.autoFixable && focusedIssue.suggestion && focusedIssue.status !== 'resolved' && onApplyFix`: invoke `handleQuickFix(dummyEvent, focusedIssue)`.
    - Else: invoke `handleIssueCardClick(focusedIssue)` which runs `handleAuditIssueSelection` to scroll and select the snippet in the translation textarea.
- **Rationale**: The user must NEVER lose the ability to press Enter for newlines while editing chapter text in the textarea. Double guarding with both `enableOnFormTags: false` and `document.activeElement` guarantees zero conflict.
- **Alternatives Considered**:
  - *Requiring focus to be inside the audit card container*: Overly restrictive; translators prefer pressing Alt+J then Enter without needing to click the card with a mouse first.

---

## 5. Decision 4: Smooth Auto-Scrolling into View

- **Decision**:
  - Maintain an array/map of refs for the rendered issue cards: `cardRefs = useRef<(HTMLDivElement | null)[]>([])`.
  - When `focusedIssueIndex` changes, execute:
    ```typescript
    const el = cardRefs.current[focusedIssueIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    ```
- **Rationale**: Keeps the focused card visible even if the audit list contains 20+ issues and scrolls within its `max-h-80 overflow-y-auto` container.

---

## 6. Decision 5: Design System Compliant Visual Feedback

- **Decision**:
  - When an issue card is focused (`index === focusedIssueIndex`):
    Apply `ring-1 ring-polish/60 bg-parchment-2/40 border-polish/50`.
  - Strictly adhere to `design-system.md`: No arbitrary drop shadows, no neon outlines, no rounded-full, and retain standard `rounded-[2px]` and cinnabar accent token (`text-polish` / `border-polish`).
