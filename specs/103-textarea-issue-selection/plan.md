# Implementation Plan: Textarea Issue Selection & Smooth Auto-Scroll

**Branch**: `103-textarea-issue-selection` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/103-textarea-issue-selection/spec.md`

## Summary

Implement a lightweight, non-invasive click-to-locate mechanism connecting `UnifiedAuditPanel` issue cards to the active editing textarea in `BilingualEditor`. Because HTML textareas cannot support arbitrary CSS/span highlighting on substrings, this feature uses native `textarea.setSelectionRange(start, end)` to highlight matching excerpts with browser selection, paired with estimated vertical scrolling based on dynamic computed line-height and newline counting. If an excerpt has drifted or was edited, a non-blocking informational toast notifies the user without interrupting workflow.

## Technical Context

**Language/Version**: TypeScript ~5.8.2, React 19, Vite 6  
**Primary Dependencies**: React 19, Lucide React, Tailwind CSS v4, `clsx`, `tailwind-merge`  
**Storage**: N/A (pure in-memory DOM manipulation and component wiring)  
**Testing**: Vitest (`vitest run`), JSDOM / React test utils  
**Target Platform**: Web Browsers (Chrome, Edge, Firefox, Safari)  
**Project Type**: Single React SPA (Frontend in `src/`, Express server in `server/`)  
**Performance Goals**: Selection and scroll execution in <50ms upon card click  
**Constraints**:
- Strictly retain pure `<textarea>` elements without converting to `contentEditable` or overlay divs.
- Zero new NPM dependencies installed (Principle II).
- Non-blocking notification if snippet cannot be found.
- Respect active stage (`raw` vs `polished`) in `BilingualEditor`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [X] **Principle I (Strict Quality Gates & Verification)**: Plan includes full testing (`npm run lint`, `npm test`, `npm run build`) and targeted unit tests in `src/utils/__tests__/textareaHighlight.test.ts`.
- [X] **Principle II (Dependency Minimization & Reuse)**: Zero new dependencies added. Utilizes standard DOM `HTMLTextAreaElement.setSelectionRange`, `window.getComputedStyle`, and existing notification toast system.
- [X] **Principle III (Strict Concern Separation)**: Changes are strictly confined to UI utilities and workspace components; backend server and Gemini API calling routines are untouched.
- [X] **Principle IV (Immutable Core Schemas & Storage Stability)**: No changes to `types.ts`, IndexedDB, or existing Vietnamese UI copy.
- [X] **Principle V (Atomic Commits & Scoped Changes)**: Changes limited to `textareaHighlight.ts`, `UnifiedAuditPanel.tsx`, `BilingualEditor.tsx`, and tests.

## Project Structure

### Documentation (this feature)

```text
specs/103-textarea-issue-selection/
├── plan.md              # This implementation plan
├── research.md          # Technical research & DOM selection decisions
├── data-model.md        # Function signatures, prop interfaces, sequence flow
├── quickstart.md        # Verification guide & visual test scenarios
├── contracts/
│   └── textarea-highlight.contract.md # Formalized contract specifications
├── checklists/
│   └── requirements.md  # Spec quality checklist
├── spec.md              # Feature specification
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── utils/
│   ├── textareaHighlight.ts              # [NEW] DOM scroll & selection utility
│   └── __tests__/
│       └── textareaHighlight.test.ts     # [NEW] Unit tests for selection & scroll
└── components/
    └── translator-workspace/
        ├── BilingualEditor.tsx           # [MODIFY] Attach textarea refs and pass active ref
        ├── UnifiedAuditPanel.tsx         # [MODIFY] Wire activeTextareaRef prop & card click selection
        └── __tests__/
            └── UnifiedAuditPanel.test.tsx# [MODIFY] Add test coverage for activeTextareaRef click handling
```

**Structure Decision**: Single project layout. New utility in `src/utils/`, modifications confined to `BilingualEditor.tsx` and `UnifiedAuditPanel.tsx`.

## Complexity Tracking

*No violations. All architectural principles and constraints cleanly satisfied.*
