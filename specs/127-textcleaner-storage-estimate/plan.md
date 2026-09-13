# Implementation Plan: Anti-Scraping Invisible Character Stripping, NFC Normalization & Storage Usage Visibility

**Branch**: `127-textcleaner-storage-estimate` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/127-textcleaner-storage-estimate/spec.md`

## Summary

This plan addresses two high-value quality and transparency improvements while strictly honoring architectural boundaries:
1. **Nhóm B — Text Cleaner Sanitization (`src/utils/textCleaner.ts`)**:
   - Strip anti-scraping zero-width characters: Zero-Width Space (`\u200B`), Byte Order Mark (`\uFEFF`), Zero-Width Joiner (`\u200D`), and Zero-Width Non-Joiner (`\u200C`).
   - Standardize output text to Unicode Normalization Form C (`.normalize('NFC')`).
   - Add unit test coverage in `src/utils/__tests__/textCleaner.test.ts` ensuring title separation and watermark filtering are preserved.
2. **Nhóm C — Storage Usage UI Transparency (`src/components/api-settings/StorageUsageSection.tsx`)**:
   - Create a clean subcomponent invoking `estimateStorageUsage()` from `src/services/db.ts`.
   - Embed into `src/components/ApiSettings.tsx` to display storage progress, usage, and quota with on-mount polling and manual refresh.
   - Gracefully hide the component if `estimateStorageUsage()` returns `null` (unsupported browser).
3. **Nhóm D — Strict Non-Goals**:
   - No PWA, no Web Crypto, no Dockerfile removal, no OpenCC changes.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 18+  
**Primary Dependencies**: React 19, Vite, `@google/genai` client SDK, `lucide-react`, `clsx`, `tailwind-merge`  
**Storage**: Client-side IndexedDB (`src/services/db.ts`) with `navigator.storage.estimate()`  
**Testing**: Vitest (`npm test`), TypeScript type checking (`tsc --noEmit`), Vite production build (`npm run build`)  
**Target Platform**: Pure Client-Side SPA (Modern Web Browsers)  
**Project Type**: Web Application (Client-side SPA)  
**Performance Goals**: Sub-millisecond text cleaning; zero rendering lag for storage widget; sub-100ms async disk estimate.  
**Constraints**: Pure client-side architecture; zero backend server dependencies; immutable schemas in `src/types.ts`.  
**Scale/Scope**: 3 source/test files modified (`textCleaner.ts`, `textCleaner.test.ts`, `ApiSettings.tsx`), 1 new subcomponent (`StorageUsageSection.tsx`).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` must all pass cleanly without skipping or deleting tests. $\rightarrow$ **PASS**
- **Principle II: Dependency Minimization & Existing Library Reuse**: No new NPM dependencies added; uses native `String.prototype.normalize`, `RegExp`, and existing `lucide-react` icons. $\rightarrow$ **PASS**
- **Principle III: Strict Concern Separation & MVC Domain Boundary**: String sanitization algorithm in `src/utils/`; storage estimation in `src/services/db.ts`; UI presentation in `src/components/api-settings/`. Views do not contain storage math; services do not import components. $\rightarrow$ **PASS**
- **Principle IV: Immutable Core Schemas & Storage Stability**: No modifications to IndexedDB schemas or `src/types.ts`. $\rightarrow$ **PASS**
- **Principle V: Atomic Commits & Documentation Synchronization**: All artifacts (`spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `plan.md`) are maintained in strict sync with code changes. $\rightarrow$ **PASS**

---

## Project Structure

### Documentation (this feature)

```text
specs/127-textcleaner-storage-estimate/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Technical research and decisions
├── data-model.md        # Entities and pipeline data model
├── quickstart.md        # Step-by-step verification commands
├── checklists/
│   └── requirements.md  # Quality checklist validation
└── contracts/
    └── cleaner-and-storage.contract.md # Interface & component contracts
```

### Source Code (repository root)

```text
src/
├── utils/
│   ├── textCleaner.ts                      # [MODIFY] Strip \u200B, \uFEFF, \u200D, \u200C & normalize NFC
│   └── __tests__/
│       └── textCleaner.test.ts             # [MODIFY] Add tests for invisible char removal and NFC
├── components/
│   ├── ApiSettings.tsx                     # [MODIFY] Render StorageUsageSection in config tab
│   └── api-settings/
│       └── StorageUsageSection.tsx         # [NEW] Subcomponent displaying IndexedDB usage with refresh
```

**Structure Decision**: Utility logic in `src/utils/textCleaner.ts` paired with a focused presentation subcomponent in `src/components/api-settings/`.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *None* | *N/A* | *Standard string cleaning and modular React UI component* |

