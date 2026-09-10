# Quickstart & Verification Guide: Textarea Issue Selection & Smooth Auto-Scroll

**Feature**: `103-textarea-issue-selection`  
**Date**: 2026-09-10  
**Status**: Ready  

---

## 1. Prerequisites

- Node.js 20+ installed
- Dependencies installed (`npm install`)

---

## 2. Automated Verification Commands

### Step 1: Run Targeted Unit Tests
Run unit tests verifying string indexing, selection ranges, scroll calculations, and null safety:
```bash
npx vitest run src/utils/__tests__/textareaHighlight.test.ts
```
**Expected Outcome**: 100% tests pass.

### Step 2: Run Full Quality Gates
```bash
npm run lint    # tsc --noEmit (Must be 0 errors)
npm test        # vitest run (60+ suites, 386+ tests pass)
npm run build   # vite build + esbuild (Clean exit 0)
```

---

## 3. Visual Verification Scenarios (Live Chrome)

### Scenario A: Matching Excerpt Selection & Scroll
1. Open Translator Workspace and navigate to a chapter with text.
2. In the Polished tab, enter text with a quality defect (e.g. raw Chinese characters).
3. Wait for the audit issue card to appear in `UnifiedAuditPanel`.
4. Click on the issue card.
5. **Verify**:
   - The editor textarea gains focus.
   - The exact snippet (`targetText`) is highlighted with the browser selection blue/gold hue.
   - The textarea smoothly scrolls so the highlighted line is clearly visible below the top edge.

### Scenario B: Text Drift & Informational Feedback
1. Edit the textarea to alter or delete the words in the targeted excerpt.
2. Click the issue card in `UnifiedAuditPanel`.
3. **Verify**:
   - No crash or exception occurs.
   - Selection is not altered.
   - A soft info toast notification is displayed: *"Không tìm thấy đoạn văn này trong bản dịch hiện tại, có thể nội dung đã được sửa."*

### Scenario C: Active Tab Sensitivity
1. Switch to the Raw Translation tab (`activeStage === 'raw'`).
2. Click an issue card.
3. **Verify**:
   - The selection and scroll action targets the Raw Translation textarea.
   - Switch back to the Polished tab (`activeStage === 'polished'`); the target switches to the Polished textarea.
