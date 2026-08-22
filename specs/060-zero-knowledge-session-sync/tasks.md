# Tasks: Zero-Knowledge Session Sync

## Feature Overview
- **Branch**: `060-zero-knowledge-session-sync`
- **Spec**: [`specs/060-zero-knowledge-session-sync/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/060-zero-knowledge-session-sync/spec.md)
- **Plan**: [`specs/060-zero-knowledge-session-sync/plan.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/060-zero-knowledge-session-sync/plan.md)

---

## Phase 1: Setup & Baseline Verification

**Purpose**: Verify baseline quality gates before starting modifications.

- [X] T001 Verify baseline test suite passes via `npm test`

---

## Phase 2: Foundational (Prerequisites & Helpers)

**Purpose**: Core sanitization, redaction, and idempotent hashing utilities.

- [X] T002 [P] Update key sanitization & redaction in `shared/text.ts` and `server/utils/logger.ts` to support OpenAI (`sk-...`), Anthropic (`sk-ant-...`), and Google API keys
- [X] T003 [P] Make `hashApiKey` idempotent for 64-char hex strings and update `maskApiKey` in `server/services/quotaService.ts`

**Checkpoint**: Core string utilities and idempotent hashing ready.

---

## Phase 3: User Story 1 - Zero-Knowledge Session Sync Core (Priority: P1) 🎯 MVP

**Goal**: Transform session synchronization from plaintext keys to SHA-256 hex hashes, strip AES-256 encryption from session store, and transition quota status to hash-based indexing.

**Independent Test**: Enter API key in browser, observe `POST /api/session-keys` payload sending `{ keyHashes: ["<64-hex-chars>"] }` with zero plaintext keys, and verify session token validity and quota tracking.

### Implementation & Testing
- [X] T004 [P] [US1] Implement `sha256Hex` and update `syncSessionKeysToServer` in `src/utils/apiClient.ts` to transmit `{ keyHashes: string[] }`
- [X] T005 [P] [US1] Update `validateSessionKeysBody` regex validation (`/^[0-9a-f]{64}$/`) in `server/utils/validation.ts`
- [X] T006 [US1] Refactor `server/services/sessionStore.ts` to store `keyHashes` directly, removing AES-256-GCM encryption methods (`encryptApiKeys`, `decryptApiKeys`) and `ENCRYPTION_MASTER_KEY`
- [X] T007 [US1] Update `server/controllers/sessionController.ts` to process `keyHashes` payload for create/status/delete session handlers
- [X] T008 [P] [US1] Update `server/controllers/quotaController.ts` to accept `keyHashes` and update `fetchQuotaStatus` in `src/utils/apiClient.ts`
- [X] T009 [P] [US1] Update `src/components/QuotaPanel.tsx` to compute key masking client-side and match server quota snapshot by `keyHash`
- [X] T010 [US1] Update and verify unit tests in `server/services/__tests__/sessionStore.test.ts`, `server/controllers/__tests__/sessionController.test.ts`, and `utils/__tests__/credentialStorage.test.ts`

**Checkpoint**: User Story 1 MVP fully functional; session synchronization transmits and stores only one-way cryptographic hashes.

---

## Phase 4: User Story 2 - Client-Direct AI Operations (Priority: P1)

**Goal**: Port model listing, verification, and quick term translation to direct client-to-Gemini requests via `x-goog-api-key`.

**Independent Test**: Discover models, verify model, and translate terms in `QuickAddTermModal.tsx`; verify requests connect directly to Google APIs with zero server intermediary.

### Implementation
- [X] T011 [P] [US2] Implement `listModelsDirect` and `verifyModelDirect` in `src/services/directGeminiClient.ts`
- [X] T012 [P] [US2] Update `src/utils/apiClient.ts` `fetchModelsForKey` and `verifyModel` to delegate to client-direct functions
- [X] T013 [P] [US2] Port `src/components/translator-workspace/QuickAddTermModal.tsx` to call `callGeminiDirect` client-side with shared prompt structure
- [X] T014 [US2] Decommission legacy `/api/models-for-key`, `/api/verify-model`, and `/api/quick-translate-term` server routes in `server/routes/api.ts` and `server/controllers/`

**Checkpoint**: Simple AI operations execute 100% client-to-provider.

---

## Phase 5: User Story 3 - Ephemeral Middleware for Complex Processing (Priority: P2)

**Goal**: Restrict raw key transit on multi-stage glossary routes to transient in-memory middleware (`requireEphemeralApiKeys`) with explicit client opt-in.

**Independent Test**: Run glossary analysis from `TranslatorWorkspace.tsx` and verify request body includes ephemeral keys with `allowApiKeysInBody: true`, while all standard requests strip keys.

### Implementation
- [X] T015 [US3] Create `requireEphemeralApiKeys` middleware in `server/routes/api.ts` and replace `resolveApiKeysMiddleware` on `analyze-glossary`, `analyze-guidelines`, `extract-glossary`, and `align-chapter`
- [X] T016 [P] [US3] Update `apiFetch` in `src/utils/apiClient.ts` to support `allowApiKeysInBody` flag and strip `apiKeys` by default
- [X] T017 [P] [US3] Add `allowApiKeysInBody: true` and TODO markers at call sites in `TranslatorWorkspace.tsx`, `ProjectFormModal.tsx`, `GlossaryManager.tsx`, `useExportFiles.ts`, and `useGlossaryScan.ts`

**Checkpoint**: Ephemeral middleware active for complex routes with explicit client opt-in.

---

## Phase 6: User Story 4 - Cleanup & Privacy Policy Documentation (Priority: P2)

**Goal**: Remove deprecated environment variables and ensure 100% truth in privacy documentation.

- [X] T018 [P] [US4] Remove `ENCRYPTION_MASTER_KEY` and unused session secret references from `.env.example`
- [X] T019 [P] [US4] Update `docs/privacy-policy.md` and `SECURITY.md` to reflect Zero-Knowledge Session Sync architecture and ephemeral route status

**Checkpoint**: Configuration and documentation fully aligned with code.

---

## Phase 7: Quality Gates & Browser Verification

**Purpose**: Strict Constitution quality assurance and live browser validation.

- [X] T020 [P] Run TypeScript typecheck verification via `npm run lint` (`tsc --noEmit`)
- [X] T021 [P] Run unit test suite via `npm test` (`vitest run`)
- [X] T022 Run production bundle build via `npm run build` (`vite build && esbuild server.ts`)
- [X] T023 Perform manual network tab verification via Chrome DevTools MCP ensuring zero raw key leaks

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
   │
   ▼
Phase 2: Foundational (T002, T003)
   │
   ▼
Phase 3: User Story 1 (T004 ──▶ T005 ──▶ T006 ──▶ T007 ──▶ T008 ──▶ T009 ──▶ T010) ◄── MVP Checkpoint
   │
   ▼
Phase 4: User Story 2 (T011 ──▶ T012 ──▶ T013 ──▶ T014)
   │
   ▼
Phase 5: User Story 3 (T015 ──▶ T016 ──▶ T017)
   │
   ▼
Phase 6: User Story 4 (T018 ──▶ T019)
   │
   ▼
Phase 7: Quality Gates (T020 ──▶ T021 ──▶ T022 ──▶ T023)
```
