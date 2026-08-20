# Tasks: Master Infrastructure, Security & Resiliency Hardening

**Feature**: `specs/037-infrastructure-architectural-hardening/spec.md`  
**Plan**: `specs/037-infrastructure-architectural-hardening/plan.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish cryptographic helpers and test fixtures for AES-256-GCM session key encryption and telemetry redaction.

- [X] T001 [P] Setup AES-256-GCM encryption key derivation helpers and test fixtures in `server/services/__tests__/encryptionTestFixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core security and idempotency infrastructure that MUST be complete before user story execution.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Implement AES-256-GCM encryption and decryption in `server/services/sessionStore.ts` using `ENCRYPTION_MASTER_KEY` with tamper protection
- [X] T003 [P] Ensure scoped idempotency conflict detection (HTTP 409 on body fingerprint mismatch) in `server/middleware/idempotencyMiddleware.ts`

**Checkpoint**: Foundation ready - Session keys encrypted at rest, scoped idempotency active.

---

## Phase 3: User Story 1 - Bảo mật & Idempotency Cấp Production (Priority: P0) 🎯 MVP

**Goal**: Đảm bảo toàn bộ API keys lưu tại SessionStore/Redis được mã hóa AES-256-GCM, payload log được redact tự động, và các request có Idempotency Key kèm Fingerprint nhận diện.

**Independent Test**: Lưu session chứa API keys $\to$ dữ liệu thô trong Redis/Memory là ciphertext; gửi trùng Idempotency-Key khác body $\to$ nhận 409 Conflict.

### Tests for User Story 1 🧪

- [X] T004 [P] [US1] Add unit tests in `server/services/__tests__/sessionStore.test.ts` for encrypted key persistence, GCM authentication tag verification, and tamper detection
- [X] T005 [P] [US1] Add unit tests in `server/middleware/__tests__/idempotencyMiddleware.test.ts` verifying HTTP 409 Conflict on payload fingerprint mismatch

### Implementation for User Story 1

- [X] T006 [US1] Audit and enforce log/telemetry redaction in `server/utils/text.ts` and `server/middleware/errorMiddleware.ts` to redact `AIzaSy...` and session tokens

**Checkpoint**: User Story 1 is fully functional and secured at rest and in transit.

---

## Phase 4: User Story 2 - Quản trị Quota Group & Tách biệt Sức khỏe API Key (Priority: P0/P1) 🎯 MVP

**Goal**: Quản trị hạn mức RPM/TPM ở cấp độ `QuotaGroup` (Project-level) để loại bỏ nhân ảo hạn mức (False Capacity), và duy trì máy trạng thái sức khỏe độc lập cho từng Key.

**Independent Test**: Cấu hình 3 keys cùng 1 group $\to$ scheduler pacing theo 15 RPM nhóm; 1 key bị 401 Unauthorized $\to$ chỉ key đó chuyển sang `AUTH_FAILED`, 2 key còn lại phục vụ bình thường.

### Tests for User Story 2 🧪

- [X] T007 [P] [US2] Add unit tests in `server/services/__tests__/quotaService.test.ts` verifying no false capacity summing across keys in the same QuotaGroup and independent `AUTH_FAILED` key isolation

### Implementation for User Story 2

- [X] T008 [US2] Ensure QuotaGroup scheduling in `server/services/quotaService.ts` and `server/services/geminiService.ts` strictly enforces group-level rate limits and isolates 401/403 keys

**Checkpoint**: User Story 2 is fully functional - QuotaGroup authority and Key Health decoupling enforced.

---

## Phase 5: User Story 3 - Vòng đời Model & Pipeline Xác minh Singleflight (Priority: P1)

**Goal**: Phân loại model theo 5 trạng thái vòng đời, sử dụng Promise-lock Singleflight khi xác minh model, và hot path dịch thuật chỉ đọc cache in-memory.

**Independent Test**: 20 request xác minh đồng thời cùng 1 model ID chỉ sinh ra 1 outbound fetch; hot path dịch thuật thực hiện 0 outbound verification calls.

### Implementation for User Story 3

- [X] T009 [P] [US3] Verify singleflight Promise deduplication and cached-only hot path validation across `server/services/modelInfoService.ts` and `server/routes/api.ts`

**Checkpoint**: User Story 3 is verified - Singleflight and non-blocking hot path active.

---

## Phase 6: User Story 4 - Phân loại Lỗi, Circuit Breaker Giới hạn Phạm vi & Concurrency Gate (Priority: P1)

**Goal**: Chuẩn hóa lỗi upstream Google, áp dụng Circuit Breaker scoped theo `[QuotaGroupId + ModelId]`, và chặn quá tải bằng Concurrency Gate (`MAX_CONCURRENT_REQUESTS = 50`).

**Independent Test**: Gây lỗi 503 trên `gemini-2.5-pro` trong Group A $\to$ Circuit Breaker mở cho `[GroupA + gemini-2.5-pro]`; `gemini-2.5-flash` vẫn nhận request; request thứ 51 nhận 503 + Retry-After.

### Tests for User Story 4 🧪

- [X] T010 [P] [US4] Add unit tests for scoped circuit breaker `[QuotaGroupId + ModelId]` and concurrency gate (`MAX_CONCURRENT_REQUESTS = 50`) in `server/services/__tests__/geminiService.test.ts`

### Implementation for User Story 4

- [X] T011 [US4] Enforce scoped circuit breaker and concurrency gate 503 + `Retry-After` in `server/services/geminiService.ts`

**Checkpoint**: User Story 4 is fully functional and resilient against cascading outages.

---

## Phase 7: User Story 5 - Dự phòng Mềm dẻo Redis & Minh bạch Số liệu Telemetry (Priority: P1/P2)

**Goal**: Tự động fallback sang in-memory khi Redis gặp sự cố (`/ready` trả về `degraded: true`), và `MetricsService` phân tách rõ `logicalRequests` vs `providerAttempts`.

**Independent Test**: Ngắt kết nối Redis $\to$ `/ready` trả về 200 `{ degraded: true }`; 1 request xoay 3 keys $\to$ `logicalRequests: 1, providerAttempts: 3`.

### Tests for User Story 5 🧪

- [X] T012 [P] [US5] Add unit tests in `server/services/__tests__/metricsService.test.ts` verifying separation of `logicalRequests` vs `providerAttempts` and `/ready` degraded status

### Implementation for User Story 5

- [X] T013 [US5] Implement explicit metrics counters (`logicalRequests`, `providerAttempts`, `successfulRequests`, `failedRequests`, `retriesTotal`) in `server/services/metricsService.ts`

**Checkpoint**: User Story 5 is fully functional and observable.

---

## Phase 8: User Story 6 - Đồng bộ Giao diện Frontend & Trải nghiệm Người dùng (Priority: P2)

**Goal**: QuotaPanel hiển thị hạn mức theo QuotaGroup và sức khỏe từng key độc lập (không cộng dồn RPM ảo), và ApiSettings hiển thị huy hiệu xác thực rõ ràng cho từng model.

**Independent Test**: QuotaPanel hiển thị đúng hạn ngạch nhóm 15 RPM và danh sách 3 keys với trạng thái sức khỏe riêng; ApiSettings hiển thị huy hiệu xác thực.

### Implementation for User Story 6

- [X] T014 [P] [US6] Audit and test `src/components/QuotaPanel.tsx` and `src/components/ApiSettings.tsx` for QuotaGroup representation and model lifecycle badges

**Checkpoint**: All user stories are independently functional and verified.

---

## Phase 9: Polish & Quality Gates

**Purpose**: Verification across all stories and enforcement of Constitution principles.

- [X] T015 [P] Run full quality gate checks (`npm run lint`, `npm test`, `npm run build`) and verify 0 regressions across all 61+ test suites
- [X] T016 Execute quickstart validation scenarios from `specs/037-infrastructure-architectural-hardening/quickstart.md`

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
Phase 3: US1 (P0)             Phase 4: US2 (P0/P1)          Phase 5: US3 (P1)
(T004, T005 -> T006)          (T007 -> T008)                (T009)
   │                              │                              │
   ├──────────────────────────────┴──────────────────────────────┤
   ▼                                                             ▼
Phase 6: US4 (P1)                                           Phase 7: US5 (P1/P2)
(T010 -> T011)                                              (T012 -> T013)
   │                                                             │
   └──────────────────────────────┬──────────────────────────────┘
                                  ▼
                             Phase 8: US6 (P2)
                             (T014)
                                  ▼
                             Phase 9: Polish & Quality Gates
                             (T015, T016)
```
