# Tasks: Mandatory Custom Model Verification & State Governance

**Feature**: `specs/035-custom-model-verification/spec.md`  
**Plan**: `specs/035-custom-model-verification/plan.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared types, data structures, and test fixtures for custom model verification states.

- [X] T001 [P] Extend `ModelVerificationState` and update `ModelDefinition` in `shared/models.ts`
- [X] T002 [P] Create test fixtures and mock models for verification scenarios in `src/utils/__tests__/modelTestFixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core model registry governance and state management that MUST be complete before user story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Refactor `getCustomModels()` and `addCustomModel()` in `src/utils/modelRegistry.ts` to eliminate `verified: true` default and enforce `unverified` state when metadata is absent
- [X] T004 [P] Implement `getVerifiedModels()` in `src/utils/modelRegistry.ts` to strictly filter for `verified === true && status !== 'shutdown' && capabilities.generateContent !== false`

**Checkpoint**: Foundation ready - custom models default to unverified, verified models filtered strictly.

---

## Phase 3: User Story 1 - Xác minh bắt buộc trước khi kích hoạt Mô hình Tự nhập (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo mọi custom model khi nhập vào bắt buộc phải qua xác minh Google AI Studio và kiểm tra capability `generateContent` trước khi được lưu ở trạng thái `verified`.

**Independent Test**: Thêm model `tunedModels/my-novel-v1` qua `verifyModel` $\to$ lưu thành công với `verified: true`; thêm model `text-embedding-004` $\to$ bị từ chối với lỗi `UNSUPPORTED_METHODS`.

### Tests for User Story 1 🧪

- [X] T005 [P] [US1] Add unit tests in `src/utils/__tests__/modelRegistry.test.ts` for unverified custom models, invalid models, verified models, and custom model state transitions
- [X] T006 [P] [US1] Add unit tests in `server/services/__tests__/modelInfoService.test.ts` for `verifySingleModel` testing valid model, invalid model (404), timeout, missing capability, and caching

### Implementation for User Story 1

- [X] T007 [US1] Update `verifySingleModel` in `server/services/modelInfoService.ts` to validate `supportedGenerationMethods` includes `generateContent`, enforce 15s timeout, and return structured error codes
- [X] T008 [US1] Update `verifyModelHandler` in `server/controllers/quotaController.ts` to handle and return structured HTTP responses and error codes for `POST /api/verify-model`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Quản trị Vòng đời Trạng thái Mô hình Đầy đủ & Admission Control (Priority: P1) 🎯 MVP

**Goal**: Quản trị 5 trạng thái vòng đời (`unverified`, `verified`, `invalid`, `deprecated`, `shutdown`) và đảm bảo scheduler/middleware chỉ cho phép model `verified` chạy dịch thuật.

**Independent Test**: Gửi request dịch thuật với `model: "unverified-model"` $\to$ hệ thống từ chối hoặc chuyển hướng an toàn.

### Tests for User Story 2 🧪

- [X] T009 [P] [US2] Add unit tests in `server/controllers/__tests__/quotaController.test.ts` verifying verify-model error mapping and lifecycle states
- [X] T010 [US2] Update `migrateModelSelection` in `src/utils/modelRegistry.ts` to handle `unverified`, `invalid`, `deprecated`, and `shutdown` models safely
- [X] T011 [US2] Enforce verified model check in `server/services/modelInfoService.ts` (`isModelVerified`) to ensure unverified models cannot bypass verification

**Checkpoint**: User Stories 1 AND 2 are fully integrated and secure.

---

## Phase 5: User Story 3 - Trải nghiệm UX Trực quan & Bộ đệm Cache Không Gọi Lại Khi Render (Priority: P2)

**Goal**: Cung cấp phản hồi UI trực quan ("Đang kiểm tra mô hình..." $\to$ "Đã xác minh" / lỗi) và loại bỏ hoàn toàn các cuộc gọi network trong chu kỳ re-render của React.

**Independent Test**: Mở modal `ApiSettings`, chuyển tab hoặc gõ phím $\to$ xác minh không phát sinh bất kỳ request `POST /api/verify-model` thừa nào.

### Tests for User Story 3 🧪

- [X] T012 [P] [US3] Add integration and flow tests in `src/components/__tests__/ApiSettingsModelFlow.test.ts` verifying verification button states, zero network calls during re-renders, and on-demand re-verification
- [X] T013 [US3] Update `src/components/ApiSettings.tsx` to show loading state during verification, display verification status badges on custom models, add on-demand re-verification button, and eliminate render-phase network calls

**Checkpoint**: All user stories are independently functional and verified.

---

## Phase 6: Polish & Quality Gates

**Purpose**: Improvements and cross-cutting verification across all stories.

- [X] T014 [P] Run full quality gate checks (`npm run lint`, `npm test`, `npm run build`) and verify 0 regressions
- [X] T015 Execute quickstart validation scenarios from `specs/035-custom-model-verification/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup (T001, T002)
   │
   ▼
Phase 2: Foundational (T003, T004) [BLOCKS ALL USER STORIES]
   │
   ├──────────────────────────────┬──────────────────────────────┐
   ▼                              ▼                              ▼
Phase 3: User Story 1 (P1)    Phase 4: User Story 2 (P1)    Phase 5: User Story 3 (P2)
(T005, T006 -> T007, T008)     (T009 -> T010, T011)          (T012 -> T013)
   │                              │                              │
   └──────────────────────────────┼──────────────────────────────┘
                                  ▼
                     Phase 6: Polish & Quality Gates
                     (T014, T015)
```
