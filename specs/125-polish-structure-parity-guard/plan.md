# Implementation Plan: Polish Truncation Prevention and 1:1 Paragraph Structure Parity

**Branch**: `125-polish-structure-parity-guard` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/125-polish-structure-parity-guard/spec.md`

## Summary

Prevent polished translations from becoming shorter or truncated compared to raw translations (as observed in Chapter 92) and enforce 1:1 paragraph and line structure parity with the Chinese source text. The solution implements:
1. **Pre-emptive Synchronized Splitting** in Stage 2 (`polishWithContentSplitDirect`) for long chapters (> 1800 tokens).
2. **Dual-Metric Truncation & Parity Guard** (`validatePolishIntegrity`, `validateParagraphParity`) checking character length ratio ($\ge 80\%$) and paragraph divergence ($\le 20\%$).
3. **Adaptive Split Retry Integration** via `isAdaptiveSplitRetryableError` for automatic Divide & Conquer recovery upon detecting truncation or structure collapse.
4. **Prompt Hardening** strictly prohibiting paragraph merging in Stage 1 and Stage 2.
5. **UI Structure Parity Metrics** displaying paragraph and character counts in Workspace editor and chapter history.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 18+  
**Primary Dependencies**: React 19, Vite, `@google/genai` client SDK, `lucide-react`, `clsx`, `tailwind-merge`  
**Storage**: Client-side IndexedDB (`src/services/db.ts`)  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`)  
**Target Platform**: Pure Client-Side SPA (Web Browser, Modern Chromium/Firefox/Safari)  
**Project Type**: Web Application (Client-side single-page app)  
**Performance Goals**: Sub-millisecond parity validation; adaptive split retries complete within existing stream/batch timeouts without user intervention.  
**Constraints**: Pure client-side execution; zero backend server dependency; immutable core schemas in `src/types.ts`.  
**Scale/Scope**: Chapters up to 15,000+ words per chapter across 1,000+ chapter novel projects.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` must pass cleanly without deleting or skipping existing tests. $\rightarrow$ **PASS**
- **Principle II: Dependency Minimization & Existing Library Reuse**: No new dependencies added; uses existing `splitTextAdaptively`, `sanitizePromptInput`, and string utilities. $\rightarrow$ **PASS**
- **Principle III: Strict Concern Separation & MVC Domain Boundary**: Business logic and algorithms placed in `src/lib/` and `src/services/`; state orchestration in `src/hooks/`; UI presentation in `src/components/`. $\rightarrow$ **PASS**
- **Principle IV: Immutable Core Schemas & Storage Stability**: Schema in `src/types.ts` and IndexedDB stores remain unchanged. $\rightarrow$ **PASS**
- **Principle V: Atomic Commits & Documentation Synchronization**: Spec, research, data model, contracts, and plan maintained in strict synchronization. $\rightarrow$ **PASS**

---

## Project Structure

### Documentation (this feature)

```text
specs/125-polish-structure-parity-guard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── translation-parity.contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── text.ts                       # [MODIFY] Add countParagraphs, validatePolishIntegrity, validateParagraphParity
│   └── __tests__/
│       └── text.test.ts              # [MODIFY] Unit tests for truncation & parity validation
├── services/
│   ├── ai/
│   │   └── prompts.ts                # [MODIFY] Harden Stage 1 & Stage 2 prompts against paragraph merging
│   ├── directTranslationEngine.ts    # [MODIFY] Add Stage 2 pre-split, validatePolishIntegrity check, and update isAdaptiveSplitRetryableError
│   └── __tests__/
│       └── directTranslationEngine.test.ts # [MODIFY] Tests for Stage 2 pre-split & truncation recovery
└── components/
    └── workspace/
        └── EditorStatsBadge.tsx      # [NEW/MODIFY] Display paragraph & character count parity metrics in editor
```

**Structure Decision**: Single project client-side SPA structure conforming to existing codebase layout.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *None* | *N/A* | *No architectural violations or extra complexity introduced* |
