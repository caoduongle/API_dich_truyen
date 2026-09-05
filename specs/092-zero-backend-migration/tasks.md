# Tasks: Chuyển API_dich_truyen thành ứng dụng thuần Client-Side (Zero Backend)

**Branch**: `092-zero-backend-migration` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tinh giản cấu hình dự án, dọn dẹp các phụ thuộc backend không còn sử dụng

- [ ] T001 Cập nhật `package.json` gỡ bỏ các dependencies backend (`express`, `ioredis`, `ws`, `helmet`, `@types/express`, `@types/ws`, `tsx`) và đổi npm scripts sang `vite` thuần trong `package.json`
- [ ] T002 [P] Cập nhật `.env.example` loại bỏ các biến môi trường backend (`PORT`, `ACCESS_PASSWORD`, `REDIS_URL`, `WS_TICKET_SECRET`) trong `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nền tảng chung và loại bỏ hoàn toàn mã nguồn máy chủ trung gian

**⚠️ CRITICAL**: Phải hoàn thành giai đoạn này trước khi các module nghiệp vụ chuyển hẳn sang Client-Direct

- [ ] T003 Xóa bỏ toàn bộ thư mục `server/` và file entrypoint `server.ts` khỏi kho lưu trữ
- [ ] T004 [P] Bổ sung các hàm làm sạch chuỗi bảo mật `sanitizeSecretString` và `sanitizeValue` vào `shared/text.ts`
- [ ] T005 [P] Cập nhật các import trong `src/utils/__tests__/credentialStorage.test.ts` trỏ tới `@shared/text` thay vì `server/utils` trong `src/utils/__tests__/credentialStorage.test.ts`

**Checkpoint**: Mã nguồn backend đã được loại bỏ hoàn toàn, các tiện ích dùng chung đã sẵn sàng cho client

---

## Phase 3: User Story 1 - Trải Nghiệm SPA Tĩnh Mở Tự Do Không Cần Máy Chủ (Priority: P1) 🎯 MVP

**Goal**: Loại bỏ xác thực mật khẩu toàn site, chuyển đổi 100% cuộc gọi AI (dịch thô, chuốt văn, trích xuất, QA) sang Client-to-Gemini REST API

**Independent Test**: Khởi chạy ứng dụng tĩnh (`npm run preview`), truy cập trang chủ không hiện popup mật khẩu, dịch thử chương truyện với DevTools Network mở và xác nhận không có request nào gửi tới `/api/*`.

### Implementation for User Story 1

- [ ] T006 [P] [US1] Xóa bỏ modal mật khẩu máy chủ `src/components/AuthModal.tsx`
- [ ] T007 [US1] Gỡ bỏ logic kiểm tra mật khẩu site và state `isVerified` trong `src/App.tsx`
- [ ] T008 [P] [US1] Cập nhật `src/hooks/useModelDiscovery.ts` chuyển sang gọi trực tiếp `listModelsDirect` thay vì fetch `/api/list-models`
- [ ] T009 [US1] Loại bỏ hoàn toàn session token và endpoint auth server trong `src/utils/apiClient.ts`
- [ ] T010 [P] [US1] Cập nhật bộ unit test `src/utils/__tests__/apiClient.test.ts` kiểm tra payload sanitization mà không phụ thuộc backend trong `src/utils/__tests__/apiClient.test.ts`
- [ ] T011 [US1] Xác minh không còn bất kỳ lệnh gọi `fetch('/api/...')` nào trong toàn bộ thư mục `src/`

**Checkpoint**: User Story 1 hoàn tất — ứng dụng mở tự do, AI chạy 100% Client-to-Gemini.

---

## Phase 4: User Story 2 - Theo Dõi & Quản Lý Hạn Mức Quota Cục Bộ Trên Trình Duyệt (Priority: P1) 🎯 MVP

**Goal**: Xây dựng module `localQuotaTracker.ts` trên trình duyệt thay thế hoàn toàn backend quota authority, hiển thị trạng thái hạn mức trên QuotaPanel

**Independent Test**: Mở giao diện QuotaPanel, thực hiện cuộc gọi AI và quan sát biến thiên RPM/TPM theo cửa sổ trượt 60s, kiểm tra đồng hồ reset PST Midnight và cơ chế Circuit Breaker khi gặp 429.

### Implementation for User Story 2

- [ ] T012 [US2] Xây dựng module theo dõi hạn mức cục bộ `src/services/localQuotaTracker.ts` với Sliding Window 60s, PST Midnight Reset Clock, Key Health State Machine và Circuit Breaker
- [ ] T013 [US2] Tích hợp `localQuotaTracker` vào client gọi AI `src/services/directGeminiClient.ts` (ghi nhận logical start, provider attempt, token metrics, latency, status error)
- [ ] T014 [P] [US2] Cập nhật hook `src/hooks/useModelObservability.ts` đọc snapshot quota trực tiếp từ `localQuotaTracker`
- [ ] T015 [P] [US2] Cập nhật `src/components/QuotaPanel.tsx` loại bỏ cấu hình Quota Group / Team Key và hiển thị số liệu từ client tracker
- [ ] T016 [US2] Dọn dẹp callback đồng bộ session key lên server trong `src/hooks/useAIConfig.ts`
- [ ] T017 [P] [US2] Cập nhật `src/services/__tests__/clientKeyRotation.test.ts` kiểm tra xoay vòng key cục bộ

**Checkpoint**: User Story 2 hoàn tất — hạn mức quota được kiểm soát trực tiếp trên client mà không cần server.

---

## Phase 5: User Story 3 - Chia Sẻ & Đồng Bộ Bất Đồng Bộ Qua Google Drive (Priority: P2)

**Goal**: Đưa CRDT tài liệu về chế độ local-only kết hợp sao lưu snapshot nhị phân lên Google Drive, loại bỏ WebSocket Relay server

**Independent Test**: Mở chương truyện trong Translator Workspace, chỉnh sửa nội dung, kiểm tra dữ liệu lưu bền vững trong IndexedDB và thanh trạng thái cộng tác viên hiển thị "Cục bộ / Google Drive".

### Implementation for User Story 3

- [ ] T018 [US3] Chuyển đổi `src/services/crdtDocManager.ts` sang chế độ local-only (default status `'offline'`), loại bỏ gọi `/api/ws-ticket`
- [ ] T019 [P] [US3] Cập nhật `src/services/__tests__/crdtDocManager.test.ts` loại bỏ test case lấy ticket WebSocket
- [ ] T020 [US3] Dọn dẹp `src/hooks/useChapterCRDT.ts` loại bỏ `WebsocketProvider` từ `y-websocket` và giữ lại IndexedDB persistence
- [ ] T021 [P] [US3] Cập nhật thanh trạng thái `src/components/translator-workspace/CollaboratorPresenceBar.tsx` hiển thị trạng thái "Cục bộ / Google Drive"

**Checkpoint**: User Story 3 hoàn tất — CRDT vận hành an toàn offline-first và đồng bộ bất đồng bộ qua Drive.

---

## Phase 6: User Story 4 - Triển Khai Hosting Tĩnh & Cấu Hình Bảo Mật Headers (Priority: P2)

**Goal**: Cấu hình Vite build ra `dist/` thuần túy và thiết lập HTTP security headers cho Cloudflare Pages, Netlify, Vercel và Docker

**Independent Test**: Chạy `npm run build`, kiểm tra `dist/index.html` và `dist/_headers`, chạy `npm test` với `customDomainAssets.test.ts` xác nhận các tệp cấu hình hợp lệ.

### Implementation for User Story 4

- [ ] T022 [US4] Cập nhật `vite.config.ts` đổi thư mục xuất bản `outDir` thành `'dist'`
- [ ] T023 [P] [US4] Tạo file cấu hình bảo mật `public/_headers` (CSP, HSTS, Permissions-Policy, COOP `same-origin-allow-popups`) cho Cloudflare Pages và Netlify
- [ ] T024 [P] [US4] Tạo file cấu hình `vercel.json` định tuyến SPA rewrites về `/index.html` và HTTP security headers cho Vercel
- [ ] T025 [P] [US4] Cập nhật `Dockerfile` chuyển sang kiến trúc multi-stage build phục vụ static assets bằng Nginx Alpine
- [ ] T026 [US4] Cập nhật `src/utils/__tests__/customDomainAssets.test.ts` kiểm tra cấu hình `outDir: 'dist'` và các file header tĩnh

**Checkpoint**: User Story 4 hoàn tất — ứng dụng sẵn sàng triển khai lên mọi nền tảng static hosting.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Đồng bộ hóa tài liệu kỹ thuật và kiểm tra toàn diện Quality Gates

- [ ] T027 [P] Cập nhật `README.md` phản ánh kiến trúc Pure Client-Side SPA (Zero Backend)
- [ ] T028 [P] Cập nhật tài liệu kiến trúc `docs/architecture.md`
- [ ] T029 [P] Cập nhật tài liệu hạn mức `docs/quota-and-scheduling.md`
- [ ] T030 [P] Cập nhật hướng dẫn cho AI crawler trong `public/llms.txt`
- [ ] T031 Thực thi toàn diện Quality Gate 1: `npm run lint` (`tsc --noEmit`) đạt 0 lỗi type
- [ ] T032 Thực thi toàn diện Quality Gate 2: `npm test` (`vitest run`) pass 100% tất cả test suites
- [ ] T033 Thực thi toàn diện Quality Gate 3: `npm run build` (`tsc && vite build`) đóng gói thành công duy nhất thư mục `dist/`

---

## Dependencies & Execution Order

### Phase Dependencies

```mermaid
flowchart TD
    P1[Phase 1: Setup] --> P2[Phase 2: Foundational]
    P2 --> P3[Phase 3: User Story 1 - Auth & Client-Direct AI (P1)]
    P2 --> P4[Phase 4: User Story 2 - Local Quota Tracker (P1)]
    P2 --> P5[Phase 5: User Story 3 - Local CRDT & Drive Sync (P2)]
    P2 --> P6[Phase 6: User Story 4 - Static Hosting & Headers (P2)]
    P3 --> P7[Phase 7: Polish & Quality Gates Verification]
    P4 --> P7
    P5 --> P7
    P6 --> P7
```

### User Story Dependencies

- **User Story 1 (P1)**: Bắt đầu ngay sau Phase 2 (Foundational) — Trực tiếp mở khóa trải nghiệm SPA tĩnh tự do.
- **User Story 2 (P1)**: Bắt đầu ngay sau Phase 2 (Foundational) — Có thể triển khai song song với US1, độc lập về mặt dữ liệu.
- **User Story 3 (P2)**: Bắt đầu ngay sau Phase 2 (Foundational) — Hoàn toàn độc lập với US1/US2.
- **User Story 4 (P2)**: Bắt đầu sau khi cấu hình build được thống nhất — Hoàn toàn độc lập với logic UI.

---

## Parallel Execution Opportunities

- **Phase 1**: T001 và T002 có thể chạy song song.
- **Phase 2**: T004 và T005 có thể chạy song song sau khi xóa thư mục server (T003).
- **Phase 3 (US1)**: T006, T008, T010 có thể chạy song song.
- **Phase 4 (US2)**: T014, T015, T017 có thể chạy song song sau khi T012 và T013 hoàn thành.
- **Phase 5 (US3)**: T019 và T021 có thể chạy song song với T018 và T020.
- **Phase 6 (US4)**: T023, T024, T025 có thể tạo song song.
- **Phase 7 (Polish)**: T027, T028, T029, T030 có thể cập nhật song song.

---

## Implementation Strategy & MVP Scope

### MVP Scope (User Story 1 + User Story 2)
1. Hoàn tất Phase 1 & 2: Dọn dẹp phụ thuộc và loại bỏ backend Express.
2. Hoàn tất Phase 3 (US1): Ứng dụng chạy không cần mật khẩu site, AI gọi trực tiếp Google REST API.
3. Hoàn tất Phase 4 (US2): Quota tracking cục bộ trên trình duyệt, bảo vệ hạn mức cá nhân.
4. **Xác nhận MVP**: Chạy `npm run preview`, dịch thử và theo dõi QuotaPanel.

### Đóng Gói Hoàn Thiện (User Story 3 + User Story 4 + Polish)
1. Hoàn tất Phase 5 (US3): CRDT local-only và backup Google Drive.
2. Hoàn tất Phase 6 (US4): Cấu hình static hosting headers và Vite build `dist/`.
3. Hoàn tất Phase 7: Cập nhật tài liệu và kiểm tra toàn bộ 3 Quality Gates.
