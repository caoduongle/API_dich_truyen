# Implementation Plan: Upsert Chapter Save in Translator Workspace

**Branch**: `082-upsert-chapter-save` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/082-upsert-chapter-save/spec.md`

## Summary

Fix a critical defect in the single-chapter translator workspace (`useWorkspaceState.ts`) where saving an edited chapter loaded from Chapter History always created a duplicate chapter with a new ID instead of updating the existing chapter. The implementation introduces upsert semantics to `handleSaveChapter` by checking `currentChapterId` against `activeProject.chapters`, updating existing records in-place (preserving `id` and `createdAt`), binding newly created chapter IDs immediately to prevent duplicate clone creation on rapid consecutive saves, resetting `currentChapterId` on project switches and sample example loading, and adding unit test coverage.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19
**Primary Dependencies**: React 19, Lucide React, clsx, tailwind-merge
**Storage**: IndexedDB via `src/services/db.ts` / in-memory React state in `useWorkspaceState`
**Testing**: Vitest (`npm test`), TypeScript compiler (`npm run lint`), Vite build (`npm run build`)
**Target Platform**: Modern Web Browsers
**Project Type**: Single-page React Web application with Express backend
**Performance Goals**: Instant in-memory state transition (<10ms), zero unnecessary array cloning or re-renders
**Constraints**: Zero modifications to `src/types.ts` interfaces or IndexedDB schemas; zero changes to backend translation endpoints
**Scale/Scope**: 1 hook file (`src/components/translator-workspace/useWorkspaceState.ts`), 1 dedicated test file (`src/components/translator-workspace/__tests__/useWorkspaceState.test.ts`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Strict Quality Gates & Verification)**: All tasks will be verified with `npm run lint`, `npm test`, and `npm run build`.
- [x] **Principle II (Dependency Minimization & Library Reuse)**: No new npm packages added.
- [x] **Principle III (Strict Concern Separation)**: Changes are strictly localized to frontend workspace state handling; no backend/Gemini translation pipeline modifications.
- [x] **Principle IV (Immutable Core Schemas & Storage Stability)**: `src/types.ts` and IndexedDB schemas remain untouched. Vietnamese UI copy adheres strictly to user specifications.
- [x] **Principle V (Atomic Commits & Documentation Sync)**: Changes are isolated, focused, and verified.

## Project Structure

### Documentation (this feature)

```text
specs/082-upsert-chapter-save/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model & state transitions
├── quickstart.md        # Phase 1 quickstart & manual validation scenarios
├── contracts/           # Phase 1 interface contract
│   └── workspace-upsert-contract.md
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
└── components/
    └── translator-workspace/
        ├── useWorkspaceState.ts               # [MODIFY] Implement upsert logic, ID binding & reset effects
        └── __tests__/
            └── useWorkspaceState.test.ts      # [NEW] Unit tests covering save/update/reset flows
```

**Structure Decision**: Frontend workspace component state modification and dedicated test harness under `src/components/translator-workspace/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None      | N/A        | N/A                                 |
