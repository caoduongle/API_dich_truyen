# Implementation Plan: Unified Audit Panel for Translator Workspace

**Branch**: `102-unified-audit-panel` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/102-unified-audit-panel/spec.md`

## Summary

Consolidate the dual quality issue systems (`hakoIssues` from heuristic scanning and `qaIssues` from AI QA critique) into a single, cohesive, interactive workspace panel: `UnifiedAuditPanel.tsx`. Replace the legacy, non-interactive `QaCritiquePanel.tsx`. Implement on-demand AI review via "Chạy AI Thẩm định", 4 filter tabs with dynamic counts, compact sidebar cards adhering to the "Mực & Chu Sa" design system, and the 3 mandatory UX states (Loading via Skeleton, Empty via EmptyState, Error with retry). Wire `UnifiedAuditPanel` into `BilingualEditor.tsx` and `TranslatorWorkspace.tsx`, and delete `QaCritiquePanel.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Vite  
**Primary Dependencies**: React 19, `lucide-react`, `clsx`, `tailwind-merge` (Zero new dependencies)  
**Storage**: N/A (In-memory React component props & local state)  
**Testing**: Vitest (`npm test`), TypeScript type checking (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Web browser (Desktop / Mobile responsive workspace)  
**Project Type**: React UI component & workspace integration  
**Performance Goals**: Instant tab switching (<5ms); sub-millisecond mapping via `useMemo`; smooth loading transitions  
**Constraints**:
- Strictly follow `.agents/rules/design-system.md` (Ink & Cinnabar tokens, `rounded-[2px]`/`rounded-md`, no platform emojis, no multi-color gradients, internal `z-10` only).
- Do not modify `useWorkspaceState.ts` logic.
- Replace all occurrences of `QaCritiquePanel` and delete `QaCritiquePanel.tsx`.
- All quality gates (`npm run lint`, `npm test`, `npm run build`) MUST pass cleanly.  
**Scale/Scope**: 1 new component (`UnifiedAuditPanel.tsx`), 1 deleted component (`QaCritiquePanel.tsx`), 2 updated workspace components (`BilingualEditor.tsx`, `TranslatorWorkspace.tsx`), 1 new test file (`UnifiedAuditPanel.test.tsx`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` MUST pass cleanly without error. (STATUS: PASS)
- **Principle II: Dependency Minimization & Existing Library Reuse**: 0 new packages. Reusing existing `Button`, `Badge`, `EmptyState`, `Skeleton`, `Seal`, and `cn`. (STATUS: PASS)
- **Principle III: Strict Concern Separation & Domain Boundary Preservation**: Scoped exclusively to UI presentation in `translator-workspace/`. Backend and translation pipelines untouched. (STATUS: PASS)
- **Principle IV: Immutable Core Schemas & Storage Stability**: Core `types.ts` and IndexedDB schemas are not modified. (STATUS: PASS)
- **Principle V: Atomic Commits & Documentation Synchronization**: Scoped strictly to Feature 102 deliverables. (STATUS: PASS)

Gate status: **PASSED (Zero violations)**

## Project Structure

### Documentation (this feature)

```text
specs/102-unified-audit-panel/
├── plan.md              # This implementation plan
├── research.md          # Technical research & design decisions
├── data-model.md        # State definitions, token mappings, interfaces
├── quickstart.md        # Verification guide & visual test scenarios
├── contracts/
│   └── unified-audit-panel.contract.md # Component interface contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
├── spec.md              # Feature specification
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
└── components/
    ├── TranslatorWorkspace.tsx                  # [MODIFY] Pass hakoIssues and onRunAiQaCritique to BilingualEditor
    └── translator-workspace/
        ├── UnifiedAuditPanel.tsx                # [NEW] Consolidated audit panel component
        ├── QaCritiquePanel.tsx                  # [DELETE] Legacy critique panel removed
        ├── BilingualEditor.tsx                  # [MODIFY] Import and render UnifiedAuditPanel
        └── __tests__/
            └── UnifiedAuditPanel.test.tsx       # [NEW] Unit tests for UnifiedAuditPanel
```

**Structure Decision**: Clean swap of `QaCritiquePanel` with `UnifiedAuditPanel` within `src/components/translator-workspace/`.

## Complexity Tracking

*No violations. All architectural principles and constraints cleanly satisfied.*
