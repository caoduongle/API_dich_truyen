# Tasks: Security Hardening Pass

**Feature**: `003-security-hardening-pass`
**Spec**: [specs/003-security-hardening-pass/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/003-security-hardening-pass/spec.md)
**Plan**: [specs/003-security-hardening-pass/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/003-security-hardening-pass/plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared configuration constants and test harness

- [x] T001 Configure auth rate limit constants (`AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX_REQUESTS`) in `shared/constants.ts`
- [x] T002 [P] Update constants unit tests in `shared/__tests__/constants.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation and text sanitization infrastructure required by all user stories

- [x] T003 [P] Create request body validation utility in `server/utils/validation.ts`
- [x] T004 [P] Implement `sanitizePromptInput` (zero-width & Unicode tag removal) in `server/utils/text.ts`
- [x] T005 [P] Create unit test for text sanitization in `server/utils/__tests__/text.test.ts`

---

## Phase 3: User Story 1 - Bảo vệ thông tin nhạy cảm và tăng cường kiểm soát truy cập (Priority: P1) 🎯 MVP

**Goal**: Che giấu toàn bộ secret trong log/URL, rate limit riêng chống brute-force cho login, sửa hàm đếm Redis session.
**Independent Test**: Gửi request có secret trong URL/body và xác minh log output đã redact; gửi 15 request login sai và xác nhận nhận 429 sau 10 lần; gọi `/api/health` với Redis và xác nhận session count chính xác.

### Tests for User Story 1
- [x] T006 [P] [US1] Create unit tests in `server/utils/__tests__/logger.test.ts` for URL/string/meta secret redaction
- [x] T007 [P] [US1] Create unit tests in `server/middleware/__tests__/rateLimiter.test.ts` for dedicated auth rate limiting

### Implementation for User Story 1
- [x] T008 [US1] Implement `sanitizeSecretString` and update `sanitizeValue` / `formatMessage` in `server/utils/logger.ts`
- [x] T009 [US1] Sanitize query parameters from `originalUrl` before logging/metrics in `server/middleware/metricsMiddleware.ts`
- [x] T010 [US1] Parameterize `createRateLimiter` with custom options and key prefixes in `server/middleware/rateLimiter.ts`
- [x] T011 [US1] Attach dedicated auth rate limiter to `POST /api/auth/login` in `server/routes/api.ts`
- [x] T012 [US1] Fix `getActiveSessionCount()` in `server/services/sessionStore.ts` using non-blocking `SCAN` and `session_keys:*` prefix
- [x] T013 [US1] Update session store tests in `server/controllers/__tests__/sessionController.test.ts`

**Checkpoint**: User Story 1 hoàn thành độc lập và kiểm thử pass 100%.

---

## Phase 4: User Story 2 - Phòng thủ AI và chống Prompt Injection từ văn bản truyện (Priority: P1) 🎯 MVP

**Goal**: Phòng vệ prompt injection cho tất cả các tác vụ Gemini và Gemma, tiền xử lý làm sạch ký tự ẩn.
**Independent Test**: Gửi văn bản truyện chứa ký tự zero-width và câu lệnh "override system instructions" vào API dịch/glossary/QA, xác minh input được làm sạch và AI dịch câu lệnh như lời thoại/nội dung truyện.

### Tests for User Story 2
- [x] T014 [P] [US2] Add unit tests in `server/services/__tests__/geminiService.test.ts` verifying prompt defense framing and Gemma formatting

### Implementation for User Story 2
- [x] T015 [P] [US2] Add `ANTI_INJECTION_DEFENSE_DIRECTIVE` in `server/utils/text.ts` and integrate with `LITERARY_TRANSLATION_FRAMING`
- [x] T016 [P] [US2] Apply `sanitizePromptInput` and defense framing in `server/controllers/translation/rawController.ts`, `polishController.ts`, and `qaController.ts`
- [x] T017 [P] [US2] Apply `sanitizePromptInput` and defense framing in `server/utils/glossaryPrompts.ts`, `server/controllers/glossaryController.ts`, and `server/controllers/alignmentController.ts`
- [x] T018 [US2] Update Gemma prompt construction in `server/services/geminiService.ts` with strict anti-injection boundary delimiters

**Checkpoint**: User Story 2 hoàn thành độc lập, bảo vệ toàn bộ AI pipeline khỏi indirect prompt injection.

---

## Phase 5: User Story 3 - Kiểm soát chặt chẽ dữ liệu đầu vào và chính sách bảo mật trình duyệt (Priority: P2)

**Goal**: Validation nghiêm ngặt request body của toàn bộ POST endpoints và củng cố CSP production.
**Independent Test**: Gửi POST request với body sai kiểu/chứa trường lạ và xác minh mã lỗi 400; build production và mở trình duyệt thật xác minh 0 lỗi vi phạm CSP trên console.

### Tests for User Story 3
- [x] T019 [P] [US3] Add validation rejection tests in `server/controllers/__tests__/authController.test.ts` and `server/controllers/__tests__/translationController.test.ts`

### Implementation for User Story 3
- [x] T020 [P] [US3] Integrate validation helpers into `server/controllers/authController.ts` and `server/controllers/sessionController.ts`
- [x] T021 [P] [US3] Integrate validation helpers into `server/controllers/translation/rawController.ts`, `polishController.ts`, `qaController.ts`, `glossaryController.ts`, and `alignmentController.ts`
- [x] T022 [US3] Update Helmet CSP directives (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`) in `server.ts`
- [x] T023 [US3] Verify production CSP headers and real browser workflows per `specs/003-security-hardening-pass/quickstart.md`

**Checkpoint**: User Story 3 hoàn thành, toàn bộ POST endpoints được validate và CSP production được củng cố.

---

## Phase 6: User Story 4 - Chuẩn hóa quy trình CI/CD và quản trị an toàn thông tin (Priority: P3)

**Goal**: Củng cố pipeline CI/CD, thêm Dependabot và ban hành `SECURITY.md`.
**Independent Test**: Chạy `npm audit --audit-level=high` pass; kiểm tra `.github/workflows/ci.yml` có SHA pin và minimal permissions; kiểm tra `.github/dependabot.yml` và `SECURITY.md`.

### Implementation for User Story 4
- [x] T024 [P] [US4] Update `.github/workflows/ci.yml` with `permissions: contents: read`, pinned action commit SHAs, `npm audit`, and secret scanning step
- [x] T025 [P] [US4] Create `.github/dependabot.yml` for npm and github-actions ecosystems
- [x] T026 [P] [US4] Create `SECURITY.md` in repository root with vulnerability reporting policy and environment-specific deployment checklist

**Checkpoint**: User Story 4 hoàn thành, chuỗi cung ứng mã nguồn và tài liệu bảo mật đạt chuẩn.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T027 Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T028 Run `npm test` (`vitest run`) to verify 100% pass across all unit and integration tests
- [x] T029 Run `npm run build` to verify clean frontend (Vite) and backend (esbuild) bundle generation
- [x] T030 Execute manual verification steps in `specs/003-security-hardening-pass/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 - Blocks User Stories.
- **User Story 1 (Phase 3 - P1)**: Depends on Phase 2 - Can execute independently.
- **User Story 2 (Phase 4 - P1)**: Depends on Phase 2 - Can execute independently or in parallel with US1.
- **User Story 3 (Phase 5 - P2)**: Depends on Phase 2, US1, and US2.
- **User Story 4 (Phase 6 - P3)**: Depends on Phase 1 - Can execute independently.
- **Polish (Phase 7)**: Depends on all User Stories complete.

---

## Parallel Execution Examples

### User Story 1 Parallel Stream
```bash
# Parallel test creation:
Task T006: "Create unit tests in server/utils/__tests__/logger.test.ts"
Task T007: "Create unit tests in server/middleware/__tests__/rateLimiter.test.ts"

# Parallel component updates:
Task T008: "Implement sanitizeSecretString in server/utils/logger.ts"
Task T010: "Parameterize createRateLimiter in server/middleware/rateLimiter.ts"
Task T012: "Fix getActiveSessionCount in server/services/sessionStore.ts"
```

### User Story 2 Parallel Stream
```bash
# Parallel controller prompt defenses:
Task T016: "Apply sanitizePromptInput in rawController.ts, polishController.ts, qaController.ts"
Task T017: "Apply sanitizePromptInput in glossaryPrompts.ts, glossaryController.ts, alignmentController.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)
1. Complete Phase 1 (Setup) & Phase 2 (Foundational).
2. Complete Phase 3 (US1 - Secret & Auth Hardening) and validate independently.
3. Complete Phase 4 (US2 - AI Prompt Defense) and validate independently.
4. Complete Phase 5 (US3 - Request Validation & CSP).
5. Complete Phase 6 (US4 - CI/CD & SECURITY.md).
6. Complete Phase 7 (Quality Gates & Verification).
