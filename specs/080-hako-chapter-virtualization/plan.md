# Implementation Plan: Hako Checker Chapter Virtualization & Performance Resilience

**Branch**: `080-hako-chapter-virtualization` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from [`specs/080-hako-chapter-virtualization/spec.md`](./spec.md)

## Summary

Integrate windowed list virtualization into `HakoChapterSelector` using the native `useVirtualList` hook for projects containing >20 chapters, optimize selection lookups to $O(1)$ `Set` structures, and sanitize/debounce IndexedDB persistence in `useHakoReviewSession` & `hakoSessionStore` to eliminate DOM overload, memory spikes (+11MB), and white-screen browser crashes.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19

**Primary Dependencies**: `clsx`, `tailwind-merge`, `motion`, `lucide-react` (Zero new external dependencies)

**Storage**: IndexedDB (`HakoQualityCheckerDB`, `hako_quality_sessions` store v2)

**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`), Vite Build (`npm run build`)

**Target Platform**: Modern Desktop/Mobile Web Browsers (Chrome, Edge, Firefox, Safari)

**Project Type**: Single-page React Web Application with Node.js/Express backend

**Performance Goals**:
- Chapter selection interaction response: <16ms (60 fps)
- DOM element count inside chapter list: <50 elements for 100-500+ chapters
- Main thread blocking time per click: <10ms (down from ~270ms)

**Constraints**:
- Must not add new external NPM packages (Constitution Principle II)
- Must not alter `src/types.ts` core schema or `ZHONG_VIET_TRANSLATOR_DB` storage (Constitution Principle IV)
- Must maintain 100% test coverage with zero skipped or muted tests (Constitution Principle I)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **Principle I (Strict Quality Gates & Verification)**: PASS. All changes verified by `npm run lint`, `npm test` (664 tests), and `npm run build`.
- **Principle II (Dependency Minimization & Existing Library Reuse)**: PASS. Reuses existing native hook `src/hooks/useVirtualList.ts`.
- **Principle III (Strict Concern Separation & Domain Boundary)**: PASS. Changes are isolated to UI and session store in `src/components/hako-checker/` and `src/hooks/useHakoReviewSession.ts`.
- **Principle IV (Immutable Core Schemas & Storage Stability)**: PASS. Core `StoryProject` schemas and translation tables untouched.
- **Principle V (Atomic Commits & Sync)**: PASS. Single focused feature branch.

## Project Structure

### Documentation (this feature)

```text
specs/080-hako-chapter-virtualization/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── hako-virtual-selector.contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── hako-checker/
│       ├── HakoChapterSelector.tsx    # Add useVirtualList windowing & Set O(1) lookups
│       └── HakoCheckerWorkspace.tsx   # Ensure defensive data propagation & error boundary
├── hooks/
│   ├── useVirtualList.ts              # Existing native virtualization hook
│   ├── useHakoReviewSession.ts        # Optimized debounced persistence & sanitized updates
│   └── __tests__/
│       └── useHakoReviewSession.test.ts # Unit tests for high-volume chapter lists & virtualization
└── services/
    └── hakoSessionStore.ts            # Sanitization verification for IndexedDB payload
```

## Complexity Tracking

*No violations. All design requirements comply with the Constitution.*
