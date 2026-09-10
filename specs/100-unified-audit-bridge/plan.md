# Implementation Plan: Unified Audit Issue Types & Bridge Service

**Branch**: `100-unified-audit-bridge` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/100-unified-audit-bridge/spec.md`

## Summary

Create a unified audit defect type system in `src/types/audit.ts` (`IssueSource`, `UnifiedSeverity`, `UnifiedAuditIssue`, and explicit severity translation tables) and pure normalization bridge functions in `src/services/auditBridgeService.ts` (`mapHakoIssueToUnified`, `mapQaIssueToUnified`). Accompany the implementation with a comprehensive unit test suite in `src/services/__tests__/auditBridgeService.test.ts`. This unifies disparate defect representations from Hako Engine rules and Gemini QA Critique, laying the required structural foundation for upcoming Track B issue review and correction panels.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 20+  
**Primary Dependencies**: None (Zero new dependencies)  
**Storage**: N/A (In-memory pure transformation services)  
**Testing**: Vitest (`npm test`), TypeScript checking (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Universal (Browser client & Node.js environment)  
**Project Type**: TypeScript types & service layer  
**Performance Goals**: Instantaneous synchronous pure function execution (<0.01ms)  
**Constraints**: Pure functions only (no network/db calls); only create the 2 new files and test file; no modifications to existing application components; no new dependencies  
**Scale/Scope**: 2 new source files (`src/types/audit.ts`, `src/services/auditBridgeService.ts`) and 1 new test file (`src/services/__tests__/auditBridgeService.test.ts`)  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` MUST pass without error. (STATUS: PASS)
- **Principle II: Dependency Minimization & Existing Library Reuse**: 0 new packages added. (STATUS: PASS)
- **Principle III: Strict Concern Separation & Domain Boundary Preservation**: Pure domain bridge. Does not modify backend routes, translation pipelines, or existing UI components. (STATUS: PASS)
- **Principle IV: Immutable Core Schemas & Storage Stability**: Core `src/types.ts` and IndexedDB schemas are not modified. New audit types reside cleanly in `src/types/audit.ts`. (STATUS: PASS)
- **Principle V: Atomic Commits & Documentation Synchronization**: Tightly bounded and verified in isolation. (STATUS: PASS)

Gate status: **PASSED (Zero violations)**

## Project Structure

### Documentation (this feature)

```text
specs/100-unified-audit-bridge/
├── plan.md              # This implementation plan
├── research.md          # Research findings & design decisions
├── data-model.md        # Unified data model & severity tables
├── quickstart.md        # Verification commands & scenarios
├── contracts/
│   └── audit-bridge.contract.md # Service function contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
├── spec.md              # Feature specification
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── audit.ts                             # [NEW] IssueSource, UnifiedSeverity, UnifiedAuditIssue, severity maps
└── services/
    ├── auditBridgeService.ts                # [NEW] mapHakoIssueToUnified, mapQaIssueToUnified
    └── __tests__/
        └── auditBridgeService.test.ts       # [NEW] Full unit test coverage for bridge functions
```

**Structure Decision**: Add lightweight domain types in `src/types/audit.ts` and pure bridge transformation logic in `src/services/auditBridgeService.ts`. No existing files are modified.

## Complexity Tracking

*No violations. All principles and constraints cleanly satisfied.*
