# Tasks: Direct Client Translation for Personal API Keys

**Feature Directory**: `specs/049-direct-client-translation`
**Branch**: `049-direct-client-translation`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verifying workspace build aliases.

- [x] T001 Verify project path aliases `@shared/*` in `tsconfig.json` and `vite.config.ts` for browser/node cross-compatibility

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure and shared modules that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Extract platform-agnostic text utilities, sanitization, regexes, token estimation, and adaptive chunk splitting into `shared/text.ts`
- [x] T003 [P] Extract standardized prompt generators and JSON schemas for Raw Translation, Polish Translation, and QA Critique into `shared/prompts.ts`
- [x] T004 Add unit test coverage for shared text chunking and prompt builders in `shared/__tests__/sharedTranslationLogic.test.ts`
- [x] T005 Update server translation controllers (`server/controllers/translation/rawController.ts`, `server/controllers/translation/polishController.ts`, `server/controllers/translation/qaController.ts`) and `server/utils/text.ts` to consume `@shared/text` and `@shared/prompts`

**Checkpoint**: Foundation ready — shared modules operational and server controllers refactored without breaking existing tests.

---

## Phase 3: User Story 1 - Direct Translation with Personal API Key (Priority: P1) 🎯 MVP

**Goal**: Enable users with configured personal API keys to translate directly between browser and Gemini API without passing through server concurrency queues, caches, or rate limits.

**Independent Test**: Configure a personal key in settings, trigger chapter translation, verify direct outbound HTTP requests to `https://generativelanguage.googleapis.com/v1beta/models/...:generateContent` with `x-goog-api-key`, verify zero requests to `/api/translate-raw` or `/api/polish-translation`, and confirm completed chapter is saved to IndexedDB.

### Tests for User Story 1

- [x] T006 [P] [US1] Unit test direct Gemini REST client and candidate response parsing in `src/services/__tests__/directGeminiClient.test.ts`
- [x] T007 [P] [US1] Unit test direct client translation engine and multi-chunk reassembly in `src/services/__tests__/directTranslationEngine.test.ts`

### Implementation for User Story 1

- [x] T008 [US1] Implement direct browser-to-Gemini REST transport client in `src/services/directGeminiClient.ts`
- [x] T009 [US1] Implement client-side direct translation engine (Phase 1 Raw, Phase 2 Polish, Phase 3 QA Critique) in `src/services/directTranslationEngine.ts`
- [x] T010 [US1] Update `src/services/chapterTranslationService.ts` to detect personal keys and execute direct client translation pipeline

**Checkpoint**: User Story 1 fully functional — personal key users translate directly to Gemini without server bottleneck.

---

## Phase 4: User Story 2 - Uninterrupted Translation via Server Fallback (Priority: P2)

**Goal**: Guarantee that users without personal API keys continue to use the server fallback translation pipeline with 100% backward compatibility.

**Independent Test**: Clear all personal keys in settings, run translation with server fallback enabled, verify requests route to `/api/translate-raw` and `/api/polish-translation` and complete successfully without regression.

### Implementation for User Story 2

- [x] T011 [US2] Unit test server-fallback path in `src/services/__tests__/chapterTranslationService.test.ts` when `apiKeys` is empty
- [x] T012 [US2] Verify server controllers maintain existing fallback behaviors and error handling in `server/controllers/translation/rawController.ts` and `server/controllers/translation/polishController.ts`

**Checkpoint**: User Stories 1 AND 2 both work seamlessly depending on whether personal keys are present.

---

## Phase 5: User Story 3 - Key Rotation & Fault Handling in Direct Mode (Priority: P3)

**Goal**: Provide client-side key rotation across multiple personal keys and localized error reporting upon rate limits or exhausted quota.

**Independent Test**: Provide multiple personal keys where key 1 fails with 429 / 503, verify client automatically attempts key 2 and succeeds or surfaces clear localized error if all keys fail.

### Tests for User Story 3

- [x] T013 [P] [US3] Unit test client-side key rotation and retry logic on 429/503 in `src/services/__tests__/clientKeyRotation.test.ts`

### Implementation for User Story 3

- [x] T014 [US3] Enhance `src/services/directGeminiClient.ts` with multi-key rotation and exponential backoff retry strategies

**Checkpoint**: All user stories functional with client-side fault tolerance and key rotation.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, verification gates, and documentation synchronization.

- [x] T015 Run full typecheck and linting with `npm run lint` (`tsc --noEmit`)
- [x] T016 Run full test suite with `npm test` (`vitest run`)
- [x] T017 Verify production build bundle with `npm run build` (`vite build` + esbuild server)
- [x] T018 Update documentation in `README.md` and `docs/api.md` reflecting direct client translation architecture and zero server bottleneck for personal keys

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and US1 dispatch integration in `chapterTranslationService.ts`.
- **User Story 3 (Phase 5)**: Depends on US1 direct client completion.
- **Polish (Phase 6)**: Runs after all user stories are complete.

### User Story Completion Order

```text
Foundational (Phase 2) ──► User Story 1 (P1: Direct Translation) ──► User Story 2 (P2: Server Fallback) ──► User Story 3 (P3: Key Rotation) ──► Polish & Verification
```

---

## Parallel Opportunities

- **Phase 2**: T002 (`shared/text.ts`) and T003 (`shared/prompts.ts`) can be created in parallel.
- **Phase 3**: T006 (unit test `directGeminiClient.test.ts`) and T007 (unit test `directTranslationEngine.test.ts`) can be developed in parallel before or alongside T008/T009.
- **Phase 5**: T013 (unit test `clientKeyRotation.test.ts`) can be run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational shared modules).
2. Complete Phase 3 (Direct Client Translation engine and hook-up).
3. Validate User Story 1 independently with personal key translation.

### Incremental Delivery
1. Foundation in `shared/` established.
2. User Story 1: Direct client translation eliminates server 50-concurrency bottleneck for personal keys.
3. User Story 2: Server fallback preserved with full regression tests.
4. User Story 3: Client key rotation and error resilience added.
5. Polish: Lint, test suite, production build, and documentation synchronized.
