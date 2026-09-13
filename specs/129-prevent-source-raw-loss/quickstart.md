# Quickstart Validation Guide: Data Preservation

**Feature**: `129-prevent-source-raw-loss`  
**Date**: 2026-09-13

## Purpose
This guide outlines runnable verification scenarios to validate that the original Chinese source text (`sourceText`) and preliminary raw translation draft (`rawTranslation`) remain 100% intact across translation, polishing, live editing, auto-save, and quality audit workflows.

---

## Prerequisites
- Node.js environment installed.
- Local repository built and running:
  ```bash
  npm install
  npm run build
  npm test
  ```

---

## Scenario 1: Automated Unit & Integration Tests

Execute the test suites covering database safeguards, CRDT auto-save preservation, and workspace translation dispatch:

```bash
npm test src/services/__tests__/dbSafeguard.test.ts
npm test src/hooks/__tests__/useChapterCRDTPreservation.test.ts
npm test src/hooks/__tests__/useWorkspaceState.test.ts
```

**Expected Result**:
- All tests pass without failure.
- Auto-save events and merge routines prove that non-empty `sourceText` and `rawTranslation` are preserved even when the update snapshot lacks those fields.

---

## Scenario 2: End-to-End Workspace Translation & Audit Workflow

1. Start development server:
   ```bash
   npm run dev
   ```
2. Open the application in browser (e.g. `http://localhost:5173`).
3. Select an existing project (or create a test project with 1 chapter containing Chinese source text).
4. Navigate to **Dịch Thuật** (Translator Workspace):
   - Select the chapter from the dropdown list.
   - Click **Dịch thô (Giai đoạn 1)**. Verify raw translation appears.
   - Click **Chuốt văn (Giai đoạn 2)**. Verify polished literary translation appears.
5. In the **Kiểm Định** panel (Unified Audit Panel or Hako Checker):
   - Select an issue and click **Sửa ngay** (Apply Fix).
   - Alternatively, type several edits into the polished translation editor.
   - Wait 1-2 seconds for debounced auto-save to complete.
6. Navigate to **Lịch Sử** (Chapter History):
   - Click on the tested chapter.
   - Verify the 3 tabs:
     - **Bản gốc**: Active and shows complete original Chinese text (NOT marked with `(trống)`).
     - **Dịch thô**: Active and shows complete raw translation (NOT marked with `(trống)`).
     - **Dịch biên tập**: Active and shows the edited polished translation.

---

## Scenario 3: Missing Source Text Replenish Recovery

1. Open Chapter History for any chapter that currently has missing source text (displaying `Bản gốc (trống)`).
2. Click **Bổ sung / Khôi phục bản gốc**.
3. Paste the original Chinese text into the recovery prompt and confirm.
4. Verify that:
   - The chapter's `sourceText` is restored.
   - Existing polished translation remains intact.
   - No data from either version is lost.
