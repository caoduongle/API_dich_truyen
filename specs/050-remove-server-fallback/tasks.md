# Tasks: Remove Server Translation Fallback & Enforce Personal API Keys

**Feature Directory**: `specs/050-remove-server-fallback`
**Branch**: `050-remove-server-fallback`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup

**Purpose**: Baseline verification before initiating the server fallback deprecation.

- [x] T001 Verify workspace build and test baseline with `npm test` before starting refactoring

---

## Phase 2: Foundational (Backend Fallback Removal)

**Purpose**: Core backend changes that remove server fallback translation and enforce client credentials.

**⚠️ CRITICAL**: Must complete before user story UI and client service integrations.

- [x] T002 [P] Update `server/routes/api.ts` `resolveApiKeysMiddleware` to eliminate `ALLOW_SERVER_KEY_FALLBACK` and return structured HTTP 400 when client credentials are missing
- [x] T003 [P] Update `server/services/geminiService.ts` to remove fallback `process.env.GEMINI_API_KEY` for user translation generation

**Checkpoint**: Server rejects any uncredentialed translation request with HTTP 400.

---

## Phase 3: User Story 1 - Enforce Personal API Key Requirement in UI (Priority: P1) 🎯 MVP

**Goal**: Require users to configure at least one personal Gemini API key to use translation features and prevent uncredentialed translation dispatches.

**Independent Test**: Clear API keys in settings, open Translator Workspace and Auto Translator, verify prominent warning and that translation dispatches are intercepted before network calls are dispatched.

### Tests for User Story 1

- [x] T004 [P] [US1] Unit test pre-flight API key checks and client error handling in `src/services/__tests__/chapterTranslationService.test.ts`

### Implementation for User Story 1

- [x] T005 [US1] Update `src/services/chapterTranslationService.ts` to eliminate server fallback branch and throw explicit client error if `apiKeys` is empty
- [x] T006 [US1] Update `src/components/TranslatorWorkspace.tsx` to use `translateRawDirect` and `polishTranslationDirect` in single-chapter manual mode with pre-flight key validation
- [x] T007 [US1] Update `src/hooks/useTranslationProcess.ts` and `src/hooks/useGlossaryScan.ts` to enforce pre-flight API key validation before queue/scan start
- [x] T008 [US1] Update `src/components/ApiSettings.tsx` and `src/App.tsx` navigation labels to clearly emphasize personal API key requirement for privacy and zero server storage

**Checkpoint**: User Story 1 fully functional — uncredentialed translation is blocked in UI with clear guidance, credentialed users translate directly.

---

## Phase 4: User Story 2 - Complete Elimination of Server-Side Translation Fallback (Priority: P1)

**Goal**: Guarantee that server environment never processes uncredentialed translation requests or falls back to server keys.

**Independent Test**: Dispatch direct HTTP POST requests to `/api/translate-raw` and `/api/polish-translation` with no credentials and verify structured HTTP 400 rejection.

### Implementation for User Story 2

- [x] T009 [P] [US2] Unit test server rejection for uncredentialed requests in `server/routes/__tests__/apiAuth.test.ts`
- [x] T010 [US2] Update `.env.example` to remove `ALLOW_SERVER_KEY_FALLBACK` and clarify zero server translation proxying

**Checkpoint**: Server strictly enforces zero translation proxying without personal keys.

---

## Phase 5: User Story 3 - Server Architecture Audit & Controlled Dead Code Deprecation (Priority: P2)

**Goal**: Verify all server health probes, model discovery, and quota inspection utilities operate cleanly without regressions.

**Independent Test**: Run server test suite and verify `/api/health`, `/api/ready`, `/api/live`, `/api/quota-status`, and model discovery endpoints pass with 100% success.

### Implementation for User Story 3

- [x] T011 [US3] Verify server health probes (`/api/health`, `/api/ready`, `/api/live`) and model registry endpoints continue operating independently in `server/__tests__/`
- [x] T012 [US3] Clean up obsolete test mocks expecting server fallback across `server/` test suites

**Checkpoint**: Server services operate cleanly without dead code or regressions.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, verification gates, and documentation synchronization.

- [x] T013 Run full typecheck with `npm run lint` (`tsc --noEmit`)
- [x] T014 Run full test suite with `npm test` (`vitest run`)
- [x] T015 Verify production build with `npm run build` (`vite build` + esbuild server)
- [x] T016 Update documentation in `README.md` and `docs/api.md` reflecting mandatory personal API keys and zero server storage

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Runs in parallel or directly after US1.
- **User Story 3 (Phase 5)**: Depends on US2 completion.
- **Polish (Phase 6)**: Runs after all user stories are complete.

### User Story Completion Order

```text
Foundational (Phase 2) ──► User Story 1 (P1: UI Guard) ──► User Story 2 (P1: Backend Elimination) ──► User Story 3 (P2: Audit & Stability) ──► Polish & Verification
```

---

## Parallel Opportunities

- **Phase 2**: T002 (`server/routes/api.ts`) and T003 (`server/services/geminiService.ts`) can be edited in parallel.
- **Phase 3**: T004 (unit test in `chapterTranslationService.test.ts`) can be written before implementation T005–T008.
- **Phase 4**: T009 and T010 can be developed in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational backend removal).
2. Complete Phase 3 (UI Guard & Client Direct translation).
3. Validate User Story 1 independently.

### Incremental Delivery
1. Foundation: Server rejects uncredentialed requests.
2. User Story 1: UI guides users to configure personal keys and dispatches direct translation.
3. User Story 2: Environment configuration and server endpoints verified.
4. User Story 3: Health probes and test suites clean.
5. Polish: Lint, full vitest suite (549+ tests), production build, and documentation updated.
