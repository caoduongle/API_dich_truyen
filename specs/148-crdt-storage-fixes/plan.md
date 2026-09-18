# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Fix 4 remaining CRDT storage vulnerabilities (orphan CRDT states in `atomicSaveProjectBundle`, fail-open in `deleteChapterFromDB`, lack of canonical project guard in `getCrdtState`) and clean up repository hygiene (removing one-off scripts, fixing task contradictions).

## Technical Context

**Language/Version**: TypeScript
**Primary Dependencies**: React 19, Vite
**Storage**: IndexedDB
**Testing**: Vitest
**Target Platform**: Web SPA
**Project Type**: Web Application
**Performance Goals**: N/A
**Constraints**: Pure Client-Side Architecture, strict MVC separation
**Scale/Scope**: Local state management

## Constitution Check

*GATE: Passed*
- **Principle I (Quality Gates)**: Will ensure `npm run lint` and `npm test` pass before marking complete.
- **Principle II (Dependency Minimization)**: No new dependencies needed.
- **Principle III (MVC Boundaries)**: Changes isolated strictly to `src/services/db.ts` and its callers.
- **Principle IV (Immutable Core Schemas)**: No schema changes, only runtime logic constraints.
- **Principle V (Atomic Commits)**: Fixes are self-contained.

## Project Structure

### Documentation (this feature)

```text
specs/148-crdt-storage-fixes/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
└── services/
    └── db.ts
    └── google-drive/
```

**Structure Decision**: Standard SPA structure. Modifying existing database and sync services.

## Complexity Tracking

No violations to justify.
