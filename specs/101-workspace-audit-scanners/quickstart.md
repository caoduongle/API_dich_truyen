# Quickstart: Workspace Audit Scanners & QA Critique Decoupling

## Prerequisites

- Node.js 20+
- All dependencies installed

## Validation Commands

### 1. Compile & Type Check
```bash
npm run lint
```
**Expected Outcome**: Clean exit with code 0. TypeScript compiles `src/components/translator-workspace/useWorkspaceState.ts` and test files with zero errors.

### 2. Run Workspace State Unit Tests
```bash
npx vitest run src/components/translator-workspace/__tests__/useWorkspaceState.test.ts
```
**Expected Outcome**: All tests pass, validating:
- `saveOrUpdateChapter` logic remains intact.
- `handlePolishTranslation` does not trigger `qaCritiqueDirect`.
- `handleRunAiQaCritique` triggers `qaCritiqueDirect` and updates `qaIssues`.
- `handleRunHakoScan` runs heuristic scan and updates `hakoIssues`.

### 3. Full Test Suite & Production Build
```bash
npm test
npm run build
```
**Expected Outcome**: All tests pass; frontend and server build successfully.
