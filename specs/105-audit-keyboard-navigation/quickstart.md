# Quickstart Guide: Audit Keyboard Navigation

**Feature**: `105-audit-keyboard-navigation`

## Overview

This guide verifies keyboard navigation through audit issues and primary action execution via `Alt+J`, `Alt+K`, and `Enter`.

---

## Scenario 1: Navigating Issues with Alt+J and Alt+K

### Setup
1. Open the Translator Workspace with a chapter having at least 3 audit issues in the `UnifiedAuditPanel`.
2. Ensure the panel displays the issues in the card list.

### Execution
1. Press `Alt+J`:
   - Focus advances to the next card.
   - The card highlights with a subtle cinnabar ring (`ring-1 ring-polish/60`).
   - The card smoothly scrolls into view if not already visible.
2. Press `Alt+J` repeatedly until reaching the last issue:
   - Verify focus stops at the last issue and does not overflow or crash.
3. Press `Alt+K`:
   - Focus moves backward towards the first issue.
4. Press `Alt+K` at the first issue (index 0):
   - Verify focus remains at index 0 and does not wrap around or underflow.

---

## Scenario 2: Executing Primary Action with Enter

### Execution (Auto-Fixable Issue)
1. Navigate with `Alt+J` to an issue marked "Có thể sửa nhanh" (e.g. `raw_leak`).
2. Without clicking inside the text editor, press `Enter`:
   - The auto-fix is executed immediately.
   - The issue badge changes to "Đã sửa".
   - The translation text in the editor updates.

### Execution (Non-Fixable Issue)
1. Navigate with `Alt+J` to an issue that is NOT auto-fixable (e.g. general critique).
2. Press `Enter`:
   - The issue snippet (`targetText`) is highlighted and selected in the active translation textarea.
   - The editor does not modify the text automatically.

### Conflict Prevention (Typing in Textarea)
1. Click inside the translation textarea and type text.
2. Press `Enter`:
   - A normal newline is inserted.
   - No audit action is triggered.

---

## Automated Verification

```bash
# Type check
npm run lint

# Unit tests
npm test

# Build check
npm run build
```
