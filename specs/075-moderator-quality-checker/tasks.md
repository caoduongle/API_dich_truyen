# Tasks: Moderator Hako Quality Checker Workspace

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define TypeScript types and create the isolated persistence layer shared by all user stories.

- [X] T001 [P] Define all Hako quality checker TypeScript types in `src/types/hakoChecker.ts` (entities from data-model.md: `QualityIssueCategory`, `QualityIssueSeverity`, `QualityIssueDecision`, `HakoChapterMeta`, `HakoVolume`, `HakoNovelMeta`, `HakoReviewChapter`, `QualityIssue`, `QualityReviewSession`, `QualityReportStats`, `QualityReport`)
- [X] T002 [P] Implement persistent session store for review sessions in `src/services/hakoSessionStore.ts` — use a dedicated IndexedDB object store `hako_quality_sessions` (or localStorage wrapper) completely isolated from `PROJECTS_STORE`/`CHAPTERS_STORE`; support CRUD operations: `createSession`, `getSession`, `updateSession`, `deleteSession`, `listSessions`
- [X] T003 [P] Implement Hako HTML scraper service with anti-bot/rate-limit detection in `server/services/hakoScraperService.ts` — functions: `fetchNovelMeta(url)` and `fetchChapterContent(url)` using Node.js native `fetch`; parse public HTML for title/author/artist/volumes/chapters; detect HTTP 429, Cloudflare 403 challenges and return structured error codes (`HAKO_RATE_LIMITED`, `HAKO_BOT_CHALLENGE`, `HAKO_NOT_FOUND`, `HAKO_NETWORK_ERROR`) with Vietnamese error messages and `retryAfterSeconds`

**Checkpoint**: Types defined, persistence layer ready, scraper service functional.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Server endpoints and client API wiring that all frontend stories depend on. MUST complete before any UI work.

- [X] T004 Implement Hako controller in `server/controllers/hakoController.ts` — `getNovelInfo(req, res)` and `getChapterContent(req, res)` handlers; validate URL format (`ln.hako.vn/truyen/` or `docln.net/truyen/`); delegate to `hakoScraperService`; return structured JSON responses per `hako-api.contract.md`
- [X] T005 Create Hako routes in `server/routes/hako.ts` — `POST /api/hako/novel-info` and `POST /api/hako/chapter-content`; apply `authMiddleware` (reuse existing)
- [X] T006 Mount Hako routes in `server/routes/api.ts` — import and `router.use('/hako', hakoRouter)` **without modifying** any existing translation/glossary/quota routes
- [X] T007 Implement client-side API service in `src/services/hakoApiService.ts` — functions: `fetchNovelInfo(url): Promise<HakoNovelMeta>` and `fetchChapterContent(url): Promise<{content, title, wordCount}>`; propagate structured error codes to UI
- [X] T008 Implement React hook `useHakoReviewSession` in `src/hooks/useHakoReviewSession.ts` — manages full session lifecycle: novel URL input, metadata fetch, chapter selection (1–12 limit enforcement), chapter content loading, issue list, moderator decisions (confirm/review/dismiss with notes), session persistence via `hakoSessionStore`, and session restore on mount

**Checkpoint**: Full data pipeline from Hako → server proxy → client API → React hook is wired. All user stories can now build UI on top.

---

## Phase 3: User Story 1 — Tải thông tin truyện Hako và chọn đợt chương kiểm định (Priority: P1) 🎯 MVP

**Goal**: Moderator pastes a Hako novel URL → system fetches public metadata → moderator selects up to 12 chapters for review.

**Independent Test**: Paste a valid Hako URL, see novel info + volume/chapter list, select 1–12 chapters with the 13th blocked.

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `HakoNovelImporter` component in `src/components/hako-checker/HakoNovelImporter.tsx` — URL input with paste detection, fetch button, loading spinner, novel metadata card (title/author/artist/cover), anti-bot/rate-limit error alert with countdown timer and retry button; uses `Button`, `Badge`, `EmptyState` from `src/components/ui/`
- [X] T010 [P] [US1] Create `HakoChapterSelector` component in `src/components/hako-checker/HakoChapterSelector.tsx` — renders volume accordion with chapter checkboxes, selection counter badge (`N/12`), disable further selection at 12, "Chọn tất cả tập" / "Bỏ chọn" controls, "Bắt đầu kiểm định" button enabled only when 1–12 selected
- [X] T011 [US1] Create `HakoCheckerWorkspace` container in `src/components/hako-checker/HakoCheckerWorkspace.tsx` — orchestrates importer → selector → review panel flow; receives `apiKeys` and `selectedModel` from parent; delegates to `useHakoReviewSession` hook; shows `EmptyState` when no session active
- [X] T012 [US1] Integrate "Kiểm Định Hako" tab into `src/App.tsx` — add `'hako-checker'` to `activeTab` union type; add tab button with `ShieldCheck` icon from `lucide-react` and `Alt+6` keyboard shortcut; lazy-load `HakoCheckerWorkspace` via `React.lazy`; pass `apiKeys` and `selectedModel` props; wrap in `ErrorBoundary`

**Checkpoint**: US1 fully functional — moderator can import novel, browse volumes/chapters, select up to 12, and session persists across reloads.

---

## Phase 4: User Story 2 — Rà soát tự động và xử lý danh sách lỗi nghi ngờ (Priority: P1)

**Goal**: System auto-analyzes selected chapters via heuristic scans + AI semantic critique; moderator reviews, confirms/dismisses issues; decisions persist.

**Independent Test**: Select chapters and start review → issues list appears with severity/category/snippets → change decisions → reload page → decisions preserved.

### Implementation for User Story 2

- [X] T013 [P] [US2] Implement heuristic quality scan engine in `src/services/hakoQualityEngine.ts` — function `runHeuristicQualityScan(chapter): QualityIssue[]`; rules: CJK character detection for raw leaks (regex `[\u4e00-\u9fa5]`), consecutive paragraph duplication, placeholder/error marker detection (`[chưa dịch]`, `TODO`, `FIXME`)
- [X] T014 [US2] Implement AI semantic quality scan in `src/services/hakoQualityEngine.ts` — function `runAiQualityScan(input): Promise<QualityIssue[]>`; builds structured Gemini prompt for name consistency, pronoun/gender continuity, terminology drift across chapters; uses `callGeminiDirect` from `src/services/directGeminiClient.ts` with JSON response schema; supports `AbortSignal` and `onProgress` callback
- [X] T015 [P] [US2] Create `HakoIssueCard` component in `src/components/hako-checker/HakoIssueCard.tsx` — displays single issue with: severity badge (color-coded per design system), category label, chapter title, Vietnamese snippet quote, explanation text, optional raw snippet, decision buttons (Xác nhận / Yêu cầu xem lại / Bác bỏ) using `Button` primitives, moderator note textarea
- [X] T016 [US2] Create `HakoIssueReviewPanel` component in `src/components/hako-checker/HakoIssueReviewPanel.tsx` — renders filterable/sortable list of `HakoIssueCard`s; filters by severity, category, decision status, and chapter; summary stats header (total issues, confirmed/pending/dismissed counts); "Rà soát lại" button to re-run analysis
- [X] T017 [US2] Wire analysis pipeline in `HakoCheckerWorkspace` — on "Bắt đầu kiểm định": fetch chapter contents via `hakoApiService`, run heuristic scan, then AI scan with progress indicator; merge results into session; persist to `hakoSessionStore`; show `HakoIssueReviewPanel` when analysis completes
- [X] T018 [US2] Wire decision persistence in `useHakoReviewSession` — `updateIssueDecision(issueId, decision, note?)` immediately updates session in IndexedDB with new `updatedAt` timestamp; session restore on hook mount loads all prior decisions intact

**Checkpoint**: US2 fully functional — moderator gets heuristic + AI quality issues, makes decisions, and everything persists across page reloads.

---

## Phase 5: User Story 3 — Đối chiếu song ngữ chuyên sâu với văn bản gốc tiếng Trung (Priority: P2)

**Goal**: Moderator optionally pastes raw Chinese text for chapters; system performs bilingual fidelity check detecting mistranslations, omissions, and hallucinated content.

**Independent Test**: Paste raw Chinese text for a chapter → run analysis → see bilingual-specific issues (mistranslation/omission/hallucination) with raw snippet evidence.

### Implementation for User Story 3

- [X] T019 [US3] Add raw Chinese text input drawer to `HakoChapterSelector` in `src/components/hako-checker/HakoChapterSelector.tsx` — expandable textarea per chapter for pasting raw text; visual indicator (icon/badge) when raw is provided; length mismatch warning if raw word count differs significantly from Vietnamese word count
- [X] T020 [US3] Extend AI scan prompt for bilingual mode in `src/services/hakoQualityEngine.ts` — when `rawChineseContent` is provided, append bilingual alignment instructions to Gemini prompt; detect `mistranslation`, `omission`, `hallucination` categories with both Vietnamese and raw snippets as evidence
- [X] T021 [US3] Update `HakoIssueCard` in `src/components/hako-checker/HakoIssueCard.tsx` — render `rawSnippet` in a distinct visual block (bordered panel with "Đoạn gốc tiếng Trung" label) when present on bilingual issues

**Checkpoint**: US3 fully functional — bilingual deep check works when raw text is provided, with raw snippet evidence displayed alongside Vietnamese evidence.

---

## Phase 6: User Story 4 — Xuất báo cáo kiểm định và tổng kết sai sót (Priority: P3)

**Goal**: Moderator copies a structured quality report of confirmed issues to clipboard for sharing with translators.

**Independent Test**: After confirming some issues, click "Xuất báo cáo" → see stats summary → click copy → formatted Markdown report in clipboard → toast notification.

### Implementation for User Story 4

- [X] T022 [US4] Implement report generation logic in `src/services/hakoQualityEngine.ts` — function `generateQualityReport(session): QualityReport`; computes `QualityReportStats`; formats confirmed issues as structured Markdown grouped by chapter with severity badges, snippets, and moderator notes
- [X] T023 [US4] Create `HakoReportExportModal` component in `src/components/hako-checker/HakoReportExportModal.tsx` — modal showing stats dashboard (pie/bar breakdown by severity & category), formatted Markdown preview in scrollable code block, "Sao chép vào Clipboard" button using `navigator.clipboard.writeText()` with success toast; "Không có lỗi cần báo cáo" empty state when zero confirmed issues
- [X] T024 [US4] Wire export modal trigger in `HakoIssueReviewPanel` — "Xuất báo cáo kiểm định" button opens `HakoReportExportModal`; passes current session to report generator

**Checkpoint**: US4 fully functional — moderator can copy structured quality report to clipboard in one click.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, edge-case hardening, and final verification.

- [X] T025 [P] Add unit tests for `hakoScraperService` in `server/__tests__/hakoScraper.test.ts` — test novel metadata parsing from sample HTML, chapter content extraction, rate-limit detection (mock 429/403 responses), invalid URL rejection, Cloudflare challenge detection
- [X] T026 [P] Add unit tests for heuristic quality scan in `src/services/__tests__/hakoQualityEngine.test.ts` — test CJK raw leak detection, duplicate paragraph detection, placeholder detection, issue ID uniqueness
- [X] T027 Edge-case hardening in `server/services/hakoScraperService.ts` — handle network timeouts (10s default), excessively long chapters (truncate at reasonable limit), HTML with embedded images/iframes (strip non-text elements), malformed HTML gracefully
- [X] T028 Add i18n keys for "Kiểm Định Hako" tab label and core UI strings in the appropriate i18n locale file(s) — ensure Vietnamese translations are consistent with existing app terminology
- [X] T029 Run `npm run lint` (tsc --noEmit), `npm test` (vitest run), and `npm run build` (vite build + esbuild) to verify zero regressions — all 3 commands MUST pass cleanly
- [X] T030 Run quickstart.md validation scenarios end-to-end — verify Scenarios 1–4 from `specs/075-moderator-quality-checker/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. All 3 tasks (T001, T002, T003) are parallelizable.
- **Foundational (Phase 2)**: Depends on Phase 1 completion. T004 depends on T003. T005 depends on T004. T006 depends on T005. T007 depends on T005. T008 depends on T001, T002, T007.
- **US1 (Phase 3)**: Depends on Phase 2. T009 and T010 are parallelizable. T011 depends on T009, T010, T008. T012 depends on T011.
- **US2 (Phase 4)**: Depends on Phase 2 (and US1 for workspace container). T013 and T015 are parallelizable. T014 depends on T013 (shared file). T016 depends on T015. T017 depends on T014, T016, T011. T018 depends on T008.
- **US3 (Phase 5)**: Depends on US2 (extends AI scan and issue card). T019, T020, T021 are sequential within their files.
- **US4 (Phase 6)**: Depends on US2 (needs issue review panel). T022, T023, T024 are sequential.
- **Polish (Phase 7)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational phase — no dependencies on other stories
- **US2 (P1)**: Can start after Foundational phase — uses workspace container from US1 but the core analysis engine is independent
- **US3 (P2)**: Extends US2's AI scan engine and issue card — depends on US2
- **US4 (P3)**: Extends US2's issue review panel — depends on US2

### Within Each User Story

- Models/types before services
- Services before UI components
- Container components after child components
- App.tsx integration last (US1 only)

### Parallel Opportunities

- Phase 1: T001, T002, T003 — all parallelizable (different files, no dependencies)
- Phase 3: T009, T010 — parallelizable (different component files)
- Phase 4: T013, T015 — parallelizable (different files)
- Phase 7: T025, T026 — parallelizable (different test files)

---

## Parallel Example: Phase 1

```bash
# Launch all setup tasks together:
Task: "Define TypeScript types in src/types/hakoChecker.ts"
Task: "Implement session store in src/services/hakoSessionStore.ts"
Task: "Implement Hako scraper in server/services/hakoScraperService.ts"
```

## Parallel Example: User Story 1

```bash
# Launch UI component tasks together:
Task: "Create HakoNovelImporter in src/components/hako-checker/HakoNovelImporter.tsx"
Task: "Create HakoChapterSelector in src/components/hako-checker/HakoChapterSelector.tsx"
# Then sequentially:
Task: "Create HakoCheckerWorkspace in src/components/hako-checker/HakoCheckerWorkspace.tsx"
Task: "Integrate tab into src/App.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008)
3. Complete Phase 3: User Story 1 (T009–T012)
4. **STOP and VALIDATE**: Test novel import + chapter selection independently
5. Complete Phase 4: User Story 2 (T013–T018)
6. **STOP and VALIDATE**: Test full heuristic + AI analysis pipeline with decision persistence
7. Deploy/demo if ready — this is the core MVP

### Incremental Delivery

1. Setup + Foundational → Pipeline ready
2. Add US1 → Novel import works → Demo
3. Add US2 → Quality analysis works → Demo (MVP!)
4. Add US3 → Bilingual deep check works → Demo
5. Add US4 → Report export works → Demo
6. Polish → Tests, edge-cases, i18n → Release

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup (Phase 1) together — all 3 tasks parallelizable
2. Once Setup done, one developer handles server (T004–T006), another handles client (T007–T008)
3. Once Foundational done:
   - Developer A: US1 UI components (T009–T012)
   - Developer B: US2 analysis engine (T013–T014)
4. After US1+US2 merge: US3 and US4 can proceed independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [USn] label maps task to specific user story for traceability
- Each user story is independently completable and testable (after prerequisites)
- Constitution Principle III strictly enforced: zero changes to existing translation controllers, routes, or IndexedDB stores
- Constitution Principle IV strictly enforced: zero changes to `src/types.ts` or `src/services/db.ts`
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
