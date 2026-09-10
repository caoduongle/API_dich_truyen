# Quickstart: Unified Audit Issue Types & Bridge Service

## Prerequisites

- Node.js 20+
- All dependencies installed

## Validation Commands

### 1. Compile & Type Check
```bash
npm run lint
```
**Expected Outcome**: Clean exit with code 0. TypeScript compiles `src/types/audit.ts`, `src/services/auditBridgeService.ts`, and `src/services/__tests__/auditBridgeService.test.ts` without errors.

### 2. Unit Test Suite
```bash
npx vitest run src/services/__tests__/auditBridgeService.test.ts
```
**Expected Outcome**: All test suites in `auditBridgeService.test.ts` pass, testing:
- Severity mapping tables and functions (Hako & QA).
- `mapHakoIssueToUnified` fields, decision-to-status mapping, and `autoFixable` category branching.
- `mapQaIssueToUnified` fields, `targetText` preservation, and default `pending`/`autoFixable: false` values.

### 3. Full Suite & Build Validation
```bash
npm test
npm run build
```
**Expected Outcome**: 100% of existing tests continue to pass; production frontend and server build succeed cleanly.
