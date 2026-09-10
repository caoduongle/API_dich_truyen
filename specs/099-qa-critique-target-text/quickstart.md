# Quickstart: QA Critique Target Text Locating Field

## Prerequisites

- Node.js 20+
- All dependencies installed (`node_modules/` populated)

## Validation Commands

### 1. Type Check & Compiler Validation
```bash
npm run lint
```
**Expected Outcome**: Clean exit with code 0. Zero TypeScript diagnostic errors in `shared/prompts.ts`, `src/services/directTranslationEngine.ts`, `src/components/translator-workspace/QaCritiquePanel.tsx`, `BilingualEditor.tsx`, or `useWorkspaceState.ts`.

### 2. Automated Test Suite Execution
```bash
npm test
```
**Expected Outcome**: All Vitest test suites pass, specifically:
- `shared/__tests__/sharedTranslationLogic.test.ts` (verifies `buildQaCritiquePayload` schema and instruction).
- `src/services/__tests__/directTranslationEngine.test.ts` (verifies `qaCritiqueDirect` return structure and type compatibility).

### 3. Production Build Validation
```bash
npm run build
```
**Expected Outcome**: Vite frontend build and esbuild server bundle complete cleanly without warnings or errors.

## Manual Sanity Check

Run dev server:
```bash
npm run dev
```
Open workspace in browser, enable AI QA Critique in workspace settings, perform a test polish on a chapter, and observe that QA Critique execution proceeds without any console errors or type discrepancies.
