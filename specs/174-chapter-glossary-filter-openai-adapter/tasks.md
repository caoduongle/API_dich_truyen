---

description: "Task list for Lọc Từ điển Chặt theo Chương & Cổng Kết nối Chuẩn OpenAI (/v1/chat/completions)"
---

# Tasks: Lọc Từ điển Chặt theo Chương & Cổng Kết nối Chuẩn OpenAI (`/v1/chat/completions`)

**Input**: Design documents from `/specs/174-chapter-glossary-filter-openai-adapter/`  
**Prerequisites**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/plan.md), [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/spec.md), [research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/research.md), [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/data-model.md), [provider-and-glossary-contracts.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/contracts/provider-and-glossary-contracts.md)

**Tests**: Unit and integration tests are included per phase based on the existing Vitest setup and test strategy in `plan.md` / `quickstart.md` so each user story is independently verifiable without regressing Gemini defaults.

**Organization**: Tasks are grouped by user story (`US1`–`US4`) with foundational pre-implementation review safeguards built into Phases 1–2 (`hasActiveAICredentials`, strict hostname parsing, `AIza...` isolation invariant, schema `strict: false` + non-`OBJECT` fallback, `<think>` scrubbing before `{`/`[` scan, and optional `includePinnedGlossary` fallback).

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`, `US4`) — omitted in Setup, Foundational, and Polish phases

---

## Phase 1: Setup (Shared Types, Presets & Storage)

**Purpose**: Define shared AI provider types, preset catalog + strict URL validation, and isolated client-side config/credential storage boundaries without touching `src/types.ts` or IndexedDB (`src/services/db.ts`).

- [X] T001 [P] Create `AIProviderMode`, `OpenAICompatiblePresetId`, `OpenAIResponseFormatTier`, `OpenAICompatiblePreset`, `OpenAICompatibleConfig`, and `AIProviderConfig` types in `src/types/aiProvider.ts`
- [X] T002 [P] Create `OPENAI_COMPATIBLE_PRESETS` (DeepSeek, Qwen, Groq, NVIDIA NIM, Ollama, LM Studio, Custom), strict `new URL().hostname` `isLocalProviderUrl` (`localhost` / `127.0.0.1` / `[::1]`), `validateProviderBaseUrl` (enforce HTTPS for non-local hosts), and `buildOpenAICompatibleEndpoint` in `src/config/aiProviders.ts`
- [X] T003 Create client-side storage and credential helpers (`getStoredAIProviderConfig`, `saveStoredAIProviderConfig`, `loadOpenAIApiKeys`, `saveOpenAIApiKeys` with `sessionStorage` + opt-in `app_ui_prefs.savedOpenAIKeys` scrub on `rememberKeys === false`, `getIncludePinnedGlossaryPreference`, `setIncludePinnedGlossaryPreference`, `hasActiveAICredentials(geminiApiKeys)`, `maskSecretKey`) in `src/utils/aiProviderStorage.ts` without importing `modelRegistry.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core parsing, schema conversion, and strict chapter glossary selection primitives required across user stories.

**⚠️ CRITICAL**: Complete Phase 1 and Phase 2 before implementing user story integrations.

- [X] T004 [P] Implement `stripModelThinkingBlocks` (case-insensitive `<think>...</think>` removal with safe handling of unclosed `<think>`) and invoke it at the top of `safeParseJson` (before `JSON.parse` and brace/bracket scanning) in `src/lib/text.ts`
- [X] T005 [P] Create `convertGeminiSchemaToJsonSchema` (`strict: false` default; skip `json_schema` tier when root `type !== 'OBJECT'`, such as root `ARRAY` in `buildExtractGlossaryPayload`) and `buildJsonInstructionHint` in `src/services/openai/openaiSchemaAdapter.ts`
- [X] T006 Implement `filterGlossaryForChapter` (`includePinned = false`, `maxPinned = 0` by default, returning `entries`, `matchedInSource`, `conflicts`, `totalCount`, `filteredCount`) in `src/lib/glossaryMatch.ts` while preserving existing `selectRelevantGlossary` default behavior (`maxPinned = 50`)

**Checkpoint**: Shared configuration, security guards, schema adapter, `<think>` stripper, and strict glossary filter primitives are ready.

---

## Phase 3: User Story 1 - Chạy trọn vẹn pipeline Dịch thô → Chuốt văn → QA Critique qua cổng chuẩn `/v1/chat/completions` (Priority: P1) 🎯 MVP

**Goal**: Enable the entire translation pipeline (Raw Translation → 3-pass Polish → QA Critique → Targeted Repair → Sentence Rewrite → Glossary Extraction) to route through `/v1/chat/completions` when `openai-compatible` mode is active, while keeping Gemini mode 100% untouched and supporting keyless local servers across all entry points.

**Independent Test**: Configure an OpenAI-compatible profile (mocked `/v1/chat/completions` or local Ollama/LM Studio with empty API keys), run full 3-stage translation + targeted repair + entity extraction, verify Gemini `AIza...` keys and `gemini-*` model names are never sent to the OpenAI endpoint, and verify switching back to `gemini` restores identical Gemini key rotation and quota tracking.

### Implementation & Verification for User Story 1

- [X] T007 [US1] Implement `callOpenAICompatible`, `listOpenAIModels`, and `testOpenAIConnection` in `src/services/openai/openaiClient.ts` (invariant: always resolve `baseUrl`, `model`, and `apiKeys` from `getStoredAIProviderConfig()` + `loadOpenAIApiKeys()` unless `overrideConfig` is passed, never forwarding Gemini caller's `options.apiKeys` or `options.model`; omit `Authorization` when local keyless; reuse `localQuotaTracker` with `openai:${host}:` prefix for remote multi-key rotation; honor `AbortSignal` and `timeoutMs`)
- [X] T008 [US1] Route `callGeminiDirect` in `src/services/directGeminiClient.ts` to `callOpenAICompatible(options)` when `providerMode === 'openai-compatible'` while keeping `'gemini'` 100% identical to `callGemini(options)`
- [X] T009 [US1] Replace ad-hoc `apiKeys.length === 0` guards with `hasActiveAICredentials(apiKeys)` in `src/services/chapterTranslationService.ts`, `src/hooks/useTranslationProcess.ts`, `src/hooks/useWorkspaceState.ts` (all 5 single-chapter actions), `src/hooks/useGlossaryScan.ts`, `src/services/translation/targetedRepair.ts`, `src/services/directGlossaryEngine.ts`, and `src/services/hakoQualityEngine.ts`; update translation header logs in `src/hooks/useTranslationProcess.ts` and `src/services/chapterTranslationService.ts` to display the active OpenAI provider and model when in OpenAI-compatible mode
- [X] T010 [P] [US1] Add unit/integration tests verifying OpenAI routing, Gemini isolation (no `AIza...` key or Gemini model leakage), keyless local requests, and remote multi-key rotation in `src/services/openai/__tests__/openaiClient.test.ts` and `src/services/__tests__/directGeminiClient.test.ts`

**Checkpoint**: User Story 1 is functional and independently testable as the MVP — full pipeline execution works via `/v1/chat/completions` or Gemini with zero key leakage.

---

## Phase 4: User Story 2 - Lọc từ điển chặt theo văn bản nguồn của chương (`filter_glossary`) trên mọi bước gọi AI (Priority: P1)

**Goal**: Filter project glossaries (e.g., 577 entries) strictly against each chapter or chunk's source text across GĐ1, GĐ2, GĐ3, targeted repair, and glossary analysis (defaulting `includePinned` to OFF via `getIncludePinnedGlossaryPreference()`), log the matched ratio (`X/Y mục`), and expose an opt-in override toggle.

**Independent Test**: Run prompt generation and chapter translation on a 577-entry glossary fixture (with 120 pinned terms) where only 18 terms appear in the chapter source text; confirm GĐ1, GĐ2, GĐ3, `targetedRepair`, and `buildAnalyzeGlossaryPayload` receive only the 18 chapter-matched terms by default, log `[Lọc từ điển] Khớp 18/577 mục trong chương hiện tại.`, and include pinned terms only when explicitly toggled ON.

### Implementation & Verification for User Story 2

- [X] T011 [US2] Wire `filterGlossaryForChapter` (defaulting `includePinned` via `params.includePinnedGlossary ?? getIncludePinnedGlossaryPreference()`) into `buildRawTranslationPayload`, `buildPolishTranslationPayload`, `buildQaCritiquePayload`, and `buildAnalyzeGlossaryPayload` (filtering `knownGlossaryEntries`/`knownChineseTerms` to source-matched terms) in `src/services/ai/prompts.ts`
- [X] T012 [P] [US2] Wire `filterGlossaryForChapter` (defaulting `includePinned` via `getIncludePinnedGlossaryPreference()`) into `src/services/translation/targetedRepair.ts`
- [X] T013 [US2] Add `[Lọc từ điển] Khớp ${filteredCount}/${totalCount} mục trong chương hiện tại.` log entry when `totalCount > 0` in `src/services/chapterTranslationService.ts`
- [X] T014 [US2] Add opt-in toggle **"Đính kèm cả từ điển ghim ngoài chương"** (default OFF) in `src/components/api-settings/TranslationQualitySection.tsx`
- [X] T015 [P] [US2] Add unit tests covering 577-entry glossary filtering (`<= 20` matched), simplified/traditional + variants matching, zero-match chapter, opt-in pinned mode, and `buildAnalyzeGlossaryPayload` filtering in `src/lib/__tests__/glossaryMatch.test.ts` and `src/services/ai/__tests__/prompts.test.ts`

**Checkpoint**: User Story 2 is independently verifiable across all AI steps and UI preferences without altering Gemini or OpenAI transport behavior.

---

## Phase 5: User Story 3 - Cấu hình mẫu nhanh (Preset), tải mô hình `/v1/models`, chạy local không cần Key & kiểm tra kết nối (Priority: P1)

**Goal**: Provide a clean "Mực & Chu Sa" UI and `useAIConfig` state orchestration to switch between Google Gemini and OpenAI-compatible mode, select from 7 quick presets, allow empty keys for local URLs, load models via `/v1/models`, and run an instant connection test.

**Independent Test**: Open AI Settings, switch between Gemini and OpenAI-compatible modes, select `Ollama (Local)` (empty API key allowed) and `DeepSeek` (HTTPS + API key required), trigger `/v1/models` load and connection test, and verify `savedOpenAIKeys` scrubbing when `rememberKeys` is turned off.

### Implementation & Verification for User Story 3

- [X] T016 [US3] Extend `src/hooks/useAIConfig.ts` and `src/context/AIConfigContext.tsx` with `providerMode`, `openAIConfig`, `openAIApiKeys`, `includePinnedGlossary` state/actions and atomic `app_ui_prefs.savedOpenAIKeys` sync/scrubbing with `rememberKeys`
- [X] T017 [US3] Create `src/components/api-settings/OpenAIProviderSection.tsx` following the "Mực & Chu Sa" design system (`Button`, `Badge`, `cn()`, `rounded-[2px]`, `lucide-react`, no emoji) with 7 preset buttons, Base URL input + validation, local keyless notice, masked multi-key list, model selector/input + `/v1/models` fetch button, and connection test button with latency & CORS guidance
- [X] T018 [US3] Add provider mode switcher (**Google Gemini** | **OpenAI-compatible (`/v1/chat/completions`)**) and integrate `OpenAIProviderSection` into `src/components/ApiSettings.tsx` without altering Gemini mode behavior
- [X] T019 [P] [US3] Add unit tests for URL/preset validation, `isLocalProviderUrl` hostname spoofing rejection, `savedOpenAIKeys` scrubbing, and `hasActiveAICredentials` in `src/config/__tests__/aiProviders.test.ts` and `src/utils/__tests__/aiProviderStorage.test.ts`

**Checkpoint**: User Story 3 delivers complete preset configuration, model discovery, keyless local validation, and safe credential persistence.

---

## Phase 6: User Story 4 - Tương thích đầu ra JSON linh hoạt & chẩn đoán lỗi kết nối/CORS rõ ràng (Priority: P2)

**Goal**: Automatically downgrade structured output requirements when OpenAI-compatible servers reject `json_schema` / `json_object`, strip `<think>...</think>` blocks safely during response parsing, and produce actionable Vietnamese diagnostics including local CORS instructions.

**Independent Test**: Simulate HTTP 400/422 format rejections (`json_schema` -> `json_object` -> `prompt_only`), root `ARRAY` schemas (`buildExtractGlossaryPayload`), `<think>{"fake":1}</think>\n```json\n{"real":2}\n``` `, unclosed `<think>` edge cases, and local `TypeError` network failures; confirm seamless recovery and clear Vietnamese CORS guidance without exposing raw API keys.

### Implementation & Verification for User Story 4

- [X] T020 [US4] Implement per-session `(baseUrl, model)` `response_format` tier caching & downgrade (`json_schema` -> `json_object` -> `prompt_only` on HTTP 400/422 format rejection, direct `prompt_only` for non-object root schemas) and Vietnamese error normalization (`401/403`, `404`, `429`, timeout, local `TypeError` CORS instructions) in `src/services/openai/openaiClient.ts`
- [X] T021 [P] [US4] Add unit tests for `<think>...</think>` stripping (including `{` inside `<think>` and unclosed `<think>`), schema adapter `OBJECT` vs root `ARRAY`, tier fallback caching, and local CORS diagnostics in `src/lib/__tests__/text.test.ts` and `src/services/openai/__tests__/openaiSchemaAdapter.test.ts`

**Checkpoint**: User Story 4 handles real-world OpenAI/local LLM quirks gracefully without breaking structured pipeline outputs.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: End-to-end verification across lint, tests, production build, schema immutability, and quickstart validation.

- [X] T022 Run `npm run lint`, `npm test`, and `npm run build`; verify `src/types.ts` and `src/services/db.ts` remain untouched; validate scenarios against `specs/174-chapter-glossary-filter-openai-adapter/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — `T001` and `T002` can run in parallel; `T003` follows `T001`/`T002`.
- **Foundational (Phase 2)**: Depends on Phase 1 (`T001`–`T003`). `T004`, `T005`, and `T006` touch independent files and can run in parallel.
- **User Story 1 (Phase 3 — P1 MVP)**: Depends on Phase 1 & Phase 2 (`T007` -> `T008` -> `T009`, followed/accompanied by `T010`).
- **User Story 2 (Phase 4 — P1)**: Depends on `T003` and `T006` (`T011`, `T012`, `T014` touch separate files and can run in parallel; `T013` edits `chapterTranslationService.ts` after `T009` if run alongside US1).
- **User Story 3 (Phase 5 — P1)**: Depends on `T001`–`T003` and `T007` (`T016` -> `T017`/`T018`; `T019` can run in parallel once `T002`/`T003` exist).
- **User Story 4 (Phase 6 — P2)**: Depends on `T004`, `T005`, and `T007` (`T020` extends `openaiClient.ts` after `T007`; `T021` runs in parallel).
- **Polish (Phase 7)**: Depends on `T001`–`T021` completion (`T022`).

### Parallel Opportunities

- **Phase 1**: `T001` (`src/types/aiProvider.ts`) || `T002` (`src/config/aiProviders.ts`).
- **Phase 2**: `T004` (`src/lib/text.ts`) || `T005` (`src/services/openai/openaiSchemaAdapter.ts`) || `T006` (`src/lib/glossaryMatch.ts`).
- **Across Stories after Phase 2**: US2 (`T011`, `T012`, `T014`, `T015`) can proceed in parallel with US1 core adapter (`T007`, `T008`) — only coordinate `src/services/chapterTranslationService.ts` between `T009` (US1) and `T013` (US2) and `src/services/openai/openaiClient.ts` between `T007` (US1) and `T020` (US4).

---

## Parallel Example: User Story 1 & User Story 2

```bash
# Parallel Foundational tasks (Phase 2):
Task T004: "Implement stripModelThinkingBlocks & wire safeParseJson in src/lib/text.ts"
Task T005: "Create openaiSchemaAdapter.ts in src/services/openai/openaiSchemaAdapter.ts"
Task T006: "Implement filterGlossaryForChapter in src/lib/glossaryMatch.ts"

# Parallel User Story 2 tasks after Phase 2:
Task T011: "Wire filterGlossaryForChapter into src/services/ai/prompts.ts"
Task T012: "Wire filterGlossaryForChapter into src/services/translation/targetedRepair.ts"
Task T014: "Add opt-in pinned glossary toggle in src/components/api-settings/TranslationQualitySection.tsx"
Task T015: "Add glossary filtering tests in src/lib/__tests__/glossaryMatch.test.ts and src/services/ai/__tests__/prompts.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete **Phase 1: Setup** (`T001`–`T003`).
2. Complete **Phase 2: Foundational** (`T004`–`T006`).
3. Complete **Phase 3: User Story 1** (`T007`–`T010`).
4. **STOP and VALIDATE**: Confirm `/v1/chat/completions` pipeline routing works end-to-end, keyless local mode works across all entry points, and Gemini mode remains intact.

### Incremental Delivery

1. Deliver **Phase 1 + Phase 2 + US1 (`T001`–`T010`)** → Core OpenAI-compatible translation pipeline MVP.
2. Add **US2 (`T011`–`T015`)** → Strict chapter glossary filtering (`filter_glossary`) with ratio logs and opt-in pinned toggle.
3. Add **US3 (`T016`–`T019`)** → Preset switcher, `/v1/models` discovery, local keyless UX, and connection tester.
4. Add **US4 (`T020`–`T021`)** → Dynamic `response_format` tier downgrade, `<think>` safeguards, and CORS diagnostics.
5. Complete **Phase 7 (`T022`)** → Full `npm run lint`, `npm test`, `npm run build`, schema check, and quickstart validation.
