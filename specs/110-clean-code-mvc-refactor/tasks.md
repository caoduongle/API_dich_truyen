# Tasks: Clean Code & MVC Refactor

**Feature**: 110-clean-code-mvc-refactor
**Branch**: `110-clean-code-mvc-refactor`
**Date**: 2026-09-12
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify baseline health before any changes and create target directories.

- [x] T001 Run baseline verification: `npm run lint && npm test && npm run build` — all must pass before any changes
- [x] T002 Create new directory `src/config/` for application configuration
- [x] T003 [P] Create new directory `src/config/__tests__/` for config tests
- [x] T004 [P] Create new directory `src/services/ai/` for AI prompt engineering services
- [x] T005 [P] Create new directory `src/lib/__tests__/` for library tests
- [x] T006 [P] Create new directory `src/components/layout/` for app shell components

**Checkpoint**: Baseline green, target directories exist.

---

## Phase 2: Foundational — Dead Code Removal (Blocking Prerequisites)

**Purpose**: Remove all confirmed dead artifacts before structural changes. This MUST complete before any file relocation to avoid moving dead code.

> **CRITICAL**: No relocation work (Phase 3+) can begin until dead code is cleaned.

- [x] T007 [US1] Verify `QuotaStatusResponse` type in `src/utils/apiClient.ts` — grep all importers. If unused, delete file. If still imported, move type to `src/types/quota.ts` and update importers, then delete `src/utils/apiClient.ts`
- [x] T008 [P] [US1] Delete `SERVER_CONFIG` export and its associated constants from `shared/constants.ts` (keep `AI_SERVICE_CONFIG`, `GLOSSARY_LIMITS`, `UI_CONFIG`, `STORAGE_CONFIG` intact)
- [x] T009 [P] [US1] Update `shared/__tests__/constants.test.ts` — remove test assertions for `SERVER_CONFIG`, keep tests for remaining live constants
- [x] T010 [P] [US1] Delete `database/` directory (contains only `database/migrations/001_rls_policies.sql` — dead Supabase schema)
- [x] T011 [P] [US1] Archive `docs/api.md` — move to `docs/archive/api-express-legacy.md` (defunct Express endpoint documentation)
- [x] T012 [P] [US1] Remove `esbuild` from `devDependencies` in `package.json` and run `npm install` to update lockfile
- [x] T013 [US1] Run verification: `npm run lint && npm test && npm run build` — must pass after dead code removal

**Checkpoint**: All dead artifacts removed. Codebase is clean of legacy server references in code paths.

---

## Phase 3: User Story 3 — `shared/` → `src/` Relocation (Priority: P1)

**Goal**: Relocate all 7 actively-used `shared/` modules + 3 test files into `src/`, remove `@shared/*` alias, delete `shared/` directory.

**Independent Test**: `grep -r "@shared/" src/ shared/ tsconfig.json vite.config.ts` returns zero results. `npm run lint && npm test && npm run build` all pass.

### Step 3a: Move utility files to `src/lib/`

- [x] T014 [P] [US3] Move `shared/text.ts` → `src/lib/text.ts`
- [x] T015 [P] [US3] Move `shared/sinoNormalize.ts` → `src/lib/sinoNormalize.ts`
- [x] T016 [P] [US3] Move `shared/parser.ts` → `src/lib/parser.ts`
- [x] T017 [P] [US3] Move `shared/__tests__/text.test.ts` → `src/lib/__tests__/text.test.ts`
- [x] T018 [P] [US3] Move `shared/__tests__/sinoNormalize.test.ts` → `src/lib/__tests__/sinoNormalize.test.ts`

### Step 3b: Move config files to `src/config/`

- [x] T019 [P] [US3] Move `shared/constants.ts` → `src/config/constants.ts`
- [x] T020 [P] [US3] Move `shared/models.ts` → `src/config/models.ts`
- [x] T021 [P] [US3] Move `shared/__tests__/constants.test.ts` → `src/config/__tests__/constants.test.ts`

### Step 3c: Move AI prompt files to `src/services/ai/`

- [x] T022 [P] [US3] Move `shared/prompts.ts` → `src/services/ai/prompts.ts`
- [x] T023 [P] [US3] Move `shared/glossaryPrompts.ts` → `src/services/ai/glossaryPrompts.ts`

### Step 3d: Fix internal cross-references within moved files

- [x] T024 [US3] Update imports in `src/services/ai/prompts.ts` — change `@shared/glossaryPrompts` → `./glossaryPrompts`, `@shared/text` → `@/src/lib/text`, `@shared/sinoNormalize` → `@/src/lib/sinoNormalize`
- [x] T025 [P] [US3] Update imports in `src/lib/text.ts` — change `@shared/constants` → `@/src/config/constants`
- [x] T026 [P] [US3] Update imports in `src/services/ai/glossaryPrompts.ts` — change `@shared/sinoNormalize` → `@/src/lib/sinoNormalize`

### Step 3e: Update all 20 importers in `src/` (grouped by target module)

**`@shared/models` importers (8 files)**:
- [x] T027 [P] [US3] Update import in `src/services/directGeminiClient.ts` — `@shared/models` → `@/src/config/models`
- [x] T028 [P] [US3] Update import in `src/services/localQuotaTracker.ts` — `@shared/models` → `@/src/config/models`
- [x] T029 [P] [US3] Update import in `src/hooks/useAIConfig.ts` — `@shared/models` → `@/src/config/models`
- [x] T030 [P] [US3] Update import in `src/hooks/useModelDiscovery.ts` — `@shared/models` → `@/src/config/models`
- [x] T031 [P] [US3] Update import in `src/components/ApiSettings.tsx` — `@shared/models` → `@/src/config/models`
- [x] T032 [P] [US3] Update import in `src/components/QuotaPanel.tsx` — `@shared/models` → `@/src/config/models`
- [x] T033 [P] [US3] Update import in `src/components/auto-translator/TranslationConfigPanel.tsx` — `@shared/models` → `@/src/config/models`
- [x] T034 [P] [US3] Update import in `src/components/quota-panel/GroupQuotaCard.tsx` — `@shared/models` → `@/src/config/models`

**`@shared/text` importers (5 files)**:
- [x] T035 [P] [US3] Update import in `src/services/directTranslationEngine.ts` — `@shared/text` → `@/src/lib/text`
- [x] T036 [P] [US3] Update import in `src/services/chapterTranslationService.ts` — `@shared/text` → `@/src/lib/text`
- [x] T037 [P] [US3] Update import in `src/services/hakoQualityEngine.ts` — `@shared/text` → `@/src/lib/text`
- [x] T038 [P] [US3] Update import in `src/services/zuminovelPublishService.ts` — `@shared/text` → `@/src/lib/text`
- [x] T039 [P] [US3] Update import in `src/hooks/useTranslationProcess.ts` — `@shared/text` → `@/src/lib/text`

**`@shared/constants` importers (4 files)**:
- [x] T040 [P] [US3] Update import in `src/services/localQuotaTracker.ts` — `@shared/constants` → `@/src/config/constants`
- [x] T041 [P] [US3] Update import in `src/services/auditBridgeService.ts` — `@shared/constants` → `@/src/config/constants`
- [x] T042 [P] [US3] Update import in `src/hooks/useGlossaryScan.ts` — `@shared/constants` → `@/src/config/constants`
- [x] T043 [P] [US3] Update import in `src/hooks/useHakoReviewSession.ts` — `@shared/constants` → `@/src/config/constants`

**`@shared/prompts` importers (2 files)**:
- [x] T044 [P] [US3] Update import in `src/services/directTranslationEngine.ts` — `@shared/prompts` → `@/src/services/ai/prompts`
- [x] T045 [P] [US3] Update import in `src/services/directGlossaryEngine.ts` — `@shared/prompts` → `@/src/services/ai/prompts`

**`@shared/sinoNormalize` importers (2 files)**:
- [x] T046 [P] [US3] Update import in `src/services/directGlossaryEngine.ts` — `@shared/sinoNormalize` → `@/src/lib/sinoNormalize`
- [x] T047 [P] [US3] Update import in `src/hooks/useGlossaryApply.ts` — `@shared/sinoNormalize` → `@/src/lib/sinoNormalize`

**`@shared/glossaryPrompts` importers (1 file — already handled in T045 as directGlossaryEngine also imports prompts)**:
- [x] T048 [P] [US3] Update import in `src/services/directGlossaryEngine.ts` — `@shared/glossaryPrompts` → `@/src/services/ai/glossaryPrompts`

**`@shared/models` re-export barrel**:
- [x] T049 [US3] Delete `src/constants/models.ts` (barrel re-export replaced by direct `src/config/models.ts`). Update any files that imported from `src/constants/models` to import from `@/src/config/models` instead
- [x] T050 [US3] Delete `src/constants/` directory if empty after T049

### Step 3f: Remove alias and delete shared/

- [x] T051 [US3] Remove `@shared/*` path alias from `tsconfig.json` (delete the `"@shared/*": ["./shared/*"]` entry from `paths`)
- [x] T052 [US3] Remove `@shared` alias from `vite.config.ts` (delete the `'@shared': path.resolve(__dirname, './shared')` entry from `resolve.alias`)
- [x] T053 [US3] Delete `shared/` directory entirely (all files have been relocated)
- [x] T054 [US3] Run verification: `npm run lint && npm test && npm run build` — must pass after full relocation

**Checkpoint**: `shared/` directory gone. All `@shared/*` imports replaced. Tests pass. Zero legacy path references remain.

---

## Phase 4: User Story 4 — `App.tsx` Decomposition (Priority: P2)

**Goal**: Extract 6 inline sub-components from `App.tsx` (1156 lines) into `src/components/layout/`, reducing `App.tsx` to < 200 lines.

**Independent Test**: `wc -l src/App.tsx` shows < 200. All tabs load. Hotkeys work. Theme/language switching works.

- [x] T055 [US4] Extract `AppHeader` section (~lines 182–350) into `src/components/layout/AppHeader.tsx` — toolbar: theme switcher, language selector, Google user button, AI config button, mobile menu drawer
- [x] T056 [US4] Extract `AppTabBar` section (~lines 352–480) into `src/components/layout/AppTabBar.tsx` — horizontal tab navigation with scroll overflow detection, keyboard nav, active tab indicator
- [x] T057 [US4] Extract `TabContent` section (~lines 482–620) into `src/components/layout/TabContent.tsx` — lazy-loaded tab panels with React.Suspense boundaries and ErrorBoundary wrappers
- [x] T058 [US4] Extract `AppFooter` section (~lines 622–900) into `src/components/layout/AppFooter.tsx` — copyright bar, GitHub link, policy modals (privacy policy + terms of use with full content)
- [x] T059 [P] [US4] Extract `ApiSettingsModal` wrapper (~lines 902–1000) into `src/components/layout/ApiSettingsModal.tsx` — modal shell wrapping the ApiSettings component
- [x] T060 [P] [US4] Extract `GoogleSyncSection` (~lines 1002–1100) into `src/components/layout/GoogleSyncSection.tsx` — Drive sync button and GoogleSyncModal orchestration
- [x] T061 [US4] Refactor `src/App.tsx` — replace inline sections with imports from `src/components/layout/`. App.tsx should contain only: provider stack (ThemeProvider → I18nProvider → NotificationProvider → AIConfigProvider → ProjectProvider) and `<AppShell />` that composes the extracted layout components
- [x] T062 [US4] Verify `src/App.tsx` is under 200 lines: `wc -l src/App.tsx`
- [x] T063 [US4] Run verification: `npm run lint && npm test && npm run build` — must pass after decomposition

**Checkpoint**: `App.tsx` is a thin shell. Each layout component is self-contained with a single responsibility. All UI behavior preserved.

---

## Phase 5: User Story 5 — Documentation Update (Priority: P2)

**Goal**: Update all documentation to accurately reflect the current client-side-only architecture.

**Independent Test**: Read `README.md`, `AGENTS.md`, `SECURITY.md`, and constitution — none reference Express, ioredis, Redis, `server/`, or Supabase as active architecture.

- [x] T064 [P] [US5] Update `AGENTS.md` — remove `Backend: Express + ioredis, chạy trong cùng repo (server/)`. Update build command description to `tsc && vite build` (no esbuild server). Update deny-list to remove `server/` references. Update description to describe client-side SPA with IndexedDB + direct Gemini API + Google Drive sync
- [x] T065 [P] [US5] Update `SECURITY.md` — rewrite to describe client-side security model: API keys stored in `sessionStorage` (not server-side), CSP headers via `vercel.json`, Google OAuth 2.0 PKCE from browser, `localQuotaTracker` for rate limiting (not Redis). Remove all references to `REDIS_URL`, server-side sessions, server validation
- [x] T066 [P] [US5] Update `README.md` — replace Express/Redis architecture with: React 19 + Vite SPA, IndexedDB persistence, `@google/genai` client SDK calling Gemini API directly from browser, optional Google Drive v3 sync, 3-phase translation pipeline (raw → polish → QA critique). Remove REDIS_URL from setup instructions. Remove backend port 3001 references
- [x] T067 [US5] Update `.specify/memory/constitution.md` — Technology Stack section: replace `Backend & Caching: Express.js server, Node.js, ioredis` with `Storage & Sync: IndexedDB (Dexie), Google Drive v3 REST API (optional cloud sync)`. Update AI Integration to describe 3-phase workflow. Remove `server/routes` from Principle V. Remove `ioredis` from Principle II examples. Bump version 1.0.0 → 2.0.0 with amendment rationale
- [x] T068 [P] [US5] Clean up `merge.py` — update or remove references to `server.ts` and `server/` paths (lines 39–40). If the script is no longer useful, archive to `docs/archive/`
- [x] T069 [US5] Run verification: `npm run lint && npm test && npm run build` — must pass after documentation updates

**Checkpoint**: All documentation accurately describes the current pure client-side architecture. Constitution bumped to v2.0.0.

---

## Phase 6: User Story 6 — Collocated Hook Extraction (Priority: P3)

**Goal**: Move `useWorkspaceState.ts` (37KB/921 lines) and `useGlossaryState.ts` (19KB/487 lines) from inside component directories to `src/hooks/` for proper MVC separation.

**Independent Test**: `find src/components -name "use*.ts" -o -name "use*.tsx"` returns zero results. All hooks live in `src/hooks/`.

- [x] T070 [US6] Move `src/components/translator-workspace/useWorkspaceState.ts` → `src/hooks/useWorkspaceState.ts`
- [x] T071 [US6] Update all imports of `useWorkspaceState` — at minimum `src/components/TranslatorWorkspace.tsx` and `src/components/translator-workspace/BilingualEditor.tsx` need their relative imports (`./useWorkspaceState` or `../translator-workspace/useWorkspaceState`) changed to `@/src/hooks/useWorkspaceState`
- [x] T072 [US6] Move `src/components/glossary-manager/useGlossaryState.ts` → `src/hooks/useGlossaryState.ts`
- [x] T073 [US6] Update all imports of `useGlossaryState` — at minimum `src/components/GlossaryManager.tsx` needs its import changed to `@/src/hooks/useGlossaryState`
- [x] T074 [US6] Run verification: `npm run lint && npm test && npm run build` — must pass after hook relocation

**Checkpoint**: No hook files remain inside `src/components/`. All controller logic lives in `src/hooks/`. MVC boundary enforced.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cross-layer dependency check, and cleanup.

- [x] T075 Verify no circular imports between MVC layers — services must NOT import from components or hooks; hooks must NOT import from components. Run: `grep -r "from.*components/" src/services/ src/hooks/ --include="*.ts"` — should return zero results
- [x] T076 [P] Verify no `@shared/` references remain anywhere: `grep -r "@shared/" src/ tsconfig.json vite.config.ts` — should return zero results
- [x] T077 [P] Verify no hook files in components: `find src/components -name "use*.ts" -o -name "use*.tsx"` — should return zero results
- [x] T078 [P] Verify `App.tsx` line count: `wc -l src/App.tsx` — must be under 200
- [x] T079 Run full quickstart validation guide from [quickstart.md](quickstart.md) — all 9 validation scenarios must pass
- [x] T080 Final verification: `npm run lint && npm test && npm run build` — must pass clean

**Checkpoint**: All success criteria from spec met. Codebase follows MVC architecture. Ready for merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Dead Code)**: Depends on Phase 1 — **BLOCKS** all relocation phases
- **Phase 3 (shared/ relocation)**: Depends on Phase 2 — must have clean codebase before moving files
- **Phase 4 (App.tsx decomposition)**: Depends on Phase 1 only — **CAN run in parallel** with Phase 3
- **Phase 5 (Documentation)**: No code dependencies — **CAN run in parallel** with Phases 3, 4, 6
- **Phase 6 (Hook extraction)**: Depends on Phase 1 only — **CAN run in parallel** with Phases 3, 4
- **Phase 7 (Polish)**: Depends on all previous phases

### User Story Dependencies

```
US1 (Dead Code) ──→ US3 (shared/ relocation) ──→ US6 (Hook extraction) ──→ Phase 7
                 ↘                                                        ↗
                   US4 (App.tsx decomposition) ────────────────────────────
                 ↘                                                        ↗
                   US5 (Documentation) ────────────────────────────────────
```

- **US1 (Dead Code)**: Must complete first — prerequisite for all
- **US3 (shared/ relocation)**: Depends on US1. Core structural change.
- **US4 (App.tsx)**: Can run in parallel with US3 (no file overlap)
- **US5 (Documentation)**: Can run in parallel with US3/US4/US6
- **US6 (Hook extraction)**: Can run in parallel with US3/US4

### Parallel Opportunities

After Phase 2 (dead code) completes, these can run **simultaneously**:
- Worker A: Phase 3 (shared/ relocation — 41 tasks, highest volume)
- Worker B: Phase 4 (App.tsx decomposition — 9 tasks)
- Worker C: Phase 5 (Documentation — 6 tasks)

Phase 6 (hook extraction — 5 tasks) can also run in parallel with above.

---

## Parallel Example: Phase 3 (shared/ relocation)

```text
# All file moves can happen simultaneously (Step 3a+3b+3c):
T014–T023: Move 10 files in parallel (no dependencies between moves)

# Then fix internal cross-references (Step 3d):
T024–T026: Fix 3 files with internal @shared/ imports (parallel)

# Then update all 20 external importers (Step 3e):
T027–T050: All import updates are independent files — run all in parallel

# Finally, clean up alias and delete shared/ (Step 3f):
T051–T054: Sequential (alias removal → directory deletion → verify)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Dead code removal (US1)
3. Complete Phase 3: shared/ relocation (US3)
4. **STOP and VALIDATE**: `npm run lint && npm test && npm run build`
5. The codebase now has clean MVC-aligned directory structure

### Incremental Delivery

1. Phase 1 + 2 → Dead code cleaned ✓
2. Phase 3 → shared/ relocated, `@shared` alias gone ✓
3. Phase 4 → App.tsx decomposed to < 200 lines ✓
4. Phase 5 → All docs accurate ✓
5. Phase 6 → Hooks properly layered ✓
6. Phase 7 → Full validation ✓

Each phase is independently committable and the codebase remains functional at every checkpoint.

---

## Notes

- [P] tasks = different files, no dependencies — can execute in parallel
- [USn] label maps task to specific user story from spec.md
- Every phase ends with a `npm run lint && npm test && npm run build` gate (Constitution Principle I)
- No logic changes in any task — all changes are file moves, import path updates, and documentation rewrites
- If any verification step fails, fix the issue before proceeding to the next phase
- The `@/` alias maps to repo root per `tsconfig.json` — use `@/src/...` for imports within the `src/` tree
