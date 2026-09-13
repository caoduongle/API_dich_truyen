# Tasks: Sửa Cơ Chế Xoay Vòng API Key Khi Chạm Quota & Tránh Kẹt Khóa Lỗi (134-fix-quota-key-rotation)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and validation of testing infrastructure

- [ ] T001 Review environment and existing test harness in src/hooks/__tests__/useTranslationProcess.test.ts and src/services/__tests__/chapterTranslationService.test.ts
- [ ] T002 [P] Verify localQuotaTracker and customLimitsStorage export bindings in src/services/localQuotaTracker.ts and src/utils/customLimitsStorage.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure and error contract alignments that MUST be complete before user stories

- [ ] T003 [P] Verify error classification and contract alignment for quota exhaustion in src/services/directGeminiClient.ts
- [ ] T004 Import localQuotaTracker and getStoredCustomLimits into src/hooks/useTranslationProcess.ts

**Checkpoint**: Foundational layer verified - user story implementation and testing can now proceed.

---

## Phase 3: User Story 1 - Tự Động Chuyển & Bỏ Qua API Key Đã Chạm Giới Hạn Sang Khóa Khả Dụng (Priority: P1) 🎯 MVP

**Goal**: Ensure API key pointer rotates sequentially across chapters (round-robin) and advances past exhausted/failing keys instead of locking onto a failing key.

**Independent Test**: Configure 3 keys, verify chapter 1 completes or fails and advances to key 2, chapter 2 starts with key 2.

### Tests for User Story 1

- [ ] T005 [P] [US1] Unit test key pointer advancement on chapter success in src/hooks/__tests__/useTranslationProcess.test.ts
- [ ] T006 [P] [US1] Unit test key pointer advancement past failed chapter in src/hooks/__tests__/useTranslationProcess.test.ts

### Implementation for User Story 1

- [ ] T007 [US1] Implement key index advancement (lastSuccessKeyIndex + 1) % cleanKeys.length on success in src/hooks/useTranslationProcess.ts
- [ ] T008 [US1] Implement key index advancement (baseKeyIndex + batchSize) % cleanKeys.length on failure via findNextAvailableKeyIndex in src/hooks/useTranslationProcess.ts
- [ ] T009 [US1] Ensure currentApiKeyIndexRef.current validates health state before starting batch in src/hooks/useTranslationProcess.ts

**Checkpoint**: User Story 1 functional - keys rotate smoothly and never stick on failing keys.

---

## Phase 4: User Story 2 - Phân Biệt Chính Xác Lỗi Cạn Kiệt Toàn Bộ Khóa & Dừng Khẩn Cấp (Priority: P1)

**Goal**: Preserve ALL_KEYS_EXHAUSTED error code and trigger immediate loop fast-break without falsely skipping queue.

**Independent Test**: Throw ALL_KEYS_EXHAUSTED on chapter 1, verify loop stops immediately and logs emergency shutdown without skipping remaining chapters.

### Tests for User Story 2

- [ ] T010 [P] [US2] Unit test error code preservation for ALL_KEYS_EXHAUSTED in src/services/__tests__/chapterTranslationService.test.ts
- [ ] T011 [P] [US2] Unit test emergency fast-break on ALL_KEYS_EXHAUSTED in src/hooks/__tests__/useTranslationProcess.test.ts

### Implementation for User Story 2

- [ ] T012 [US2] Preserve code: 'ALL_KEYS_EXHAUSTED' on raw translation and polish catch blocks in src/services/chapterTranslationService.ts
- [ ] T013 [US2] Update error detection in runTranslationLoop to check err?.code === 'ALL_KEYS_EXHAUSTED' and message in src/hooks/useTranslationProcess.ts
- [ ] T014 [US2] Trigger allKeysExhausted = true and break translation loop with emergency warning in src/hooks/useTranslationProcess.ts

**Checkpoint**: User Stories 1 and 2 complete - quota exhaustion halts immediately without corrupting queue.

---

## Phase 5: User Story 3 - Minh Bạch Hóa Nhật Ký Luân Chuyển Khóa Khi Gặp Lỗi (Priority: P2)

**Goal**: Transparent logging in console when key rotates or when emergency quota exhaustion occurs.

**Independent Test**: Inspect logs when key rotates or fast breaks, ensure proper messages are recorded.

### Implementation for User Story 3

- [ ] T015 [US3] Add descriptive error log when stopping queue due to all keys exhausted in src/hooks/useTranslationProcess.ts
- [ ] T016 [US3] Ensure active key number in batch start log accurately reflects healthy key in src/hooks/useTranslationProcess.ts

**Checkpoint**: Logging is transparent and clearly explains rotation decisions to users.

---

## Phase 6: User Story 4 - Khởi Tạo Khóa Khả Dụng Khi "Dịch Lại Các Chương Lỗi" (Priority: P2)

**Goal**: Auto-select first healthy key when initiating retry queue or resuming translation.

**Independent Test**: Set current key to exhausted key, trigger handleRetryFailedChapters(), verify key advances to next healthy key.

### Tests for User Story 4

- [ ] T017 [P] [US4] Unit test smart key selection in handleRetryFailedChapters in src/hooks/__tests__/useTranslationProcess.test.ts

### Implementation for User Story 4

- [ ] T018 [US4] Implement healthy key selection via findNextAvailableKeyIndex in handleRetryFailedChapters in src/hooks/useTranslationProcess.ts
- [ ] T019 [US4] Implement healthy key check on translation start in handleToggleProcessing in src/hooks/useTranslationProcess.ts

**Checkpoint**: Retry queue starts cleanly on a healthy key.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate verification across entire codebase

- [ ] T020 [P] Run strict TypeScript type checks with npm run lint
- [ ] T021 [P] Run complete Vitest suite with npm test
- [ ] T022 Run production build verification with npm run build
- [ ] T023 Validate quickstart test scenarios in specs/134-fix-quota-key-rotation/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational - delivers MVP key rotation
- **User Story 2 (Phase 4 - P1)**: Depends on Foundational - delivers emergency fast-break
- **User Story 3 (Phase 5 - P2)**: Depends on US1 and US2 - improves observability
- **User Story 4 (Phase 6 - P2)**: Depends on US1 - improves retry flow
- **Polish (Phase 7)**: Depends on all user stories being complete

### Parallel Opportunities

- T002, T003 can be verified in parallel.
- T005, T006 test writing can run in parallel.
- T010, T011 test writing can run in parallel across services and hooks.
- T017 can be written independently.
- T020 and T021 can run in parallel during final verification.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (prerequisites)
3. Complete Phase 3: User Story 1 (Key rotation & avoiding stuck keys)
4. Validate User Story 1 with unit tests

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. User Story 1 (Key rotation) -> Prevents stuck keys (MVP!)
3. User Story 2 (Fast-break) -> Prevents false overload skipping
4. User Story 3 (Logging) -> Transparent feedback
5. User Story 4 (Retry key selection) -> Smooth retry experience
6. Polish -> Full quality gate verification (`lint`, `test`, `build`)
