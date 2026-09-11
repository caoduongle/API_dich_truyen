# Interface Contract: Audit Keyboard Navigation

**Feature Branch**: `105-audit-keyboard-navigation`  
**Date**: 2026-09-11  

---

## 1. Hotkey Registration Contract

| Key Combination | Pre-Condition | Action | Target / Side Effect |
| :--- | :--- | :--- | :--- |
| `Alt+J` | Panel mounted, `filteredIssues.length > 0` | Advance `focusedIssueIndex` by 1 (clamped at `length - 1`) | Updates active card highlight, calls `el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })` |
| `Alt+K` | Panel mounted, `filteredIssues.length > 0` | Decrease `focusedIssueIndex` by 1 (clamped at `0`) | Updates active card highlight, calls `el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })` |
| `Enter` | `focusedIssueIndex >= 0`, activeElement NOT `INPUT`/`TEXTAREA`/`SELECT` | Execute primary action of focused issue | If `autoFixable`: call `onApplyFix(issue)`<br/>If not: call `handleAuditIssueSelection(issue)` |

---

## 2. Component Visual Contract

The focused card MUST include the following CSS classes:
- Standard card styling: `group bg-parchment/60 hover:bg-parchment border border-parchment-2 rounded-[2px] p-2.5 ...`
- Active focused card styling: `ring-1 ring-polish/60 bg-parchment-2/40 border-polish/50`
- Zero non-standard box-shadow or high-contrast neon borders.

---

## 3. Pure Helpers Contract

```typescript
export function getNextIssueIndex(currentIndex: number, totalIssues: number): number;
export function getPrevIssueIndex(currentIndex: number, totalIssues: number): number;
export function canTriggerAuditEnterAction(targetElement: Element | null): boolean;
```
