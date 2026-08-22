# Implementation Plan: Fix Tab Navigation Infinite Loop

**Branch**: `056-fix-tab-navigation-loop` | **Date**: 2026-08-22 | **Spec**: [`specs/056-fix-tab-navigation-loop/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/056-fix-tab-navigation-loop/spec.md)

**Input**: Feature specification from `/specs/056-fix-tab-navigation-loop/spec.md`

## Summary

Fix the unidirectional tab navigation bug (tabs only switch to the right, failing when switching back to the left) caused by an infinite render loop in `useChapterCRDT.ts`. The root cause is an unstable inline `onRemoteChange` callback passed from `TranslatorWorkspace.tsx` and tracked in `useChapterCRDT`'s `useEffect` dependency array, which repeatedly triggers `setStatus('offline')` and state updates beyond React's maximum update depth limit. The solution stabilizes `onRemoteChange` using a mutable `useRef` inside `useChapterCRDT.ts` and `useCallback` in `TranslatorWorkspace.tsx`.

---

## Technical Context

**Language/Version**: TypeScript 5.8.2 / React 19.0.1  
**Primary Dependencies**: React 19, Yjs 13.6.32, y-websocket 3.1.0, y-indexeddb 9.0.12, Lucide React  
**Storage**: IndexedDB (`src/services/db.ts` and `y-indexeddb`)  
**Testing**: Vitest 4.1.9 (`npm test`), TypeScript `tsc --noEmit` (`npm run lint`), Vite 6.2.3 build (`npm run build`)  
**Target Platform**: Web (Desktop & Mobile responsive)  
**Project Type**: React SPA + Express.js backend  
**Performance Goals**: Tab switching response < 16ms (instantaneous, 60fps), 0 console error loops  
**Constraints**: Zero changes to IndexedDB schema, zero modifications to translation pipeline, zero external dependency additions  
**Scale/Scope**: 2 files modified (`src/hooks/useChapterCRDT.ts`, `src/components/TranslatorWorkspace.tsx`)  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Strict Quality Gates & Verification**: All tasks will verify `tsc --noEmit`, `vitest run`, and `vite build`. No tests skipped.
- [x] **II. Dependency Minimization & Existing Library Reuse**: No new NPM packages added. Standard React hooks (`useRef`, `useCallback`) reused.
- [x] **III. Strict Concern Separation & Domain Boundary Preservation**: No modifications to `server/` or backend Gemini API calling logic. Confined to UI hook lifecycle and component callback memoization.
- [x] **IV. Immutable Core Schemas & Storage Stability**: Core interfaces in `src/types.ts` and IndexedDB schemas in `src/services/db.ts` remain unchanged. Vietnamese UI text untouched.
- [x] **V. Atomic Commits & Documentation Synchronization**: Scoped strictly to tab loop fix across 2 files.

---

## Project Structure

### Documentation (this feature)

```text
specs/056-fix-tab-navigation-loop/
├── plan.md              # Implementation plan (this document)
├── research.md          # Phase 0: Root cause and architectural decisions
├── data-model.md        # Phase 1: State model and lifecycle
├── quickstart.md        # Phase 1: Verification scenarios
├── contracts/           # Phase 1: Interface contracts
│   ├── crdt-hook.contract.md
│   └── tab-navigation.contract.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── spec.md              # Feature specification
```

### Source Code

```text
src/
├── hooks/
│   └── useChapterCRDT.ts          # [MODIFY] Stabilize onRemoteChange callback via useRef & clean deps
└── components/
    └── TranslatorWorkspace.tsx    # [MODIFY] Memoize onRemoteChange with useCallback
```

**Structure Decision**: Direct targeted fix in existing React hook and component files. No new files or architectural directories needed.

---

## Proposed Changes

### Component 1: `src/hooks/useChapterCRDT.ts`
- Create `const onRemoteChangeRef = useRef(onRemoteChange);` and keep it updated on every render: `onRemoteChangeRef.current = onRemoteChange;`.
- Create `const debouncedSaveToDbRef = useRef(debouncedSaveToDb);` and keep it updated: `debouncedSaveToDbRef.current = debouncedSaveToDb;`.
- Inside `doc.on('update', handleDocUpdate)`, invoke `onRemoteChangeRef.current?.(updated)` and `debouncedSaveToDbRef.current(doc, chapterId)`.
- Remove `onRemoteChange` and `debouncedSaveToDb` from the main `useEffect` dependency array so the effect only triggers on genuine connection changes: `[projectId, chapterId, isShared, userEmail, userName, userPicture]`.

### Component 2: `src/components/TranslatorWorkspace.tsx`
- Wrap the `onRemoteChange` callback in `useCallback` with stable dependencies (`[setRawTranslation, setPolishedTranslation, setChapterTitle]`).

---

## Verification Plan

### Automated Tests
```bash
npm run lint    # tsc --noEmit: Must be 100% clean
npm test        # vitest run: All 87 test files (589 tests) must pass
npm run build   # vite build + esbuild: Build must succeed
```

### Manual Verification
- Browser testing with Chrome DevTools at `http://localhost:3000`:
  1. Click Tab 1 → Tab 2 → Tab 3 → Tab 4 → Tab 5 (Rightward navigation).
  2. Click Tab 5 → Tab 4 → Tab 3 → Tab 2 → Tab 1 (Leftward navigation - verifying bug resolution).
  3. Use keyboard shortcuts `Alt+1` through `Alt+5` in random order.
  4. Verify DevTools console has **0** `Maximum update depth exceeded` errors.
  5. Take screenshots of active tabs to confirm visual rendering.
