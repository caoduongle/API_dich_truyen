# Tasks: Ổn Định Hóa Pipeline Dịch Thuật & Tái Cấu Trúc Toàn Diện (137-pipeline-stabilization-refactor)

**Branch**: `refactor/stabilization-2026-09`
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Chạy baseline verification và chuẩn bị kiểu dữ liệu dùng chung cho toàn bộ refactor.

- [X] T001 Run baseline quality gates: `npm run lint && npm test && npm run build` — chụp kết quả làm mốc so sánh
- [X] T002 [P] Create shared type definitions in `src/services/gemini/types.ts` (ClassifiedErrorCategory, ClassifiedGeminiError, request/response interfaces extracted from plan data-model)
- [X] T003 [P] Create shared type definitions in `src/services/translation/types.ts` (TranslationChunk, bilingual split params/results, raw/polish/qa params/results)
- [X] T004 [P] Create StorageResult type in `src/services/storageResult.ts` (StorageResult<T>, StorageErrorCode, StorageError from data-model)

**Checkpoint**: Kiểu dữ liệu dùng chung biên dịch sạch (`npm run lint`), chưa có logic — chỉ type exports.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hạ tầng cốt lõi mà mọi User Story đều phụ thuộc — `mapWithConcurrencyLimit` tiện ích dùng chung và hàm `getNextPstMidnight`.

**⚠ CRITICAL**: Không bắt đầu Phase 3+ cho đến khi Phase 2 hoàn tất.

- [X] T005 Implement `mapWithConcurrencyLimit<T,R>()` utility in `src/lib/concurrency.ts` — bounded concurrency queue preserving result order, default maxConcurrency=2
- [X] T006 Write unit tests for `mapWithConcurrencyLimit` in `src/lib/__tests__/concurrency.test.ts` — verify max parallel workers, order preservation, error propagation
- [X] T007 Implement `getNextPstMidnight(now)` in `src/services/localQuotaTracker.ts` — compute exact epoch ms of next 00:00:00.000 America/Los_Angeles using Intl.DateTimeFormat
- [X] T008 Write unit tests for `getNextPstMidnight` in `src/services/__tests__/localQuotaTracker.test.ts` — test various PST/PDT boundaries (winter/summer), edge at 23:59 PST, edge at 00:01 PST

**Checkpoint**: `npm run lint && npm test` pass. Hàm tiện ích sẵn sàng cho US1–US3 sử dụng.

---

## Phase 3: User Story 1 — Giám Sát Hạn Ngạch Chuẩn Xác & Phục Hồi Hạn Ngạch Theo Giờ Chuẩn (Priority: P0) 🎯 MVP

**Goal**: Dashboard hạn ngạch phản ánh đúng RPM (đếm mọi lượt thử) và TPM (chỉ đếm token thành công). Khi cạn hạn ngạch ngày, khóa bị khóa chính xác đến 00:00 PST.

**Independent Test**: Ghi nhận 3 lần `recordProviderAttempt` (2 lỗi + 1 success) → `requestsThisMinute = 3`. Giả lập QuotaExhausted lúc 22:00 PST → `cooldownUntil` đúng 00:00 PST (còn 2h, không phải 4h).

### Implementation for User Story 1

- [X] T009 [US1] Refactor `InternalKeyStats` in `src/services/localQuotaTracker.ts` — replace single `recentCalls: CallLogEntry[]` with `recentAttempts: CallAttemptEntry[]` and `recentTokens: CallTokenEntry[]`
- [X] T010 [US1] Refactor `InternalModelStats` in `src/services/localQuotaTracker.ts` — same split: `recentAttempts` + `recentTokens` replacing `recentCalls`
- [X] T011 [US1] Update `recordProviderAttempt()` in `src/services/localQuotaTracker.ts` — push `{ timestamp: now }` into `keyStats.recentAttempts` AND `mStats.recentAttempts`
- [X] T012 [US1] Update `recordSuccess()` in `src/services/localQuotaTracker.ts` — push `{ timestamp, tokens }` into `keyStats.recentTokens` AND `mStats.recentTokens`; remove old `recentCalls.push()`
- [X] T013 [US1] Update `getQuotaStatus()` in `src/services/localQuotaTracker.ts` — filter `recentAttempts` for RPM (`requestsThisMinute`), filter `recentTokens` for TPM (`tokensThisMinute`); remove old `recentCalls` filter
- [X] T014 [US1] Update `saveToStorage()` and `loadFromStorage()` in `src/services/localQuotaTracker.ts` — serialize/deserialize new `recentAttempts`/`recentTokens` arrays instead of `recentCalls`
- [X] T015 [US1] Update `getOrCreateKeyStats()` in `src/services/localQuotaTracker.ts` — initialize `recentAttempts: []` and `recentTokens: []` instead of `recentCalls: []`
- [X] T016 [US1] Fix QuotaExhausted cooldown in `recordFailure()` in `src/services/localQuotaTracker.ts` — replace `now + 4 * 3600 * 1000` with `getNextPstMidnight(now)`
- [X] T017 [US1] Update existing tests in `src/services/__tests__/localQuotaTracker.test.ts` — fix any test referencing `recentCalls` to use `recentAttempts`/`recentTokens`; add tests for RPM counting all attempts and PST cooldown accuracy
- [X] T018 [US1] Run `npm run lint && npm test && npm run build` — verify zero regressions after quota tracker refactor

**Checkpoint**: Quota tracker chuẩn xác — `npm test` pass 100%. MVP hoàn tất cho hạn ngạch.

---

## Phase 4: User Story 2 — Nhận Diện Lỗi API Bền Vững & Chuyển Đổi Khóa Linh Hoạt (Priority: P0) 🎯 MVP

**Goal**: Phân loại lỗi 429 dựa trên cấu trúc chi tiết phản hồi (HTTP status, error.details, error.status) trước fallback chuỗi thông báo. Áp dụng đúng cooldown ngắn (RPM) hoặc dài (RPD).

**Independent Test**: Mock lỗi 429 với `details: [{ @type: 'QuotaFailure', violations: [{ subject: 'RequestsPerDay' }] }]` → phân loại đúng `QUOTA_EXHAUSTED_RPD`. Mock lỗi 429 không có `details` nhưng message chứa "rate limit" → `RATE_LIMIT_RPM`.

### Implementation for User Story 2

- [X] T019 [US2] Create `src/services/gemini/geminiErrorClassifier.ts` — implement `classifyGeminiError(httpStatus, responseBody, networkError?)` returning `ClassifiedGeminiError` with priority: details[QuotaFailure/ErrorInfo] > rpcStatus > httpStatus > message fallback
- [X] T020 [US2] Write unit tests in `src/services/gemini/__tests__/geminiErrorClassifier.test.ts` — cover RPD via QuotaFailure details, RPM via ErrorInfo with Minute metadata, 401/403 auth, 503 overload, network errors, message-only fallback
- [X] T021 [US2] Integrate `classifyGeminiError` into `recordFailure()` in `src/services/localQuotaTracker.ts` — replace `msg.toLowerCase().includes(...)` branches with structured classification; use `getNextPstMidnight(now)` for RPD, 45s for RPM, 15s for 503
- [X] T022 [US2] Integrate `classifyGeminiError` into error handling in `src/services/directGeminiClient.ts` — pass parsed `errJson.error` to classifier for `recordFailure` calls; ensure `isRateLimit`/`isAuthError`/`isOverload` flags derived from classifier output
- [X] T023 [US2] Update existing tests in `src/services/__tests__/directGeminiClient.test.ts` — verify classifier integration doesn't break key rotation and retry behavior
- [X] T024 [US2] Run `npm run lint && npm test && npm run build` — verify zero regressions

**Checkpoint**: Lỗi API được phân loại bền vững — không phụ thuộc wording. `npm test` pass 100%.

---

## Phase 5: User Story 3 — Phân Đoạn Thích Ứng Khớp Ngữ Cảnh & Kiểm Soát Tải Đồng Thời (Priority: P0) 🎯 MVP

**Goal**: Văn bản nguồn và bản thô được chia thành TranslationChunk[] khớp ranh giới đoạn 1:1. Phân đoạn song song qua concurrency limiter thay vì `Promise.all` bùng nổ.

**Independent Test**: Văn bản Trung 10 đoạn, bản Việt 10 đoạn → 2 chunks, mỗi chunk chứa đoạn nguồn/thô cùng chỉ số. Phân đoạn 6 chunks với `maxConcurrency=2` → không quá 2 promise chạy cùng lúc.

### Implementation for User Story 3

- [X] T025 [US3] Create `src/services/translation/bilingualSplit.ts` — implement `splitBilingualAdaptively(sourceText, rawText, targetParts)` returning `TranslationChunk[]` using shared paragraph boundaries (parity mapping + proportional fallback)
- [X] T026 [US3] Write unit tests in `src/services/translation/__tests__/bilingualSplit.test.ts` — test parity mapping (equal paragraph count), proportional mapping (unequal counts), single-paragraph text, empty text, text without newlines
- [X] T027 [US3] Refactor `polishWithContentSplitDirect()` pre-split path (depth===0) in `src/services/directTranslationEngine.ts` — replace independent `splitTextAdaptively(source)` + `splitTextAdaptively(raw)` with `splitBilingualAdaptively(source, raw)`, iterate over `TranslationChunk[]`
- [X] T028 [US3] Refactor `polishWithContentSplitDirect()` retry split path (depth>0, catch block) in `src/services/directTranslationEngine.ts` — replace `Promise.all(sourceParts.map(...))` with `mapWithConcurrencyLimit(chunks, 2, worker)` from `src/lib/concurrency.ts`
- [X] T029 [US3] Update existing tests in `src/services/__tests__/directTranslationEngine.test.ts` — verify polishWithContentSplitDirect still produces correct combined output with bilingual chunks and concurrency limiter
- [X] T030 [US3] Run `npm run lint && npm test && npm run build` — verify zero regressions

**Checkpoint**: Phân đoạn an toàn ngữ cảnh, tải có kiểm soát — `npm test` pass 100%. Toàn bộ P0 hoàn tất.

---

## Phase 6: User Story 4 — Mô-đun Hóa Bộ Dịch & Trình Kết Nối Dịch Vụ AI (Priority: P1)

**Goal**: Phân rã `callGeminiDirect` (God Function) và `directTranslationEngine` (God Service) thành các module nhỏ có test độc lập, giữ facade tương thích ngược 100%.

**Independent Test**: Mọi bài test hiện tại gọi `callGeminiDirect` và `directTranslationEngine` exports tiếp tục pass mà không sửa import.

### Implementation for User Story 4

- [X] T031 [P] [US4] Create `src/services/gemini/geminiRequestBuilder.ts` — extract model name normalization, endpoint URL construction, JSON payload building from `callGeminiDirect`
- [X] T032 [P] [US4] Create `src/services/gemini/geminiTransport.ts` — extract `fetch()` call with headers, AbortController/signal handling, response.json() parsing from `callGeminiDirect`
- [X] T033 [P] [US4] Create `src/services/gemini/geminiKeyScheduler.ts` — extract key selection loop, `findNextAvailableKeyIndex` integration, `attemptsCount` tracking from `callGeminiDirect`
- [X] T034 [US4] Create `src/services/gemini/geminiClient.ts` — orchestrate RequestBuilder + Transport + ErrorClassifier + KeyScheduler into the main call-retry loop; export `callGemini(options): Promise<DirectGeminiResponse>`
- [X] T035 [US4] Write unit tests in `src/services/gemini/__tests__/geminiRequestBuilder.test.ts` — verify model normalization, URL construction, payload structure
- [X] T036 [US4] Write unit tests in `src/services/gemini/__tests__/geminiClient.test.ts` — verify retry with key rotation, error classification integration, success path token recording
- [X] T037 [US4] Refactor `src/services/directGeminiClient.ts` to thin facade — `callGeminiDirect` delegates to `geminiClient.callGemini()`, re-exports all existing public types unchanged
- [X] T038 [US4] Verify backward compatibility: run `npm test src/services/__tests__/directGeminiClient.test.ts src/services/__tests__/clientKeyRotation.test.ts` — must pass 100% without any test modifications
- [X] T039 [P] [US4] Create `src/services/translation/rawTranslation.ts` — extract `translateRawDirect()` logic from `directTranslationEngine.ts`
- [X] T040 [P] [US4] Create `src/services/translation/polishTranslation.ts` — extract `polishTranslationDirect()` and `polishWithContentSplitDirect()` logic from `directTranslationEngine.ts`
- [X] T041 [P] [US4] Create `src/services/translation/qaCritique.ts` — extract `qaTranslationDirect()` logic from `directTranslationEngine.ts`
- [X] T042 [P] [US4] Create `src/services/translation/sentenceRewrite.ts` — extract `rewriteSentenceDirect()` logic from `directTranslationEngine.ts`
- [X] T043 [P] [US4] Create `src/services/translation/translationValidation.ts` — extract `ensureChapterTitlePreserved()`, paragraph parity checks, truncation detection logic from `directTranslationEngine.ts`
- [X] T044 [US4] Create `src/services/translation/index.ts` — unified public API re-exporting all translation functions
- [X] T045 [US4] Refactor `src/services/directTranslationEngine.ts` to thin facade — re-export from `src/services/translation/index.ts`, preserving all existing function signatures
- [X] T046 [US4] Verify backward compatibility: run `npm test src/services/__tests__/directTranslationEngine.test.ts src/services/__tests__/directGlossaryEngine.test.ts src/services/__tests__/hakoQualityEngine.test.ts` — must pass 100% without any test modifications
- [X] T047 [US4] Run `npm run lint && npm test && npm run build` — full suite green

**Checkpoint**: God modules phân rã thành công, tương thích ngược 100%. `npm test` pass toàn bộ.

---

## Phase 7: User Story 5 — Khắc Phục Xung Đột Đám Mây & Minh Bạch Hóa Lưu Trữ Cục Bộ (Priority: P1)

**Goal**: Drive không tạo folder trùng lặp khi đa tab. Cache folder gắn theo user. IndexedDB lỗi trả về cấu trúc `StorageResult` rõ ràng.

**Independent Test**: Hai cuộc gọi `ensureAppFolder()` song song chỉ tạo 1 thư mục. `getProjectsFromDB()` khi IndexedDB bị chặn trả về `{ ok: false, error: { code: 'STORAGE_BLOCKED' } }` thay vì `[]`.

### Implementation for User Story 5

- [X] T048 [US5] Add single-flight promise lock to `ensureAppFolder()` in `src/services/googleDriveService.ts` — reuse inflight promise for concurrent callers; add post-create reconciliation to pick oldest folder if duplicates exist
- [X] T049 [US5] Scope `cachedFolderId` to authenticated user in `src/services/googleDriveService.ts` — store as `Map<userId, folderId>` or clear cache when auth token changes; invalidate on logout
- [X] T050 [US5] Add `StorageResult<T>` wrapper functions in `src/services/db.ts` — create `getProjectsResultFromDB()`, `getProjectResultFromDB()` returning `StorageResult<T>` with distinct error codes; keep legacy functions logging errors but calling new wrappers internally
- [X] T051 [US5] Write unit tests for StorageResult wrappers in `src/services/__tests__/db.test.ts` — mock IndexedDB failure scenarios, verify error codes (STORAGE_BLOCKED, QUOTA_EXCEEDED) vs empty-data distinction
- [X] T052 [US5] Run `npm run lint && npm test && npm run build` — verify zero regressions

**Checkpoint**: Lưu trữ minh bạch, Drive an toàn đa tab. `npm test` pass 100%.

---

## Phase 8: User Story 6 — Tăng Cường Bảo Mật Giao Diện & Tối Ưu Môi Trường Dự Án (Priority: P2)

**Goal**: Loại bỏ `dangerouslySetInnerHTML`, siết CSP, sửa script `clean` cho Windows, gỡ `dotenv`.

**Independent Test**: `npm run clean` chạy thành công trên Windows PowerShell. `DiffModal` render `<mark>` elements qua React nodes. `dotenv` không còn trong `package.json`.

### Implementation for User Story 6

- [X] T053 [P] [US6] Refactor `buildHighlightedHtml()` in `src/components/auto-translator/DiffModal.tsx` — replace string HTML generation + `dangerouslySetInnerHTML` with a `buildHighlightedNodes()` function returning `ReactNode[]` (alternating text spans and `<mark>` elements)
- [X] T054 [P] [US6] Update `"clean"` script in `package.json` — replace `"rm -rf dist"` with `"node -e \"const fs=require('fs');fs.rmSync('dist',{recursive:true,force:true})\""` for cross-platform Windows/Linux/macOS compatibility
- [X] T055 [P] [US6] Remove `dotenv` dependency from `package.json` — run `npm uninstall dotenv`; verify no runtime imports reference it
- [X] T056 [US6] Audit and tighten CSP `connect-src` in `index.html` — replace `https://*.googleapis.com` with specific endpoints (`https://generativelanguage.googleapis.com`, `https://www.googleapis.com`, `https://oauth2.googleapis.com`); review `style-src` for `unsafe-inline` necessity
- [X] T057 [US6] Write security test for DiffModal in `src/components/auto-translator/__tests__/DiffModal.test.tsx` — render with malicious input (`<script>`, `<img onerror>`, `<a href="javascript:">`) and verify no raw HTML injection occurs
- [X] T058 [US6] Run `npm run lint && npm test && npm run build` — verify zero regressions

**Checkpoint**: Bảo mật giao diện tăng cường, môi trường tối ưu. `npm test` pass 100%.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Kiểm tra toàn diện, dọn dẹp cuối cùng trước khi merge.

- [X] T059 Run full quality gates: `npm run lint && npm test && npm run build` — final confirmation all green
- [X] T060 Run `npm run clean` on Windows PowerShell — verify cross-platform clean works
- [X] T061 Run quickstart.md validation scenarios manually — execute each scenario from specs/137-pipeline-stabilization-refactor/quickstart.md
- [X] T062 [P] Verify no unused imports or dead code introduced by refactor — search for orphan references to old `recentCalls`, removed functions, etc.
- [X] T063 Update README.md architecture section if refactored module paths changed — keep documentation in sync per Constitution Principle V

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T002–T004 type definitions from Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (T007–T008 specifically) — can proceed independently of US2–US6
- **US2 (Phase 4)**: Depends on Phase 2 (T002 types) — can proceed in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 (T005–T006 concurrency, T003 types) — can proceed in parallel with US1/US2
- **US4 (Phase 6)**: Depends on US1 + US2 + US3 completion (quota tracker, error classifier, bilingual split are inputs to the refactored modules)
- **US5 (Phase 7)**: Depends on Phase 2 (T004 StorageResult types) — can proceed in parallel with US1–US3
- **US6 (Phase 8)**: No dependencies on US1–US5 — can proceed in parallel after Phase 2
- **Polish (Phase 9)**: Depends on all previous phases being complete

### User Story Dependencies

```text
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)
    │
    ├──────────────┬──────────────┬───────────────┐
    ▼              ▼              ▼               ▼
Phase 3 (US1)  Phase 4 (US2)  Phase 5 (US3)  Phase 7 (US5)  Phase 8 (US6)
  Quota Fix      Error Class    Split Fix      DB/Drive Fix   Security
    │              │              │
    └──────────────┴──────────────┘
                   │
                   ▼
             Phase 6 (US4)
           Module Refactor
                   │
                   ▼
             Phase 9 (Polish)
```

### Parallel Opportunities

- **Phase 2**: T005 and T007 can run in parallel (concurrency limiter vs PST midnight — different files)
- **Phase 3 (US1)**: T009–T010 can run in parallel (key stats vs model stats — same file but different interfaces)
- **Phase 4 (US2)**: T019 and T020 can run in parallel (implementation + tests — different files)
- **Phase 5 (US3)**: T025 and T026 can run in parallel (implementation + tests — different files)
- **Phase 6 (US4)**: T031–T033 can run in parallel (request builder, transport, key scheduler — different files); T039–T043 can run in parallel (raw, polish, qa, rewrite, validation — different files)
- **Phase 8 (US6)**: T053–T055 can run in parallel (DiffModal, clean script, dotenv — different files)
- **Cross-phase**: US1, US2, US3, US5, US6 can all proceed in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Sequential within US1 (same file modifications):
Task T009: Refactor InternalKeyStats (recentAttempts/recentTokens)
Task T010: Refactor InternalModelStats (same pattern)
Task T011: Update recordProviderAttempt
Task T012: Update recordSuccess
Task T013: Update getQuotaStatus
Task T014: Update saveToStorage/loadFromStorage
Task T015: Update getOrCreateKeyStats
Task T016: Fix QuotaExhausted cooldown
Task T017: Update/add tests
Task T018: Run quality gates
```

## Parallel Example: Cross-Phase

```bash
# After Phase 2 completes, launch in parallel:
Agent A: Phase 3 (US1) — Quota Tracker fixes
Agent B: Phase 4 (US2) — Error Classifier
Agent C: Phase 5 (US3) — Bilingual Split
Agent D: Phase 7 (US5) — DB/Drive fixes
Agent E: Phase 8 (US6) — Security/cleanup
```

---

## Implementation Strategy

### MVP First (User Stories 1–3 Only = All P0 items)

1. Complete Phase 1: Setup (type definitions)
2. Complete Phase 2: Foundational (concurrency limiter + PST midnight)
3. Complete Phase 3: US1 — Quota Tracker RPM/TPM accuracy + PST cooldown
4. **STOP and VALIDATE**: `npm run lint && npm test && npm run build`
5. Complete Phase 4: US2 — Structured error classification
6. Complete Phase 5: US3 — Bilingual split + concurrency limiter
7. **STOP and VALIDATE**: All P0 items done, full test suite green

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Quota fix) → Test independently → P0 milestone 1
3. Add US2 (Error classify) → Test independently → P0 milestone 2
4. Add US3 (Split fix) → Test independently → **P0 complete** 🎯
5. Add US4 (Module refactor) → Test backward compatibility → P1 milestone 1
6. Add US5 (DB/Drive fix) → Test independently → P1 milestone 2
7. Add US6 (Security/cleanup) → Test independently → **P2 complete**
8. Polish & merge

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [USn] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- **CRITICAL**: `src/services/directGeminiClient.ts` and `src/services/directTranslationEngine.ts` MUST remain as working facades after refactor — all existing tests must pass without modification to test files
