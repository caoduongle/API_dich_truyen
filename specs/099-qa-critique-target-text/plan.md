# Implementation Plan: QA Critique Target Text Locating Field

**Branch**: `099-qa-critique-target-text` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/099-qa-critique-target-text/spec.md`

## Summary

Enhance the Phase 3 QA Critique prompt and JSON schema in `shared/prompts.ts` by introducing a mandatory `targetText: string` field on each issue item. The `systemInstruction` commands the Gemini model to extract verbatim excerpts from the polished Vietnamese text (or `""` for omissions). Replace loose `any[]` typing across the QA critique pipeline (`src/services/directTranslationEngine.ts`, `QaCritiquePanel.tsx`, `BilingualEditor.tsx`, `useWorkspaceState.ts`, `chapterTranslationService.ts`) with a strongly typed `DirectQaCritiqueIssue` interface to provide end-to-end type safety for upcoming Track B features (click-to-highlight, AI sentence rewriting).

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 20+  
**Primary Dependencies**: React 19, Vite, Tailwind CSS v4, Lucide React (Zero new dependencies)  
**Storage**: N/A (Client-side memory state; no database or IndexedDB changes)  
**Testing**: Vitest (`npm test`), TypeScript verification (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Desktop and mobile web browsers (React client)  
**Project Type**: Web application with shared prompt modules (`shared/`) and frontend workspace components  
**Performance Goals**: Sub-millisecond payload construction overhead (<1ms)  
**Constraints**: Strict verbatim text copying without hallucinated punctuation; strict type-safety; no UI markup or behavior modifications  
**Scale/Scope**: 5 existing codebase files touched strictly for schema, prompt instruction, types, and test assertions  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` MUST pass without error. No tests skipped or disabled. (STATUS: PASS)
- **Principle II: Dependency Minimization & Existing Library Reuse**: No new packages added. Uses existing standard libraries. (STATUS: PASS)
- **Principle III: Strict Concern Separation & Domain Boundary Preservation**: Scoped exclusively to QA Critique prompt payload and client type propagation. Server translation logic and Hako Quality Engine are untouched. UI layout and behavior remain untouched. (STATUS: PASS)
- **Principle IV: Immutable Core Schemas & Storage Stability**: Core `src/types.ts` and IndexedDB schemas are not modified. Domain types reside in `directTranslationEngine.ts`. Vietnamese UI labels remain untouched. (STATUS: PASS)
- **Principle V: Atomic Commits & Documentation Synchronization**: Modifications are small, modular, and directly verifiable. (STATUS: PASS)

Gate status: **PASSED (Zero violations)**

## Project Structure

### Documentation (this feature)

```text
specs/099-qa-critique-target-text/
├── plan.md              # This plan
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data models & schemas
├── quickstart.md        # Phase 1 validation commands & steps
├── contracts/           # Phase 1 interface contracts
│   └── qa-critique-target-text.contract.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
├── spec.md              # Feature specification
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
shared/
├── prompts.ts                               # Add targetText to QA critique schema and systemInstruction
└── __tests__/
    └── sharedTranslationLogic.test.ts       # Assert targetText presence in schema and prompt

src/
├── services/
│   ├── directTranslationEngine.ts           # Define DirectQaCritiqueIssue, update DirectQaCritiqueResult
│   ├── chapterTranslationService.ts         # Type annotation for QA issue iteration
│   └── __tests__/
│       └── directTranslationEngine.test.ts  # Update QA test mock to match DirectQaCritiqueIssue
└── components/
    ├── TranslatorWorkspace.tsx              # Passes qaIssues through props
    └── translator-workspace/
        ├── QaCritiquePanel.tsx               # Update QaCritiquePanelProps to use DirectQaCritiqueIssue[]
        ├── BilingualEditor.tsx               # Update BilingualEditorProps to use DirectQaCritiqueIssue[]
        └── useWorkspaceState.ts             # Update useState type to DirectQaCritiqueIssue[]
```

**Structure Decision**: Web application with shared TypeScript code between server and client. Modifications reside in `shared/` (prompt payload generation) and `src/` (typing and consumer state declarations).

## Complexity Tracking

*No violations. All principles and constraints cleanly satisfied.*
