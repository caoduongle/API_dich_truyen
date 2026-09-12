# Quickstart Guide: Testing Polish Truncation Prevention & 1:1 Paragraph Parity

**Feature**: `125-polish-structure-parity-guard`
**Date**: 2026-09-13

## 1. Prerequisites
- Node.js $\ge 18$
- Repository root: `e:\tailieuhoctap\laptrinhnangcao\th\merged`
- All dependencies installed (`npm install`)

---

## 2. Automated Unit Tests

### Test Suite 1: Text Integrity & Parity Utilities (`src/lib/__tests__/text.test.ts`)
Run the test suite verifying `validatePolishIntegrity`, `countParagraphs`, and `validateParagraphParity`:
```powershell
npm test -- src/lib/__tests__/text.test.ts
```
**Expected Outcome**:
- `countParagraphs`: Correctly counts multi-line text blocks ignoring empty lines.
- `validatePolishIntegrity`: Throws `POLISH_TRUNCATION_DETECTED` when polished text length $< 80\%$ of raw text (on raw text $\ge 300$ chars) or paragraph count $< 75\%$. Passes when polished text length is within normal range ($85\% - 120\%$).
- `validateParagraphParity`: Throws `PARAGRAPH_STRUCTURE_DIVERGENCE` when paragraph count diverges by $> 20\%$ on $\ge 5$ paragraphs.

### Test Suite 2: Polish Pre-Split & Adaptive Retry (`src/services/__tests__/directTranslationEngine.test.ts`)
Run the translation engine tests verifying that Stage 2 pre-splits long chapters and automatically recovers from truncated LLM responses:
```powershell
npm test -- src/services/__tests__/directTranslationEngine.test.ts
```
**Expected Outcome**:
- Calls to `polishTranslationDirect` with long texts ($> 1800$ tokens) automatically trigger pre-split into synchronized sub-chunks.
- When a mock Gemini call returns truncated text (40% length), `isAdaptiveSplitRetryableError` identifies `POLISH_TRUNCATION_DETECTED`, triggers Divide & Conquer, and recovers complete content.

---

## 3. Full Quality Assurance Gate

Run the standard project quality verification:
```powershell
npm run lint
npm test
npm run build
```
**Expected Outcome**: Zero type errors, 100% test pass rate, successful Vite build.
