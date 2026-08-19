# Implementation Tasks: Unified Model Registry, Quota-Aware Scheduling & System Resilience

**Feature**: `013-model-quota-resilience`  
**Specification**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Total Tasks**: 38  

---

## Phase 1: Setup & Canonical Definitions

**Purpose**: Thiết lập các kiểu dữ liệu dùng chung (shared types) và định nghĩa canonical model system

- [x] T001 [P] Define canonical `ModelDefinition`, `ModelCapabilities`, `ModelSource`, and `ModelStatus` interfaces in `shared/models.ts`
- [x] T002 [P] Update canonical model constants (`DEFAULT_MODEL_ID`, `AVAILABLE_MODELS`, `MODEL_LIMITS`) in `shared/models.ts` and `shared/constants.ts`
- [x] T003 Re-export canonical model interfaces and constants in `server/constants/models.ts`

---

## Phase 2: Foundational Infrastructure

**Purpose**: Cơ sở hạ tầng phân loại lỗi và telemetry cốt lõi trước khi triển khai các User Story

- [x] T004 [P] Define `AIErrorCode` enum and `AIErrorNormalized` interface in `server/constants/errors.ts`
- [x] T005 [P] Create error taxonomy normalization helper `normalizeUpstreamError` in `server/utils/errorClassifier.ts`
- [x] T006 [P] Create request tracing middleware `requestIdMiddleware` with safe secret redaction in `server/middleware/tracingMiddleware.ts`
- [x] T007 Mount `requestIdMiddleware` in Express application pipeline in `server.ts` and `server/routes/api.ts`

---

## Phase 3: User Story 1 - Unified Model Registry & Lifecycle (Priority: P1) 🎯 MVP

**Goal**: Đồng bộ hóa toàn bộ danh mục model giữa Frontend và Backend, hỗ trợ preset, discovered, custom model, và migration khi model bị shutdown/deprecated.

**Independent Test**: Thêm custom/discovered model, chọn trên UI, gửi request dịch và xác nhận backend chấp nhận; gửi model giả mạo và xác nhận backend từ chối `400 Bad Request`.

### Tests for User Story 1
- [x] T008 [P] [US1] Create unit tests for canonical model registry and validation in `server/services/__tests__/modelValidation.test.ts`
- [x] T009 [P] [US1] Create unit tests for model registry lifecycle and migration in `src/utils/__tests__/modelRegistry.test.ts`

### Implementation for User Story 1
- [x] T010 [P] [US1] Implement server-side model validation function and middleware `validateModelMiddleware` in `server/routes/api.ts`
- [x] T011 [US1] Refactor `src/utils/modelRegistry.ts` to implement `RegisteredModelDef` adhering to `ModelDefinition` with lifecycle checks (`active`, `deprecated`, `shutdown`) and migration helpers
- [x] T012 [US1] Update `src/hooks/useAIConfig.ts` to automatically migrate persisted shutdown models to `replacementId` or default model with user notification
- [x] T013 [US1] Update Model Selector dropdown in `src/components/ApiSettings.tsx` to display lifecycle status badges and deprecation warnings

---

## Phase 4: User Story 2 - Quota-Aware Key Scheduling & Admission Control (Priority: P1) 🎯 MVP

**Goal**: Quản lý sức khỏe từng API key (Key Health State), ước tính token trước khi gửi (Predictive TPM), và điều phối key tối ưu dựa trên dung lượng khả dụng.

**Independent Test**: Gửi nhiều request dịch liên tiếp với các key có dung lượng khác nhau, xác nhận hệ thống tự động định tuyến sang key rảnh và không gây lỗi 429.

### Tests for User Story 2
- [x] T014 [P] [US2] Create unit tests for KeyHealth state machine and candidate key scoring in `server/services/__tests__/quotaService.test.ts`
- [x] T015 [P] [US2] Create unit tests for pre-flight admission control in `src/hooks/__tests__/useAutoTranslationQueue.test.ts`

### Implementation for User Story 2
- [x] T016 [US2] Implement `KeyHealthState` machine (`Healthy`, `Degraded`, `RateLimited`, `QuotaExhausted`, `AuthFailed`, `Cooldown`, `Disabled`) in `server/services/quotaService.ts`
- [x] T017 [US2] Implement candidate key selection scoring algorithm in `server/services/geminiService.ts`
- [x] T018 [US2] Integrate predictive token admission check before dispatching in `src/hooks/useAutoTranslationQueue.ts` and `src/hooks/useTranslationProcess.ts`

---

## Phase 5: User Story 3 - Request Queue, Error Taxonomy & Circuit Breaker (Priority: P1) 🎯 MVP

**Goal**: Hàng đợi request có cấu trúc, ngắt mạch (Circuit Breaker) bảo vệ khi lỗi liên tiếp, và ánh xạ hành động thông minh theo mã lỗi `AIErrorCode`.

**Independent Test**: Giả lập lỗi 401 (AuthFailed) -> ngưng key ngay; giả lập lỗi 503 -> exponential retry; giả lập chuỗi lỗi -> Circuit Breaker chuyển sang Open rồi Half-Open.

### Tests for User Story 3
- [x] T019 [P] [US3] Create unit tests for Circuit Breaker transitions in `server/services/__tests__/circuitBreaker.test.ts`
- [x] T020 [P] [US3] Create unit tests for error taxonomy mapping in `server/utils/__tests__/errorClassifier.test.ts`

### Implementation for User Story 3
- [x] T021 [US3] Implement Circuit Breaker state tracker (`Closed`, `Open`, `HalfOpen`) per key and model in `server/services/geminiService.ts`
- [x] T022 [US3] Update error handling in `server/services/geminiService.ts` to consume `normalizeUpstreamError` and execute discrete actions (`retry`, `rotate_key`, `cooldown_key`, `disable_key`, `fail_immediately`)
- [x] T023 [US3] Implement queue depth and backpressure protection in `server/services/geminiService.ts`

---

## Phase 6: User Story 4 - Redis Graceful Degradation & Fallback Rate Limiting (Priority: P1) 🎯 MVP

**Goal**: Chuyển đổi an toàn sang bộ đếm in-memory cục bộ có giới hạn (bounded) khi Redis ngắt kết nối, duy trì bảo vệ 60 req/phút/IP và tự động khôi phục khi Redis online.

**Independent Test**: Ngắt kết nối Redis, gửi >60 requests/phút từ 1 IP, xác nhận nhận về HTTP 429 và ứng dụng không bị crash hay rò rỉ bộ nhớ.

### Tests for User Story 4
- [x] T024 [P] [US4] Create unit tests for Redis graceful degradation and in-memory fallback in `server/middleware/__tests__/rateLimiter.test.ts`

### Implementation for User Story 4
- [x] T025 [US4] Refactor `server/middleware/rateLimiter.ts` to implement bounded fallback Map (max 10,000 IPs) and auto-reconnect handling for Redis events (`error`, `close`, `ready`)

---

## Phase 7: User Story 5 - End-to-End Tracing, Idempotency & Observability UI (Priority: P2)

**Goal**: Hỗ trợ `Idempotency-Key` cho các endpoint dịch thuật, gắn `requestId` vào response, và hiển thị trạng thái sức khỏe API key trên giao diện.

**Independent Test**: Gửi 2 request dịch với cùng `Idempotency-Key`, xác nhận request thứ 2 nhận kết quả cache tức thì; mở Quota Panel xem huy hiệu trạng thái của từng key.

### Tests for User Story 5
- [x] T026 [P] [US5] Create unit tests for translation idempotency in `server/middleware/__tests__/idempotency.test.ts`
- [x] T027 [P] [US5] Create unit tests for Key Health UI components in `src/components/__tests__/QuotaPanel.test.tsx`

### Implementation for User Story 5
- [x] T028 [P] [US5] Implement `idempotencyMiddleware` with in-flight deduplication and completed response caching in `server/middleware/idempotencyMiddleware.ts`
- [x] T029 [US5] Mount `idempotencyMiddleware` on translation routes in `server/routes/api.ts`
- [x] T030 [P] [US5] Update `src/utils/apiClient.ts` to pass `Idempotency-Key` and propagate `x-request-id`
- [x] T031 [US5] Update `src/components/QuotaPanel.tsx` and `src/components/ApiSettings.tsx` to render Key Health indicators (Healthy/RateLimited/AuthFailed) adhering to "Mực & Chu Sa" design system

---

## Phase 8: User Story 6 - Model Discovery Cache & SWR (Priority: P2)

**Goal**: Bộ nhớ đệm danh mục model khám phá từ Google API với cơ chế Stale-While-Revalidate (SWR) và nút làm mới thủ công.

**Independent Test**: Mở modal Cấu hình AI, xác nhận danh mục model hiển thị tức thì (<50ms) từ cache, ngầm revalidate trong background và không làm mất danh mục khi discovery lỗi.

### Tests for User Story 6
- [x] T032 [P] [US6] Create unit tests for SWR model discovery cache in `server/services/__tests__/modelInfoService.test.ts`

### Implementation for User Story 6
- [x] T033 [US6] Refactor `server/services/modelInfoService.ts` to implement SWR caching with TTL, background revalidation, and failure-safe fallback

---

## Phase 9: User Story 7 - Translation Processing Architecture Evaluation (Priority: P2)

**Goal**: Tài liệu hóa và đánh giá định lượng kiến trúc xử lý dịch thuật (Synchronous Streaming + Pacing + Idempotency vs Asynchronous Job Queue).

- [x] T034 [US7] Document architecture decision and performance benchmark analysis in `specs/013-model-quota-resilience/research.md`

---

## Phase 10: User Story 8 - Contract Tests & Comprehensive Regression Suite (Priority: P1) 🎯 MVP

**Goal**: Khóa chặt toàn bộ hợp đồng dữ liệu giữa Frontend/Backend và xây dựng bộ test hồi quy toàn diện cho các bất biến hệ thống.

- [x] T035 [P] [US8] Create contract test suite verifying shared schemas in `server/__tests__/contractTests.test.ts`
- [x] T036 [US8] Create comprehensive architecture regression test suite in `server/__tests__/resilienceRegression.test.ts`

---

## Phase 11: Polish, Verification & Quality Gates (Mandatory)

**Purpose**: Hoàn tất toàn bộ quality gates theo quy định của Constitution

- [x] T037 Run `npm run lint` (`tsc --noEmit`) and fix any remaining type issues
- [x] T038 Run `npm test` (`vitest run`) and `npm run build` to verify 100% test pass status and production buildability

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001 - T003)
      ↓
Phase 2: Foundational (T004 - T007)
      ↓
Phase 3: US1 - Unified Model Registry (T008 - T013)
      ↓
Phase 4: US2 - Quota-Aware Scheduler & Admission (T014 - T018)
      ↓
Phase 5: US3 - Queue, Error Taxonomy & Circuit Breaker (T019 - T023)
      ↓
Phase 6: US4 - Redis Graceful Degradation (T024 - T025)
      ↓
Phase 7: US5 - Tracing, Idempotency & UI Observability (T026 - T031)
      ↓
Phase 8: US6 - Model Discovery SWR Cache (T032 - T033)
      ↓
Phase 9: US7 - Architecture Doc (T034)
      ↓
Phase 10: US8 - Contract & Regression Suite (T035 - T036)
      ↓
Phase 11: Final Quality Verification (T037 - T038)
```
