# Implementation Plan: Auto-Fix and Targeted AI Sentence Rewriting

**Branch**: `104-audit-auto-fix-rewrite` | **Date**: 2026-09-10 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/104-audit-auto-fix-rewrite/spec.md)

**Input**: Feature specification from `/specs/104-audit-auto-fix-rewrite/spec.md`

## Summary

Implement centralized auto-fixing for rule-based audit issues and targeted AI sentence rewriting with preview verification in the collaborative translation workspace.
All text mutations strictly flow through the single CRDT-aware setter pipeline (`handlePolishedTranslationChange` / `handleRawTranslationChange`) in `useWorkspaceState.ts`.
Micro-prompt AI rewriting is powered by `rewriteSentenceDirect` in `directTranslationEngine.ts`, and the user interacts via "Sửa ngay" and "Nhờ AI viết lại câu này" buttons in `UnifiedAuditPanel.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Vite 6  
**Primary Dependencies**: Tailwind CSS v4, Lucide React, Yjs (CRDT for real-time collaboration via `useChapterCRDT`)  
**Storage**: IndexedDB (client-side for project and chapter state)  
**Testing**: Vitest (SSR-based and unit tests with mocked Gemini client)  
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox)  
**Project Type**: Web application (SPA with embedded Express backend)  
**Performance Goals**: Auto-fix execution < 50ms; AI rewrite preview generation < 1.5s  
**Constraints**:
- Strictly confine edits to `useWorkspaceState.ts`, `directTranslationEngine.ts`, `UnifiedAuditPanel.tsx` (and unit tests)
- 100% text replacements routed through `handleApplyAuditFix`
- AI rewrites require preview verification before committing changes
- AI calls must reuse `callGeminiDirect` key rotation and error handling

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle 1 (Quality Gates)**: `npm run lint`, `npm test`, `npm run build` must pass cleanly. (PASS)
- **Principle 2 (Design System)**: Use existing primitives and theme tokens (Badge, Button, Seal, parchment/polish palette). (PASS)
- **Principle 3 (Real-Time Integrity)**: All text edits must route through CRDT-aware setters. (PASS)
- **Principle 4 (Scope Protection)**: Do not edit unrelated files or backend services. (PASS)

## Project Structure

### Documentation (this feature)

```text
specs/104-audit-auto-fix-rewrite/
├── plan.md              # This file
├── research.md          # Architectural decisions (centralized fix, micro-prompts, preview flow)
├── data-model.md        # Interface definitions and state lifecycle
├── quickstart.md        # Feature validation walkthrough
├── contracts/           # API and component contracts
└── tasks.md             # Implementation tasks and tracking
```

### Source Code (in scope)

```text
src/
├── components/
│   └── translator-workspace/
│       ├── UnifiedAuditPanel.tsx
│       ├── useWorkspaceState.ts
│       └── __tests__/
│           ├── UnifiedAuditPanel.test.tsx
│           └── useWorkspaceState.test.ts
└── services/
    ├── directTranslationEngine.ts
    └── __tests__/
        └── directTranslationEngine.test.ts
```

## Complexity Tracking

No constitution violations detected. Centralized design eliminates state drift and scattered replace routines.
