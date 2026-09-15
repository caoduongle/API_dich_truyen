# Tasks: Khắc Phục Kiểm Toán & Gia Cố Tính Nhất Quán (138-audit-remediation-hardening)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-15

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Không cần khởi tạo dự án mới — dự án đã tồn tại. Phase này xác nhận trạng thái cơ sở trước khi sửa đổi.

- [X] T001 Chạy xác nhận baseline: `npm run lint && npm test && npm run build` — ghi nhận toàn bộ 701 tests pass, 0 lỗi kiểu, build thành công
- [X] T002 Tạo file module hàng đợi ghi mới `src/services/projectStorageQueue.ts` (file trống khung, sẽ triển khai chi tiết ở Phase 4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nâng cấp hàm băm khóa API sang SHA-256 chuẩn — đây là phụ thuộc nền tảng vì `keyHash` được dùng làm khóa chính trong toàn bộ hệ thống quota tracker và key scheduler.

> **⚠ CRITICAL**: Phase này phải hoàn thành trước khi bắt đầu các User Story vì thay đổi `hashApiKey()` ảnh hưởng xuyên suốt hệ thống.

- [X] T003 [US4] Triển khai thuật toán SHA-256 đồng bộ thuần JavaScript trong `src/services/localQuotaTracker.ts` — thay thế khối fallback băm số nguyên 32-bit (dòng 151–156) bằng hàm SHA-256 bitwise chuẩn RFC 6234 hoặc tận dụng `crypto.subtle.digest` kèm bộ nhớ đệm `keyHashCache: Map<string, string>` toàn cục
- [X] T004 [US4] Cung cấp hàm `hashApiKeyAsync(key: string): Promise<string>` trong `src/services/localQuotaTracker.ts` — sử dụng `window.crypto.subtle.digest('SHA-256', ...)` cho luồng khởi tạo bất đồng bộ, nạp kết quả vào `keyHashCache` để `hashApiKey(key)` đồng bộ tra cứu tức thì
- [X] T005 [US4] Cập nhật bài kiểm thử băm khóa trong `src/utils/__tests__/credentialStorage.test.ts` — xác nhận mã băm luôn 64 ký tự hex `/^[0-9a-f]{64}$/`, kết quả đồng nhất giữa Node.js Crypto và thuật toán JS, hai khóa khác nhau không va chạm, bộ nhớ đệm trả về kết quả đúng

**Checkpoint**: Hàm `hashApiKey()` tạo ra chuỗi SHA-256 64 hex chuẩn trên mọi nền tảng; toàn bộ bài kiểm thử hiện có vẫn pass.

---

## Phase 3: User Story 1 — Ghi Nhận Lỗi Cuộc Gọi Chuẩn Xác (Priority: P1) 🎯 MVP

**Goal**: Mỗi lượt thử gọi API thất bại chỉ kích hoạt `recordFailure()` đúng 1 lần duy nhất, loại bỏ lỗi đếm nhân đôi.

**Independent Test**: Giả lập phản hồi HTTP 429/403 và lỗi mạng `TypeError: Failed to fetch` — xác nhận `errorsTotal` và `consecutiveErrors` chỉ tăng 1 đơn vị cho mỗi lượt thử.

### Implementation for User Story 1

- [X] T006 [US1] Thêm cờ kiểm soát `let attemptFailureRecorded = false` trong vòng lặp `while` của hàm `callGemini()` tại `src/services/gemini/geminiClient.ts` (dòng 27) — gán `true` sau khi gọi `recordFailure()` trong khối `if (!response.ok)` (dòng 51), reset về `false` khi chuyển sang khóa tiếp theo
- [X] T007 [US1] Bọc lệnh `recordFailure()` trong khối `catch (err: any)` (dòng 129) bằng điều kiện `if (!attemptFailureRecorded)` tại `src/services/gemini/geminiClient.ts` — chỉ ghi nhận lỗi mạng thực sự chưa được ghi nhận; gán `attemptFailureRecorded = true` sau khi gọi
- [X] T008 [US1] Bổ sung bài kiểm thử xác nhận không đếm lặp lỗi trong `src/services/gemini/__tests__/geminiClient.test.ts` — test case: giả lập HTTP 429 rồi kiểm tra `errorsTotal` tăng đúng 1x (không phải 2x); test case: giả lập `TypeError: Failed to fetch` rồi kiểm tra `errorsTotal` tăng đúng 1x

**Checkpoint**: Lỗi HTTP và lỗi mạng đều chỉ ghi nhận đúng 1 lần. Toàn bộ test suite pass.

---

## Phase 4: User Story 2 — Bảo Toàn Trạng Thái Nghỉ Khi Tải Lại (Priority: P1) 🎯 MVP

**Goal**: Khi reload trang, các khóa đang ở trạng thái `QuotaExhausted`, `RateLimited`, hoặc `Cooldown` giữ nguyên trạng thái cho đến khi thời gian làm nguội kết thúc hoặc bước sang ngày mới PST.

**Independent Test**: Đưa khóa vào `QuotaExhausted`, reload lại tracker từ `sessionStorage` — khóa vẫn `QuotaExhausted` với cooldown đến 00:00 PST. Giả lập đổi ngày — khóa tự động mở lại.

### Implementation for User Story 2

- [X] T009 [US2] Mở rộng `saveToStorage()` trong `src/services/localQuotaTracker.ts` (dòng 222–264) — lưu trữ thêm các trường `circuitBreakerStatus`, `cooldownUntil`, `lastTransitionAt`, `consecutiveErrors`, `consecutiveSuccesses` vào đối tượng tuần tự hóa của mỗi khóa
- [X] T010 [US2] Cập nhật `loadFromStorage()` trong `src/services/localQuotaTracker.ts` (dòng 185–220) — triển khai logic phục hồi thông minh: (a) nếu khác ngày PST: reset bộ đếm ngày, giải phóng `QuotaExhausted` về `Healthy`; (b) nếu cùng ngày: giữ nguyên `QuotaExhausted` (với `cooldownUntil = getNextPstMidnight()`), giữ nguyên `RateLimited`/`Cooldown` nếu `now < cooldownUntil` (nếu hết hạn thì phục hồi `Healthy`), giữ nguyên `AuthFailed`
- [X] T011 [US2] Bổ sung bài kiểm thử bảo toàn trạng thái trong `src/services/__tests__/localQuotaTracker.test.ts` — test case: lưu trạng thái `QuotaExhausted` vào sessionStorage rồi nạp lại → vẫn `QuotaExhausted`; test case: lưu `RateLimited` với cooldown 45s rồi nạp lại → vẫn `RateLimited`; test case: giả lập đổi ngày PST → `QuotaExhausted` giải phóng thành `Healthy`; test case: cooldown đã hết hạn → phục hồi `Healthy`

**Checkpoint**: Trạng thái quota và circuit breaker bảo toàn chính xác qua reload. Test suite pass.

---

## Phase 5: User Story 3 — Tuần Tự Hóa Thao Tác Ghi Dự Án (Priority: P1) 🎯 MVP

**Goal**: Mọi thao tác `saveProjectToDB` phát sinh từ `useProjects.ts` được điều phối qua hàng đợi tuần tự FIFO, loại bỏ hoàn toàn race condition.

**Independent Test**: Kích hoạt 5 thao tác thêm từ điển liên tiếp trong 10ms — bản ghi cuối cùng trong IndexedDB chứa đầy đủ 5 từ.

### Implementation for User Story 3

- [X] T012 [US3] Triển khai module `src/services/projectStorageQueue.ts` — xuất hàm `enqueueProjectSave(project: StoryProject): Promise<void>` sử dụng chuỗi Promise tuần tự (`.catch(() => {}).then(() => saveProjectToDB(project))`), xuất hàm `waitForQueueIdle(): Promise<void>` cho kiểm thử
- [X] T013 [US3] Cập nhật `src/hooks/useProjects.ts` — thay thế tất cả các lệnh gọi fire-and-forget `saveProjectToDB(updatedToSave)` (tại các dòng 220, 261, 282, 303, 337, 411, 446, 469) bằng `enqueueProjectSave(updatedToSave)` được import từ `projectStorageQueue.ts`
- [X] T014 [US3] Bổ sung bài kiểm thử hàng đợi ghi tuần tự trong `src/services/__tests__/projectStorageQueue.test.ts` — test case: 5 lần ghi liên tiếp hoàn thành tuần tự; test case: lỗi lưu trữ ở tác vụ thứ 2 không làm đứt chuỗi cho tác vụ thứ 3, 4, 5; test case: `waitForQueueIdle()` resolve khi hàng đợi rỗng

**Checkpoint**: Các thao tác cập nhật dự án nhanh liên tiếp không gây mất mát dữ liệu. Test suite pass.

---

## Phase 6: User Story 5 — Thống Nhất Tài Liệu Kiến Trúc & Bảo Mật (Priority: P2)

**Goal**: Toàn bộ tài liệu kỹ thuật phản ánh trung thực 100% kiến trúc thuần Client-side SPA hiện tại.

**Independent Test**: Đọc `docs/model-system.md`, `SECURITY.md`, `.env.example` — không còn bất kỳ tham chiếu nào đến Express Server, `/api/list-models`, `/api/verify-model`, "Zero-Server-Knowledge", hay "mã hóa IndexedDB".

### Implementation for User Story 5

- [X] T015 [P] [US5] Cập nhật `docs/model-system.md` — thay thế sơ đồ mermaid tuần tự chứa `Express Server` (dòng 26–51) bằng sơ đồ luồng Client-Direct gọi `Google Gemini API` trực tiếp qua `directGeminiClient.ts` / `@google/genai` kèm SWR cache cục bộ `localStorage`; thay các tham chiếu `/api/list-models` bằng `listModelsDirect()` và `/api/verify-model` bằng `verifyModelDirect()`
- [X] T016 [P] [US5] Cập nhật `SECURITY.md` — thay thế cụm "Zero-Server-Knowledge" (dòng 41) bằng "Client-Direct Architecture (Không trung gian máy chủ)"; loại bỏ mô tả gây hiểu lầm rằng client-side storage an toàn tuyệt đối; đồng bộ danh sách miền CSP `connect-src` với nội dung thực tế trong `vercel.json`
- [X] T017 [P] [US5] Cập nhật `.env.example` — sửa dòng 6 "lưu an toàn trong sessionStorage trình duyệt hoặc mã hóa IndexedDB" thành "lưu trong sessionStorage của trình duyệt người dùng (phía client, không có mã hóa tầng ứng dụng)"

**Checkpoint**: Tài liệu kỹ thuật đồng bộ 1:1 với mã nguồn thực tế. Grep "Express Server", "/api/list-models", "Zero-Server-Knowledge", "mã hóa IndexedDB" trả về 0 kết quả.

---

## Phase 7: User Story 6 — Đồng Bộ Hợp Đồng & Ngữ Nghĩa Bộ Phân Đoạn Song Ngữ (Priority: P2)

**Goal**: Kiểu hợp đồng `BilingualSplitOptions` khớp với hàm thực thi `splitBilingualAdaptively`; thuật toán bảo vệ tính toàn vẹn câu/đoạn khi số đoạn văn hai bên lệch nhau.

**Independent Test**: Phân đoạn văn bản 10 đoạn Trung + 4 đoạn Việt — mỗi khối đều có nội dung hoàn chỉnh theo đoạn nguyên vẹn, không có khối rỗng.

### Implementation for User Story 6

- [X] T018 [US6] Cập nhật hàm `splitBilingualAdaptively` trong `src/services/translation/bilingualSplit.ts` — hỗ trợ overload nhận cả `(sourceText, rawText, targetParts)` lẫn `(options: BilingualSplitOptions)` thông qua kiểm tra kiểu tham số đầu tiên (`typeof arguments[0] === 'object'`)
- [X] T019 [US6] Cải thiện thuật toán ghép đoạn văn trong `src/services/translation/bilingualSplit.ts` — khi `rawParas.length` chênh lệch lớn với `sourceParas.length`, tính `parts = Math.min(targetParts, Math.min(sourceParas.length, rawParas.length))` và bảo đảm mỗi khối ít nhất 1 đoạn văn, không tạo khối rỗng
- [X] T020 [US6] Cập nhật hợp đồng kiểu tại `specs/137-pipeline-stabilization-refactor/contracts/bilingual-split.contract.ts` — đồng bộ chữ ký hàm `splitBilingualAdaptively` với kiểu overload thực tế
- [X] T021 [US6] Bổ sung bài kiểm thử trong `src/services/translation/__tests__/bilingualSplit.test.ts` — test case: gọi bằng đối tượng `BilingualSplitOptions` cho kết quả tương đương gọi bằng tham số vị trí; test case: 10 đoạn Trung + 4 đoạn Việt → không có khối rỗng, mỗi khối có nội dung cả hai bên

**Checkpoint**: Hợp đồng kiểu và hàm thực thi đồng bộ. Phân đoạn không tạo khối rỗng. Test suite pass.

---

## Phase 8: User Story 7 — Minh Bạch Hóa Kết Quả Truy Vấn IndexedDB (Priority: P2)

**Goal**: Phân biệt rõ ràng giữa cơ sở dữ liệu rỗng (dữ liệu chưa có) và lỗi truy cập lưu trữ (phần cứng / quyền hạn).

**Independent Test**: Giả lập lỗi IndexedDB — phương thức trả về `StorageResult` với `success: false` thay vì `[]` hoặc `null`.

### Implementation for User Story 7

- [X] T022 [US7] Rà soát và cập nhật các hàm `getProjectsFromDB()`, `getProjectFromDB()`, `getChapterFromDB()` trong `src/services/db.ts` — đối với các hàm hiện trả về `[]`/`null` khi gặp lỗi, bổ sung log cảnh báo rõ ràng phân biệt giữa "empty result" và "storage error" tại tầng gọi; nếu đã có `StorageResult<T>` thì ưu tiên sử dụng nhất quán
- [X] T023 [US7] Bổ sung bài kiểm thử phân biệt lỗi lưu trữ trong `src/services/__tests__/dbStorageAudit.test.ts` — test case: giả lập lỗi truy cập IndexedDB → kết quả chứa chỉ báo lỗi rõ ràng; test case: cơ sở dữ liệu rỗng bình thường → kết quả thành công với mảng rỗng

**Checkpoint**: Ứng dụng không nhầm lẫn giữa lỗi hệ thống và trạng thái chưa có dữ liệu. Test suite pass.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Xác nhận toàn bộ, dọn dẹp và kiểm tra chéo.

- [X] T024 Chạy bộ ba lệnh kiểm tra chất lượng bắt buộc: `npm run lint && npm test && npm run build` — xác nhận toàn bộ 700+ tests pass, 0 lỗi kiểu, build production thành công
- [X] T025 [P] Chạy kịch bản xác thực nhanh `specs/138-audit-remediation-hardening/quickstart.md` — kiểm tra từng mô-đun theo hướng dẫn
- [X] T026 [P] Grep toàn bộ repo xác nhận không còn tham chiếu sai lệch: `Express Server`, `/api/list-models`, `/api/verify-model`, `Zero-Server-Knowledge`, `mã hóa IndexedDB` → 0 kết quả
- [X] T027 Rà soát commit diff cuối cùng — đảm bảo mỗi file sửa đổi nằm trong phạm vi kế hoạch, không có thay đổi ngoài phạm vi

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Không phụ thuộc — bắt đầu ngay
- **Phase 2 (Foundational — SHA-256)**: Phụ thuộc Phase 1 — **BLOCKS tất cả User Story** vì `hashApiKey` là khóa chính trong hệ thống quota
- **Phase 3 (US1 — Single Failure)**: Phụ thuộc Phase 2
- **Phase 4 (US2 — State Persistence)**: Phụ thuộc Phase 2 — **Có thể chạy song song với Phase 3** (khác file: `localQuotaTracker.ts` vs `geminiClient.ts`)
- **Phase 5 (US3 — Write Queue)**: Phụ thuộc Phase 2 — **Có thể chạy song song với Phase 3 và 4** (khác file: `projectStorageQueue.ts`, `useProjects.ts`)
- **Phase 6 (US5 — Documentation)**: Phụ thuộc Phase 2 — **Có thể chạy song song với Phase 3–5** (khác file: `docs/`, `SECURITY.md`, `.env.example`)
- **Phase 7 (US6 — Bilingual Split)**: Phụ thuộc Phase 2 — **Có thể chạy song song với Phase 3–6** (khác file: `bilingualSplit.ts`)
- **Phase 8 (US7 — DB Transparency)**: Phụ thuộc Phase 2 — **Có thể chạy song song với Phase 3–7** (khác file: `db.ts`)
- **Phase 9 (Polish)**: Phụ thuộc tất cả Phase 3–8 hoàn thành

### User Story Dependencies

- **US1 (Single Failure Recording)**: Độc lập — chỉ sửa `geminiClient.ts`
- **US2 (State Persistence)**: Độc lập — chỉ sửa `localQuotaTracker.ts` (save/load)
- **US3 (Write Queue)**: Độc lập — tạo mới `projectStorageQueue.ts`, sửa `useProjects.ts`
- **US4 (SHA-256 Hash)**: **Nền tảng** — sửa `localQuotaTracker.ts` (hashApiKey), ảnh hưởng tất cả
- **US5 (Documentation)**: Độc lập — chỉ sửa file docs
- **US6 (Bilingual Split)**: Độc lập — chỉ sửa `bilingualSplit.ts`
- **US7 (DB Transparency)**: Độc lập — chỉ sửa `db.ts`

### Within Each User Story

- Triển khai logic trước
- Bổ sung bài kiểm thử song song hoặc ngay sau
- Xác nhận test suite pass trước khi chuyển story tiếp theo

### Parallel Opportunities

```text
Sau khi Phase 2 (SHA-256) hoàn thành:

  [Song song A] Phase 3: US1 — geminiClient.ts
  [Song song B] Phase 4: US2 — localQuotaTracker.ts (save/load)
  [Song song C] Phase 5: US3 — projectStorageQueue.ts + useProjects.ts
  [Song song D] Phase 6: US5 — docs/model-system.md, SECURITY.md, .env.example
  [Song song E] Phase 7: US6 — bilingualSplit.ts
  [Song song F] Phase 8: US7 — db.ts

  Tất cả các Phase 3–8 sửa file khác nhau → có thể chạy đồng thời.
```

---

## Parallel Example: After Phase 2

```bash
# Launch all independent user stories in parallel:
Task: "T006–T008: Fix double failure recording in geminiClient.ts"
Task: "T009–T011: Persist quota state in localQuotaTracker.ts"
Task: "T012–T014: Build write queue in projectStorageQueue.ts"
Task: "T015–T017: Update docs (model-system, SECURITY, .env.example)"
Task: "T018–T021: Unify bilingual split contract"
Task: "T022–T023: Clarify DB query results"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3 Only)

1. Complete Phase 1: Setup (baseline confirmation)
2. Complete Phase 2: Foundational (SHA-256 hash upgrade)
3. Complete Phase 3: US1 — Single Failure Recording
4. Complete Phase 4: US2 — State Persistence on Reload
5. Complete Phase 5: US3 — Write Queue Serialization
6. **STOP and VALIDATE**: `npm run lint && npm test && npm run build`
7. Tất cả P1 bugs đã được khắc phục → hệ thống quota đáng tin cậy

### Incremental Delivery

1. Setup + Foundational → SHA-256 hash sẵn sàng
2. + US1 (Single Failure) → Chỉ số lỗi chính xác → Validate
3. + US2 (State Persistence) → Trạng thái nghỉ bảo toàn → Validate
4. + US3 (Write Queue) → Dữ liệu dự án nhất quán → Validate (MVP Complete!)
5. + US5 (Documentation) → Tài liệu đồng bộ → Validate
6. + US6 (Bilingual Split) → Hợp đồng thống nhất → Validate
7. + US7 (DB Transparency) → Kết quả truy vấn minh bạch → Validate
8. Polish & Final Verification

---

## Notes

- [P] tasks = file khác nhau, không phụ thuộc lẫn nhau
- [US*] label ánh xạ tác vụ tới User Story tương ứng trong spec.md
- Mỗi User Story có thể kiểm thử độc lập
- Commit sau mỗi tác vụ hoặc nhóm tác vụ logic
- Dừng tại bất kỳ checkpoint nào để xác nhận story hoạt động độc lập
- **Tuyệt đối không thêm dependency mới** — tận dụng Web Crypto API và Node.js Crypto có sẵn
