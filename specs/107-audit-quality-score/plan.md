# Implementation Plan: Translation Quality Audit Score (0-100)

**Branch**: `107-audit-quality-score` | **Date**: 2026-09-11 | **Spec**: `specs/107-audit-quality-score/spec.md`

**Input**: Feature specification from `specs/107-audit-quality-score/spec.md`

## Summary

Design and implement a deterministic translation quality audit score (0–100) calculated from pending audit issues in `auditBridgeService.ts`, and display it as a minimalist metric (number + qualitative tier badge + advisory tooltip) in the header of `UnifiedAuditPanel.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 20+

**Primary Dependencies**: React 19, Tailwind CSS v4, Lucide React (`lucide-react`), Motion (`motion`), `clsx`, `tailwind-merge`

**Storage**: In-memory derivation via React `useMemo` from `UnifiedAuditIssue[]`; no schema or database changes required.

**Testing**: Vitest (`npx vitest run`)

**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari)

**Project Type**: Web Application (React + Vite + Tailwind v4)

**Performance Goals**: Pure calculation latency < 1ms; UI reactivity < 16ms (instant rerender upon issue resolution).

**Constraints**:
- Strictly limited to `src/services/auditBridgeService.ts` and `src/components/translator-workspace/UnifiedAuditPanel.tsx` (plus unit tests).
- No new external packages.
- No heavy canvas/SVG gauges or charts; minimalist design compliant with `.agents/rules/design-system.md`.
- Explicit advisory tooltip noting that this is an estimate based on unaddressed issues, not an absolute evaluation.

**Scale/Scope**: 2 files modified in application code, 1-2 test suites updated.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Strict Quality Gates & Verification**: `tsc --noEmit`, `vitest run`, and `vite build` will be executed and verified before concluding.
- [x] **Dependency Minimization & Existing Library Reuse**: Reuses existing `Badge` and `Seal` UI components; no extra libraries added.
- [x] **Strict Concern Separation & Domain Boundary Preservation**: Pure utility calculation placed in `auditBridgeService.ts`; presentation placed in `UnifiedAuditPanel.tsx`; no changes to translation pipelines or backend endpoints.
- [x] **Immutable Core Schemas & Storage Stability**: No changes to `src/types.ts` or IndexedDB schemas.
- [x] **Atomic Commits & Documentation Synchronization**: Scoped strictly to Feature 107.

## Project Structure

### Documentation (this feature)

```text
specs/107-audit-quality-score/
├── spec.md
├── checklists/
│   └── requirements.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── audit-score.contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── auditBridgeService.ts               # calculateAuditScore, getAuditScoreTier
│   └── __tests__/
│       └── auditBridgeService.test.ts      # Unit tests for scoring & tier helpers
└── components/
    └── translator-workspace/
        ├── UnifiedAuditPanel.tsx           # Score + Tier Badge + Tooltip rendering
        └── __tests__/
            └── UnifiedAuditPanel.test.tsx  # Component test verifying reactive display
```

**Structure Decision**: Monorepo React frontend structure under `src/services/` and `src/components/translator-workspace/`.

## Complexity Tracking

*No violations detected. Standard minimalist extension of existing audit panel and bridge service.*
