# Implementation Plan: Issue Review Panel Pagination

**Branch**: `096-issue-review-pagination` | **Date**: 2026-09-10 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/096-issue-review-pagination/spec.md)

**Input**: Feature specification from `specs/096-issue-review-pagination/spec.md`

## Summary

In `src/components/hako-checker/HakoIssueReviewPanel.tsx`, all filtered issues are currently rendered at once. In large inspections (12 chapters, 50–100+ issues), this creates an unpaginated tree of heavy, variable-height cards (~16KB per card) that causes scroll jank on low-spec devices. Fixed-height virtualization (`useVirtualList`) cannot be used because card heights vary dynamically based on content length, raw Chinese snippets, and note textareas.

This plan implements client-side pagination with 20 issues per page, a bottom navigation bar with "Trang trước" / "Trang sau" / "Trang X/Y" using the existing `Button` component, automatic page resetting/clamping when filters change or items shrink, and preserves batch actions across the entire filtered set.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19  
**Primary Dependencies**: React 19, Lucide React (`ChevronLeft`, `ChevronRight`)  
**Storage**: None (in-memory presentation state)  
**Testing**: Vitest (`npm test`), manual verification  
**Target Platform**: Browser / Client-side React Web App  
**Project Type**: React UI component  
**Performance Goals**: Max 20 card DOM nodes mounted at any time, instant page switching (< 16ms) without layout jank on variable-height cards  
**Constraints**:
- Strictly limited to `src/components/hako-checker/HakoIssueReviewPanel.tsx`.
- Do NOT use `useVirtualList` or hardcoded height virtual scrolling.
- Do NOT alter `HakoIssueCard.tsx`.
- "Duyệt nhanh tất cả" / "Bỏ qua tất cả" must continue to apply to ALL `filteredIssues`, not just the current page.
- Comply strictly with `.agents/rules/design-system.md` (`rounded-[2px]`, `rounded-md`, design tokens, no new dependencies).
- Pass quality gates (`npm run lint`, `npm test`, `npm run build`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Verification |
| :--- | :--- | :---: | :--- |
| **I. Strict Quality Gates & Verification** | `npm run lint`, `npm test`, `npm run build` must pass cleanly without skipped tests. | **PASS** | Automated test suite passes; type-check and build succeed. |
| **II. Dependency Minimization** | No new NPM packages added. | **PASS** | Standard React hooks and existing `Button` component. |
| **III. Strict Concern Separation** | UI changes strictly isolated to `HakoIssueReviewPanel.tsx`. | **PASS** | Bounded to 1 file. |
| **IV. Immutable Core Schemas** | No changes to `src/types.ts` or database schemas. | **PASS** | 100% compliant. |
| **V. Atomic Commits & Sync** | Minimal, reviewable diff. | **PASS** | Targeted edits. |

## Project Structure

### Documentation (this feature)

```text
specs/096-issue-review-pagination/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical decisions (pagination vs virtualization)
├── data-model.md        # State architecture & mutation flow
├── contracts/           # Component boundaries & invariants
│   └── pagination.contract.md
├── quickstart.md        # Verification walkthrough
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
└── components/
    └── hako-checker/
        └── HakoIssueReviewPanel.tsx  # [MODIFY] Add currentPage state, 20-item slice, and navigation controls
```

## Complexity Tracking

*No violations. All principles pass cleanly.*
