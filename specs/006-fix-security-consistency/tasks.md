# Tasks: Fix Security Consistency (Redaction & Exact Path Auth)

**Feature**: `006-fix-security-consistency`  
**Spec**: [specs/006-fix-security-consistency/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/006-fix-security-consistency/spec.md)  
**Plan**: [specs/006-fix-security-consistency/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/006-fix-security-consistency/plan.md)  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác thực môi trường kiểm thử và baseline hiện tại

- [x] T001 [P] Verify test baseline and runner readiness in `server/services/__tests__/geminiService.test.ts` and `server/controllers/__tests__/authController.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rà soát các tiện ích làm sạch chuỗi và cấu hình log trước khi chuyển đổi

- [x] T002 [P] Inspect and verify redaction helper exports in `server/utils/text.ts` and `server/utils/logger.ts`

---

## Phase 3: User Story 1 - Khử Khóa Bí Mật Toàn Diện Trong Ngoại Lệ Tổng Hợp & Chuẩn Hóa Logger Cho Controller (Priority: P1) 🎯 MVP

**Goal**: Che giấu toàn bộ API key trong ngoại lệ ném ra khi cạn kiệt key (`ALL_KEYS_EXHAUSTED`), đồng thời chuyển toàn bộ `console.*` trong tất cả các controller sang `Logger` mà không đổi câu chữ tiếng Việt hay logic dịch.  
**Independent Test**: Kích hoạt ngoại lệ cạn kiệt key với thông báo lỗi chứa API key thô, xác nhận chuỗi ném ra đã redact; kiểm tra toàn bộ controller không còn lệnh `console.*` nào.

### Tests for User Story 1
- [x] T003 [P] [US1] Add unit test in `server/services/__tests__/geminiService.test.ts` verifying API key redaction in `ALL_KEYS_EXHAUSTED` exception message

### Implementation for User Story 1
- [x] T004 [US1] Update `generateWithRotation` in `server/services/geminiService.ts` to sanitize `lastError.message` with `redactApiKey` before throwing `ALL_KEYS_EXHAUSTED`
- [x] T005 [P] [US1] Replace direct `console.*` calls with `Logger('RawTranslation')` in `server/controllers/translation/rawController.ts`
- [x] T006 [P] [US1] Replace direct `console.*` calls with `Logger('PolishTranslation')` in `server/controllers/translation/polishController.ts`
- [x] T007 [P] [US1] Replace direct `console.*` calls with `Logger('QACritique')` in `server/controllers/translation/qaController.ts`
- [x] T008 [P] [US1] Replace direct `console.*` calls with `Logger('Glossary')` in `server/controllers/glossaryController.ts`
- [x] T009 [P] [US1] Replace direct `console.*` calls with `Logger('Alignment')` in `server/controllers/alignmentController.ts`
- [x] T010 [P] [US1] Replace direct `console.*` calls with `Logger('AuthController')` in `server/controllers/authController.ts`
- [x] T011 [P] [US1] Replace direct `console.*` calls with `Logger('QuotaController')` in `server/controllers/quotaController.ts`
- [x] T012 [P] [US1] Replace direct `console.*` calls with `Logger('SessionController')` in `server/controllers/sessionController.ts`

**Checkpoint**: User Story 1 hoàn thành độc lập. Ngoại lệ tổng hợp và toàn bộ controller logs đều được lọc sạch bí mật tự động.

---

## Phase 4: User Story 2 - So Khớp Tuyệt Đối Đường Dẫn Công Khai Ngăn Chặn Bypass Xác Thực (Priority: P1) 🎯 MVP

**Goal**: Loại bỏ so khớp hậu tố `endsWith()` trong `authMiddleware.ts`, chỉ cho phép bypass xác thực với các route khớp chính xác trong `PUBLIC_API_PATHS`; bổ sung kiểm thử chứng minh việc chặn route giả mạo theo Nguyên tắc #9.  
**Independent Test**: Gửi request không token tới `/api/fake/health`, `/x/auth/login`, `/something/auth/status` và xác nhận nhận mã 401; gửi request tới route hợp lệ (`/api/auth/login`, `/api/health`, ...) và xác nhận được phép truy cập.

### Tests for User Story 2
- [x] T013 [P] [US2] Add purpose-driven unit tests in `server/controllers/__tests__/authController.test.ts` verifying rejection of pseudo-public suffix spoofed routes (`/api/fake/health`, `/x/auth/login`, `/something/auth/status`) per Principle #9

### Implementation for User Story 2
- [x] T014 [US2] Remove `endsWith()` checks and enforce strict exact matching against `PUBLIC_API_PATHS` in `server/middleware/authMiddleware.ts`

**Checkpoint**: User Story 2 hoàn thành độc lập. Triệt tiêu hoàn toàn nguy cơ bypass xác thực do path confusion.

---

## Phase 5: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T015 [P] Verify 0 `console.*` occurrences in `server/controllers/**` via ripgrep inspection
- [x] T016 Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T017 Run `npm test` (`vitest run`) to verify 100% pass across all unit and integration test suites
- [x] T018 Run `npm run build` to verify clean frontend (Vite) and backend (esbuild) production bundle generation

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 - Blocks User Stories.
- **User Story 1 (Phase 3 - P1)**: Depends on Phase 2 - Can execute independently.
- **User Story 2 (Phase 4 - P1)**: Depends on Phase 2 - Can execute independently or in parallel with US1.
- **Polish & Quality Gates (Phase 5)**: Depends on both US1 and US2 completion.

### User Story Dependencies
- **User Story 1 (P1)**: Independent of User Story 2.
- **User Story 2 (P1)**: Independent of User Story 1.

---

## Parallel Execution Examples

### User Story 1 Parallel Stream
```bash
# Parallel test creation:
Task T003: "Add unit test in server/services/__tests__/geminiService.test.ts"

# Parallel controller migration to Logger:
Task T005: "Replace direct console.* in server/controllers/translation/rawController.ts"
Task T006: "Replace direct console.* in server/controllers/translation/polishController.ts"
Task T007: "Replace direct console.* in server/controllers/translation/qaController.ts"
Task T008: "Replace direct console.* in server/controllers/glossaryController.ts"
Task T009: "Replace direct console.* in server/controllers/alignmentController.ts"
Task T010: "Replace direct console.* in server/controllers/authController.ts"
Task T011: "Replace direct console.* in server/controllers/quotaController.ts"
Task T012: "Replace direct console.* in server/controllers/sessionController.ts"
```

### User Story 2 Parallel Stream
```bash
# Purpose-driven test creation:
Task T013: "Add purpose-driven unit tests in server/controllers/__tests__/authController.test.ts"
```

---

## Implementation Strategy

### MVP Scope (User Story 1 + User Story 2)
1. Complete Phase 1 (Setup) & Phase 2 (Foundational).
2. Complete Phase 3 (US1 - Key Redaction in `geminiService.ts` & Controller `Logger` migration) and validate independently.
3. Complete Phase 4 (US2 - Exact Match in `authMiddleware.ts` & Suffix Spoofing Tests) and validate independently.
4. Execute Phase 5 (Constitution Quality Gates: `npm run lint`, `npm test`, `npm run build`).
