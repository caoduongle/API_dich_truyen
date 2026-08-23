# Tasks: Clean Code & Modular Refactoring

**Feature**: 068-clean-code-refactor
**Branch**: `068-clean-code-refactor`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Pre-Flight & Baseline Verification

**Purpose**: Đảm bảo toàn bộ test suite và build đang ở trạng thái xanh trước khi tiến hành refactor.

- [x] T001 Run baseline quality check (`npm run lint` && `npm test`) to ensure clean starting state

**Checkpoint**: Baseline 100% pass (88 test files, 601 tests).

---

## Phase 2: Batch 1 — Backend Quota Decomposition (US1 — Tách quotaService.ts)

**Goal**: Tách nhỏ file `server/services/quotaService.ts` (1.904 dòng) thành 5 sub-modules chuyên biệt trong `server/services/quota/`, giữ nguyên 100% public API thông qua facade.

**Independent Test**: `npx vitest run server/services/__tests__/quotaService.test.ts` pass 100%.

### Implementation

- [x] T002 [P] [US1] Create `server/services/quota/circuitBreaker.ts` — extract model cooldown, group cooldown, and provider outage state management
- [x] T003 [P] [US1] Create `server/services/quota/groupManager.ts` — extract QuotaGroup registration, validation, project verification, and bucket bindings
- [x] T004 [P] [US1] Create `server/services/quota/keyScheduler.ts` — extract key selection algorithm, group interval pacing, scheduling hints, and lease allocation
- [x] T005 [P] [US1] Create `server/services/quota/quotaAccountant.ts` — extract token stats, RPM/RPD/TPM window counting, key health, error classification, and quota snapshots
- [x] T006 [P] [US1] Create `server/services/quota/quotaTelemetry.ts` — extract request attempt logging, latency tracking, logical summary stats, and canonical metrics
- [x] T007 [US1] Refactor `server/services/quotaService.ts` to act as a lightweight facade orchestrating the 5 sub-modules and re-exporting all types, helper functions, and the `quotaService` singleton

**Checkpoint**: Chạy `npx vitest run server/` — toàn bộ backend tests pass, `quotaService.ts` < 350 dòng.

---

## Phase 3: Batch 2 — Google Drive Sync Decomposition (US2 — Tách googleDriveSyncService.ts)

**Goal**: Tách `src/services/googleDriveSyncService.ts` (1.010 dòng) thành REST client + monolithic sync + granular sync trong `src/services/google-drive/`.

**Independent Test**: `npx vitest run src/services/__tests__/googleDriveSyncService.test.ts` pass 100%.

### Implementation

- [x] T008 [P] [US2] Create `src/services/google-drive/driveRestClient.ts` — extract low-level Google Drive v3 REST API transport (auth headers, file search, upload, download, metadata, error normalization)
- [x] T009 [P] [US2] Create `src/services/google-drive/driveProjectSync.ts` — extract monolithic project push/pull and timestamp reconciliation logic
- [x] T010 [P] [US2] Create `src/services/google-drive/driveGranularSync.ts` — extract granular chapter manifest syncing, CRDT snapshot encoding, and conflict resolution
- [x] T011 [US2] Refactor `src/services/googleDriveSyncService.ts` to act as a lightweight facade re-exporting helper functions, classes, and the singleton `googleDriveSyncService`

**Checkpoint**: Chạy `npx vitest run src/services/` — toàn bộ frontend service tests pass.

---

## Phase 4: Batch 3 — QuotaPanel & ApiSettings Extraction (US3 — Subcomponents Extraction)

**Goal**: Extract inline subcomponents từ `QuotaPanel.tsx` (950 dòng) và `ApiSettings.tsx` (747 dòng) thành các file riêng biệt.

**Independent Test**: `npm run lint` và `npx vitest run src/components/__tests__/` pass 100%.

### Implementation

- [x] T012 [P] [US3] Create `src/components/quota-panel/CountdownBadge.tsx` — extract standalone countdown timer badge with its internal 1s interval
- [x] T013 [P] [US3] Create `src/components/quota-panel/CustomLimitsPanel.tsx` — extract custom RPM/RPD/TPM limit configuration editor
- [x] T014 [P] [US3] Create `src/components/quota-panel/GroupQuotaCard.tsx` — extract quota group card view
- [x] T015 [US3] Refactor `src/components/QuotaPanel.tsx` to import from `src/components/quota-panel/`, reducing file size to <360 dòng
- [x] T016 [P] [US3] Create `src/components/api-settings/ModelSummaryCard.tsx`, `KeyListSection.tsx`, `CustomModelSection.tsx`, and `TranslationQualitySection.tsx` — extract model summary and API key list management
- [x] T017 [US3] Refactor `src/components/ApiSettings.tsx` to import from `src/components/api-settings/`, reducing file size to <360 dòng

**Checkpoint**: `QuotaPanel.tsx` và `ApiSettings.tsx` đều <360 dòng, `npm run lint` sạch.

---

## Phase 5: Batch 4 — TranslatorWorkspace & GlossaryManager Extraction (US4 — State & Sub-panel Extraction)

**Goal**: Tách state management logic và sub-panels từ `TranslatorWorkspace.tsx` (956 dòng) và `GlossaryManager.tsx` (710 dòng).

**Independent Test**: `npm run lint` và `npm test` pass 100%.

### Implementation

- [x] T018 [P] [US4] Create `src/components/translator-workspace/useWorkspaceState.ts` — extract workspace state management, active chapter selection, and dirty tracking
- [x] T019 [US4] Refactor `src/components/TranslatorWorkspace.tsx` using `useWorkspaceState`, reducing file size to <350 dòng
- [x] T020 [P] [US4] Create `src/components/glossary-manager/useGlossaryState.ts` — extract search, pagination, selection, and filter states
- [x] T021 [US4] Refactor `src/components/GlossaryManager.tsx` using `useGlossaryState`, reducing file size to <350 dòng

**Checkpoint**: `TranslatorWorkspace.tsx` và `GlossaryManager.tsx` đều <350 dòng, `npm test` pass.

---

## Phase 6: Batch 5 — GoogleSyncModal Migration to `ui/Modal` (US5 — Modal Pattern Standardization)

**Goal**: Migrate `GoogleSyncModal.tsx` (573 dòng) sang sử dụng standard `src/components/ui/Modal.tsx` và tách cấu hình nâng cao.

**Independent Test**: `npx vitest run src/components/google-sync/` pass 100%.

### Implementation

- [x] T022 [P] [US5] Create `src/components/google-sync/GoogleSyncAdvancedConfig.tsx` — extract Client ID & Picker API Key configuration section
- [x] T023 [US5] Refactor `src/components/google-sync/GoogleSyncModal.tsx` to use `src/components/ui/Modal.tsx` instead of custom backdrop div, reducing file size to <250 dòng
- [x] T024 [US5] Verify visual appearance and accessibility of `GoogleSyncModal`

**Checkpoint**: `GoogleSyncModal.tsx` sử dụng design system `ui/Modal`, không còn custom overlay.

---

## Phase 7: Final Polish & Quality Gates Verification

**Purpose**: Kiểm tra độ dài file và chạy toàn bộ bộ kiểm thử bắt buộc của dự án.

- [x] T025 Run file length audit script to verify no refactored file exceeds 400 lines (excluding facades)
- [x] T026 Run `npm run lint` (`tsc --noEmit`) to verify 0 type errors
- [x] T027 Run `npm test` (`vitest run`) to verify all 88+ test suites pass without regression
- [x] T028 Run `npm run build` (`vite build` + `esbuild server`) to verify production bundle builds cleanly

**Checkpoint**: Toàn bộ quality gates pass, mã nguồn sạch đẹp, module hóa chuẩn mực.

---

## Dependencies & Execution Order

- **Phase 1 (Pre-Flight)**: Bắt đầu ngay
- **Phase 2 (Batch 1 - Backend Quota)**: Phụ thuộc Phase 1
- **Phase 3 (Batch 2 - Google Drive Sync)**: Có thể thực hiện song song hoặc sau Phase 2
- **Phase 4 (Batch 3 - QuotaPanel & ApiSettings)**: Có thể thực hiện song song hoặc sau Phase 3
- **Phase 5 (Batch 4 - Workspace & Glossary)**: Có thể thực hiện sau Phase 4
- **Phase 6 (Batch 5 - GoogleSyncModal)**: Có thể thực hiện sau Phase 3
- **Phase 7 (Final Polish)**: Phụ thuộc toàn bộ các Phase 1–6 hoàn thành

---

## Notes

- [P] tasks = different files, no dependencies
- [US*] label maps task to specific user story / batch
- Không thay đổi hành vi logic (Zero functional regression)
- Không thay đổi `src/types.ts` hoặc schema IndexedDB
- Không thêm barrel files `index.ts`
