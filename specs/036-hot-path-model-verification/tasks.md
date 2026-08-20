# Tasks: Zero Model Verification in Translation Hot Path & Concurrency Deduplication

**Feature**: `specs/036-hot-path-model-verification/spec.md`  
**Plan**: `specs/036-hot-path-model-verification/plan.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test harness and environment setup for hot path verification and concurrency deduplication.

- [X] T001 Setup test harnesses for hot path network spy and concurrency assertions in `server/services/__tests__/modelInfoService.test.ts` and `server/services/__tests__/modelValidation.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core model caching and in-flight promise management that MUST be complete before user story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `inFlightVerifications: Map<string, Promise<ModelDefinition>>` property and lifecycle cleanup helpers to `server/services/modelInfoService.ts`
- [X] T003 [P] Implement `isModelVerifiedCached(modelId: string): boolean` in `server/services/modelInfoService.ts` for zero-network synchronous lookup against presets and verified cache

**Checkpoint**: Foundation ready - in-flight deduplication map and cached verification method available.

---

## Phase 3: User Story 1 - Loại bỏ Hoàn toàn Verification Network Call khỏi Hot Path Dịch thuật (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo toàn bộ request dịch thuật đi qua `validateModelMiddleware` không bao giờ kích hoạt outbound network call tới Google API để xác minh model, và lập tức từ chối model chưa xác minh với HTTP 400 `MODEL_UNVERIFIED`.

**Independent Test**: Gửi request dịch thuật tới `/api/translate-raw` với model hợp lệ và model chưa xác minh; spy của `fetch` ghi nhận chính xác 0 cuộc gọi tra cứu model.

### Tests for User Story 1 🧪

- [X] T004 [P] [US1] Add unit tests in `server/services/__tests__/modelValidation.test.ts` asserting `validateModelMiddleware` triggers 0 outbound fetch calls for valid preset/cached models and rejects unverified models with 400 `MODEL_UNVERIFIED` in $<5$ms

### Implementation for User Story 1

- [X] T005 [US1] Refactor `validateModelMiddleware` in `server/routes/api.ts` to strictly call `modelInfoService.isModelVerifiedCached(model)` and reject cache misses with 400 `MODEL_UNVERIFIED` without sending any network request

**Checkpoint**: User Story 1 is fully functional - hot path is 100% zero-network for model validation.

---

## Phase 4: User Story 2 - Khử trùng lặp Đơn luồng (Single-Flight Promise Deduplication) khi Xác minh Đồng thời (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo khi 20 request đồng thời yêu cầu xác minh cùng 1 model ID, máy chủ chỉ gửi đúng 1 HTTP fetch lên Google AI Studio và 19 request còn lại cùng await Promise in-flight.

**Independent Test**: Kích hoạt 20 cuộc gọi đồng thời `verifySingleModel('custom-id', key)`; spy `fetch` chỉ được gọi 1 lần duy nhất, tất cả 20 Promise trả về cùng kết quả.

### Tests for User Story 2 🧪

- [X] T006 [P] [US2] Add unit tests in `server/services/__tests__/modelInfoService.test.ts` for concurrent single-flight deduplication (20 concurrent requests = 1 fetch), failure cleanup, and fast retry after failure

### Implementation for User Story 2

- [X] T007 [US2] Update `verifySingleModel` in `server/services/modelInfoService.ts` to check `inFlightVerifications`, reuse active Promise, and clean up the map in a `finally` block

**Checkpoint**: User Stories 1 AND 2 are fully integrated and protected against cache stampedes.

---

## Phase 5: User Story 3 - Phân tách Rõ ràng Luồng Xác minh (Explicit Path) và Luồng Dịch thuật (Hot Path) (Priority: P2)

**Goal**: Phân tách triệt để luồng xác minh tường minh (`POST /api/verify-model`) và luồng dịch thuật hot path, hỗ trợ đầy đủ cache hit, cache miss, stale revalidation, và explicit refresh.

**Independent Test**: Gửi request dịch thuật với model chưa xác minh $\to$ bị từ chối 400; gọi `POST /api/verify-model` $\to$ model được nạp vào cache; gửi lại request dịch thuật $\to$ thành công với 0 cuộc gọi mạng tra cứu model.

### Tests for User Story 3 🧪

- [X] T008 [P] [US3] Add integration tests in `server/routes/__tests__/apiValidation.test.ts` validating the complete lifecycle: unverified model rejection $\to$ explicit verification via `/api/verify-model` $\to$ hot path admission

### Implementation for User Story 3

- [X] T009 [US3] Audit and ensure all translation route middlewares in `server/routes/api.ts` adhere to the non-probing cached validation contract

**Checkpoint**: All user stories are independently functional and verified.

---

## Phase 6: Polish & Quality Gates

**Purpose**: Verification across all stories and enforcement of Constitution principles.

- [X] T010 [P] Run full quality gate checks (`npm run lint`, `npm test`, `npm run build`) and verify 0 regressions across all 61+ test suites
- [X] T011 Execute quickstart validation scenarios from `specs/036-hot-path-model-verification/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup (T001)
   │
   ▼
Phase 2: Foundational (T002, T003) [BLOCKS ALL USER STORIES]
   │
   ├──────────────────────────────┬──────────────────────────────┐
   ▼                              ▼                              ▼
Phase 3: User Story 1 (P1)    Phase 4: User Story 2 (P1)    Phase 5: User Story 3 (P2)
(T004 -> T005)                (T006 -> T007)                (T008 -> T009)
   │                              │                              │
   └──────────────────────────────┼──────────────────────────────┘
                                  ▼
                     Phase 6: Polish & Quality Gates
                     (T010, T011)
```
