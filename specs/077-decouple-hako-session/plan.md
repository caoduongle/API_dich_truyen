# Implementation Plan: Decouple Quality Review Session & JIT Content Loading

**Branch**: `077-decouple-hako-session` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/077-decouple-hako-session/spec.md`

## Summary

Resolve browser tab freezing and crashes during chapter selection in the Hako Quality Checker workspace by:
1. **Decoupling heavy text from persistent session storage**: Define lightweight `HakoChapterMeta` and sanitize session records before saving to / reading from IndexedDB.
2. **Instant project selection**: Initialize chapter review catalogs directly from `StoryProject.chapters` metadata in $< 5\text{ms}$ rather than performing 100+ asynchronous full-chapter database queries.
3. **Just-In-Time (JIT) content loading**: Fetch full chapter text only for selected chapters (max 12) at the point of scan execution (`handleStartAnalysis`), passing content directly to the quality engine in memory without persisting it back to `HakoQualityCheckerDB`.
4. **Non-blocking / debounced UI selection**: Isolate checkbox click state updates in React state for $< 2\text{ms}$ response times, debouncing IndexedDB writes by 300ms.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19
**Primary Dependencies**: React hooks (`useState`, `useCallback`, `useRef`), Tailwind CSS v4, Lucide React icons
**Storage**: Client-side IndexedDB (`HakoQualityCheckerDB` -> `hako_quality_sessions` store and `AppDatabase` -> `CHAPTERS_STORE`)
**Testing**: Vitest (`npx vitest run`) + TypeScript compiler (`tsc --noEmit`)
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari)
**Project Type**: React Single Page Application (Client-side translation & review workspace)
**Performance Goals**:
- Checkbox toggle latency $< 2\text{ms}$
- Project list loading latency $< 10\text{ms}$ for 200+ chapters
- Session storage payload $< 50\text{ KB}$ (reduced from 5–30 MB)
- 0% tab crash rate under rapid user interaction
**Constraints**: Zero changes to translation backend routes or core `StoryProject` database schema.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check Item | Status | Notes |
| :--- | :--- | :---: | :--- |
| **I. Quality Gates** | `tsc --noEmit`, `vitest run`, `vite build` | **PASS** | Strict verification required before completion. |
| **II. Dependency Minimization** | No new NPM packages added | **PASS** | Uses existing React primitives and standard browser timers. |
| **III. Concern Separation** | No modifications to backend or translation pipeline | **PASS** | Restricted strictly to Hako quality checker session & UI. |
| **IV. Immutable Schemas** | No changes to `src/types.ts` or `StoryProject` schema | **PASS** | Types isolated in `src/types/hakoChecker.ts`. |
| **V. Atomic Commits & Docs** | Synced specifications and modular changes | **PASS** | Detailed contracts, research, and quickstart documentation created. |

## Project Structure

### Documentation (this feature)

```text
specs/077-decouple-hako-session/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Root cause analysis & architecture decisions
├── data-model.md        # Entity definitions & state transitions
├── quickstart.md        # Verification scenarios & validation guide
├── contracts/
│   └── hako-session-jit.contract.md # Type signatures & store contracts
└── checklists/
    └── requirements.md  # Spec quality validation checklist
```

### Source Code Impact

```text
src/
├── types/
│   └── hakoChecker.ts                    # Define HakoChapterMeta, HakoChapterFull, update ProjectReviewChapter
├── services/
│   ├── hakoSessionStore.ts               # Implement sanitizeSession, ensure store.put strips heavy text
│   └── __tests__/
│       └── hakoQualityEngine.test.ts     # Validate scanner behavior with JIT payloads
├── hooks/
│   ├── useHakoReviewSession.ts           # Instant selectProject, debounced persistSession, JIT handling
│   └── __tests__/
│       └── useHakoReviewSession.test.ts  # Unit tests for fast selection and lightweight payload
└── components/
    └── hako-checker/
        ├── HakoCheckerWorkspace.tsx      # JIT load full text for selected chapters in handleStartAnalysis
        └── HakoChapterSelector.tsx       # Smooth checkbox toggle and batch selection rendering
```

## Planned Changes by File

### 1. `src/types/hakoChecker.ts`
- Introduce `HakoChapterMeta` with lightweight properties (`chapterId`, `title`, `chapterNumber`, `translationType`, `wordCount`, `status`, `errorMessage`, `rawChineseContent`).
- Update `ProjectReviewChapter` to extend `HakoChapterMeta` with optional `vietnameseContent?: string`.
- Define `HakoChapterFull` for runtime scan execution containing mandatory `vietnameseContent: string`.

### 2. `src/services/hakoSessionStore.ts`
- Add `sanitizeSession(session: QualityReviewSession): QualityReviewSession` to strip `vietnameseContent` from all chapters in the session.
- Apply `sanitizeSession` inside `saveSession` before calling `store.put()`.
- Apply `sanitizeSession` in `getSession`, `getLatestSession`, and `listSessions` to cleanse existing legacy sessions in storage.

### 3. `src/hooks/useHakoReviewSession.ts`
- Refactor `selectProject`: remove the `Promise.all` iteration that calls `getChapterFromDB` for every chapter. Map `project.chapters` directly to `HakoChapterMeta` records with 0 async blocking.
- Implement debounce timer for `persistSession` (300ms) on selection changes (`toggleChapterSelection`, `selectChapterRange`, `clearChapterSelection`).
- Ensure UI state (`selectedChapterIds`) updates synchronously and immediately.

### 4. `src/components/hako-checker/HakoCheckerWorkspace.tsx`
- In `handleStartAnalysis`: query `getChapterFromDB` ONLY for the selected chapter IDs (max 12 chapters).
- Construct runtime `HakoChapterFull[]` payload with full Vietnamese and Chinese text, feed directly into `runHeuristicQualityScan` and `runAiQualityScan`.
- In `updateSessionChaptersAndIssues`: update issue list and chapter status without re-injecting full-text blobs into persistent session storage.

### 5. `src/hooks/__tests__/useHakoReviewSession.test.ts`
- Add comprehensive unit tests verifying:
  - Instant project selection without DB calls across 200+ chapters.
  - Checkbox toggle instant state update.
  - Session persistence payload size remaining $< 20\text{ KB}$.
  - Sanitization of legacy sessions on read.

## Verification Plan

### Automated Tests
```bash
npm run lint
npx vitest run src/hooks/__tests__/useHakoReviewSession.test.ts src/services/__tests__/hakoQualityEngine.test.ts
npm test
npm run build
```

### Manual Verification
1. Open Quality Checker tab on a novel with 139+ chapters.
2. Verify instantaneous project loading and responsive chapter checkbox toggling.
3. Start analysis on 5 chapters and verify scan completes with accurate issue detection.
4. Verify IndexedDB storage footprint is $< 30\text{ KB}$.
