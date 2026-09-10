# Implementation Plan: Workspace Audit Scanners & QA Critique Decoupling

**Branch**: `101-workspace-audit-scanners` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/101-workspace-audit-scanners/spec.md`

## Summary

Decouple automatic `qaCritiqueDirect` invocation from `handlePolishTranslation()` in `useWorkspaceState.ts`. Replace it with an explicit on-demand async handler `handleRunAiQaCritique()`. Add `hakoIssues` state along with `handleRunHakoScan()` executing `runHeuristicQualityScan` on the active chapter's polished translation, automatically triggered via a 500ms debounce on `polishedTranslation` changes. Export `hakoIssues`, `handleRunAiQaCritique`, and `handleRunHakoScan` from `useWorkspaceState`. Add comprehensive unit test coverage in `src/components/translator-workspace/__tests__/useWorkspaceState.test.ts`.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Vite  
**Primary Dependencies**: None (Zero new dependencies)  
**Storage**: N/A (In-memory React hook state)  
**Testing**: Vitest (`npm test`), TypeScript checking (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Web browser (React client)  
**Project Type**: React custom hook logic (`useWorkspaceState.ts`)  
**Performance Goals**: Instantaneous synchronous heuristic scan (<5ms); 500ms debounce to prevent input lag during typing  
**Constraints**: Only modify `src/components/translator-workspace/useWorkspaceState.ts` and its test suite; preserve CRDT synchronization and non-QA polish steps; do not touch UI components in this prompt  
**Scale/Scope**: 1 existing application file (`useWorkspaceState.ts`) and 1 test file (`useWorkspaceState.test.ts`)  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` MUST pass without error. (STATUS: PASS)
- **Principle II: Dependency Minimization & Existing Library Reuse**: 0 new packages added. (STATUS: PASS)
- **Principle III: Strict Concern Separation & Domain Boundary Preservation**: Scoped exclusively to hook state/actions in `useWorkspaceState.ts`. UI components untouched. Backend untouched. (STATUS: PASS)
- **Principle IV: Immutable Core Schemas & Storage Stability**: Core `src/types.ts` and IndexedDB schemas are not modified. (STATUS: PASS)
- **Principle V: Atomic Commits & Documentation Synchronization**: Tightly bounded and verified in isolation. (STATUS: PASS)

Gate status: **PASSED (Zero violations)**

## Project Structure

### Documentation (this feature)

```text
specs/101-workspace-audit-scanners/
├── plan.md              # This implementation plan
├── research.md          # Research findings & design decisions
├── data-model.md        # State definitions & trigger mappings
├── quickstart.md        # Verification commands & test scenarios
├── contracts/
│   └── workspace-scanners.contract.md # Hook return contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
├── spec.md              # Feature specification
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
└── components/
    └── translator-workspace/
        ├── useWorkspaceState.ts             # [MODIFY] Decouple QA auto-call, add handleRunAiQaCritique & handleRunHakoScan
        └── __tests__/
            └── useWorkspaceState.test.ts    # [MODIFY] Add tests for decoupled polish, manual QA, and heuristic scan
```

**Structure Decision**: Modifications strictly contained to `useWorkspaceState.ts` and its test file.

## Complexity Tracking

*No violations. All principles and constraints cleanly satisfied.*
