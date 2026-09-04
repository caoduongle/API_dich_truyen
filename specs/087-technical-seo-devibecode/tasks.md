# Tasks: Technical SEO & De-Vibecode Hoàn Thiện Triển Khai Thực Tế

**Feature**: `087-technical-seo-devibecode`  
**Date**: 2026-09-05  
**Spec**: [`specs/087-technical-seo-devibecode/spec.md`](./spec.md) | **Plan**: [`specs/087-technical-seo-devibecode/plan.md`](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Thiết lập hạ tầng cấu hình base URL, biến môi trường và tiện ích SEO tập trung

- [x] T001 Cấu hình base URL linh hoạt `base: process.env.VITE_BASE_URL || '/'` trong vite.config.ts
- [x] T002 Cập nhật schema kiểm tra biến môi trường bổ sung `APP_BASE_URL` trong server/config/env.ts
- [x] T003 [P] Tạo module quản lý cấu hình SEO và sinh Canonical URL trong src/utils/seoConfig.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hạ tầng xử lý lỗi API route 404 và kiểm chứng cấu hình trước khi triển khai các user story

**⚠️ CRITICAL**: Không thể bắt đầu các User Story cho đến khi hoàn thành xong các tác vụ nền tảng này

- [x] T004 Triển khai API 404 handler trả về JSON chuẩn cho các route `/api/*` không xác định trong server.ts
- [x] T005 [P] Viết unit test cho API 404 fallback handler trong server/__tests__/api404Fallback.test.ts
- [x] T006 [P] Viết unit test kiểm chứng logic sinh Canonical URL và Base URL trong src/utils/__tests__/seoConfig.test.ts

**Checkpoint**: Nền tảng cấu hình base domain và API 404 fallback sẵn sàng.

---

## Phase 3: User Story 1 - Truy Cập Qua Custom Domain & Tải Tài Nguyên Chuẩn Xác (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo toàn bộ tài nguyên tĩnh (scripts, stylesheets, fonts, assets) tải thành công 100% qua root-relative path trên custom domain, không còn bất kỳ địa chỉ localhost hay path tuyệt đối nào.

**Independent Test**: Mở DevTools Network tab, xác nhận 100% tài nguyên tĩnh tải thành công (HTTP 200/304), không có request nào sinh lỗi 404 hay trỏ về `localhost`.

### Tests for User Story 1
- [x] T007 [P] [US1] Viết unit test kiểm tra tính toàn vẹn của root-relative path và base resolution trong src/utils/__tests__/customDomainAssets.test.ts

### Implementation for User Story 1
- [x] T008 [US1] Cập nhật index.html đảm bảo toàn bộ đường dẫn tài nguyên tĩnh (`favicon`, `theme-init.js`, `main.tsx`) sử dụng root-relative path
- [x] T009 [US1] Cập nhật server.ts và vite.config.ts đồng bộ cấu hình static asset directory `dist/client` cho custom domain

**Checkpoint**: User Story 1 hoàn tất — ứng dụng tải tài nguyên tĩnh ổn định trên mọi domain.

---

## Phase 4: User Story 2 - Trải Nghiệm Trang Lỗi 404 Tùy Chỉnh Đồng Bộ & Thân Thiện (Priority: P1)

**Goal**: Hiển thị trang 404 phong cách "Mực & Chu Sa" với con dấu triện "無" khi người dùng truy cập route không tồn tại, kèm nút điều hướng quay về Bàn Dịch Thuật.

**Independent Test**: Truy cập đường dẫn bất kỳ không hợp lệ (ví dụ: `/duong-dan-khong-ton-tai`), xác nhận giao diện render `NotFoundPage` với đầy đủ nút bấm "Quay về Bàn Dịch".

### Tests for User Story 2
- [x] T010 [P] [US2] Viết unit test kiểm tra hiển thị và hành vi điều hướng của component NotFoundPage trong src/components/common/__tests__/NotFoundPage.test.tsx

### Implementation for User Story 2
- [x] T011 [US2] Tích hợp kiểm tra pathname và render component NotFoundPage khi route không khớp trong src/App.tsx
- [x] T012 [US2] Tinh chỉnh hiển thị ấn triện Chu Sa "無" và phong cách visual trong src/components/common/NotFoundPage.tsx

**Checkpoint**: User Story 2 hoàn tất — trang lỗi 404 hoạt động mượt mà cả client và server.

---

## Phase 5: User Story 3 - On-Page SEO & Metadata Động Cho Từng Phân Vùng (Priority: P2)

**Goal**: Cung cấp thẻ `<title>`, `<meta name="description">`, `<link rel="canonical">` động theo thời gian thực cho từng tab làm việc và tiểu thuyết đang chọn; chuẩn hóa phân cấp heading (`h1`, `h2`, `h3`).

**Independent Test**: Chuyển đổi giữa các tab và mở tiểu thuyết; kiểm tra DOM head xác nhận title, description và canonical URL cập nhật đồng bộ tương ứng.

### Tests for User Story 3
- [x] T013 [P] [US3] Viết unit test cho hook useSeoMetadata trong src/hooks/__tests__/useSeoMetadata.test.ts

### Implementation for User Story 3
- [x] T014 [P] [US3] Tạo custom hook useSeoMetadata trong src/hooks/useSeoMetadata.ts
- [x] T015 [US3] Tích hợp useSeoMetadata vào src/App.tsx để cập nhật metadata khi chuyển tab hoặc đổi truyện
- [x] T016 [US3] Chuẩn hóa phân cấp heading: duy nhất một thẻ `<h1>` cho site/workspace và `<h2>`/`<h3>` cho các phân vùng con trong src/App.tsx

**Checkpoint**: User Story 3 hoàn tất — On-page SEO động và cấu trúc heading đạt chuẩn WCAG.

---

## Phase 6: User Story 4 - Hỗ Trợ Thu Thập Dữ Liệu Cho Search Engine & AI Agents (Priority: P2)

**Goal**: Cung cấp đầy đủ `robots.txt`, `sitemap.xml`, và `llms.txt` phục vụ Googlebot, Bingbot và các tác tử AI.

**Independent Test**: Gửi curl tới `/robots.txt`, `/sitemap.xml`, `/llms.txt`, xác nhận HTTP 200 và nội dung chuẩn định dạng (text/plain, application/xml, text/markdown).

### Implementation for User Story 4
- [x] T017 [P] [US4] Tạo tệp cấu hình crawler robots.txt trong public/robots.txt
- [x] T018 [P] [US4] Tạo sơ đồ website sitemap.xml liệt kê toàn bộ route công khai trong public/sitemap.xml
- [x] T019 [P] [US4] Tạo tệp ngữ cảnh cho AI crawler llms.txt trong public/llms.txt
- [x] T020 [US4] Viết unit test xác nhận các tệp crawler tĩnh được phục vụ chính xác trong server/__tests__/crawlerEndpoints.test.ts

**Checkpoint**: User Story 4 hoàn tất — hệ thống sẵn sàng cho Search Engine và AI Agent index.

---

## Phase 7: User Story 5 - Nhận Diện Thương Hiệu & Chia Sẻ Mạng Xã Hội (Priority: P3)

**Goal**: Hoàn thiện bộ Favicon, Web App Manifest, thẻ Open Graph & Twitter Cards với ảnh xem trước chuẩn 1200x630px, đảm bảo 100% thẻ `<img>` có thuộc tính `alt`.

**Independent Test**: Quét trang qua Open Graph debugger hoặc kiểm tra thẻ meta trong head xác nhận hiển thị rich preview đầy đủ ảnh banner và mô tả.

### Implementation for User Story 5
- [x] T021 [P] [US5] Tạo Web App Manifest chuẩn PWA trong public/site.webmanifest
- [x] T022 [P] [US5] Tạo tệp ảnh xem trước mạng xã hội chuẩn 1200x630px trong public/og-image.png (hoặc public/og-image.svg)
- [x] T023 [US5] Bổ sung đầy đủ thẻ Open Graph và Twitter Cards vào thẻ head trong index.html
- [x] T024 [US5] Rà soát và bổ sung thuộc tính alt dự phòng cho hình ảnh avatar trong src/components/translator-workspace/CollaboratorPresenceBar.tsx

**Checkpoint**: User Story 5 hoàn tất — nhận diện thương hiệu và preview mạng xã hội đạt chuẩn chuyên nghiệp.

---

## Phase 8: User Story 6 - Cấu Trúc Dữ Liệu Schema.org & Điều Hướng Ngữ Nghĩa (Priority: P3)

**Goal**: Nhúng Schema.org JSON-LD (`WebApplication` & `WebSite`) và bổ sung thanh điều hướng Breadcrumbs ngữ nghĩa Microdata.

**Independent Test**: Kiểm tra thẻ `<script type="application/ld+json">` hợp lệ và thanh Breadcrumbs hiển thị phân cấp Trang chủ > Tiểu thuyết > Tab.

### Implementation for User Story 6
- [x] T025 [P] [US6] Nhúng dữ liệu có cấu trúc Schema.org JSON-LD WebApplication và WebSite vào index.html
- [x] T026 [P] [US6] Tạo component Breadcrumbs ngữ nghĩa kèm Microdata Schema.org trong src/components/common/Breadcrumbs.tsx
- [x] T027 [US6] Tích hợp thanh Breadcrumbs vào không gian làm việc trong src/App.tsx

**Checkpoint**: User Story 6 hoàn tất — Rich Results Schema.org và Breadcrumb navigation sẵn sàng.

---

## Phase 9: User Story 7 - Tối Ưu Hiệu Năng & Khử Sạch Vết Tích Template (De-Vibecode) (Priority: P3)

**Goal**: Tắt sourcemap production, dọn dẹp console logging và tối ưu code-splitting các modal nặng.

**Independent Test**: Chạy `npm run build`, kiểm tra `dist/client/assets/` không có bất kỳ file `.map` nào và console trình duyệt sạch 0 warnings/errors.

### Implementation for User Story 7
- [x] T028 [P] [US7] Cấu hình tắt sourcemap `sourcemap: false` và bật esbuild drop console trong vite.config.ts
- [x] T029 [US7] Áp dụng lazy loading cho các modal phụ (GoogleSyncModal, AuthModal, CustomThemeModal) trong src/App.tsx

**Checkpoint**: User Story 7 hoàn tất — mã nguồn production sạch sẽ, bảo mật và tải nhanh.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Nghiệm thu toàn diện và kiểm định Quality Gates theo Hiến pháp

- [x] T030 Chạy toàn bộ test suite bằng npm test và đảm bảo 100% tests pass sạch
- [x] T031 Chạy kiểm tra kiểu tĩnh bằng npm run lint (tsc --noEmit) và đảm bảo không có lỗi type
- [x] T032 Chạy npm run build và xác minh bundle client/server biên dịch thành công không sinh sourcemap
- [x] T033 Thực hiện kiểm chứng 5 kịch bản curl và header trong quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Không phụ thuộc — bắt đầu ngay lập tức.
- **Foundational (Phase 2)**: Phụ thuộc vào Setup — CHẶN toàn bộ các User Story.
- **User Stories (Phase 3 → 9)**: Phụ thuộc vào hoàn thành Phase 2 Foundational.
  - US1 (P1) và US2 (P1) có thể triển khai trước làm MVP.
  - US3, US4, US5, US6, US7 có thể triển khai tuần tự hoặc song song.
- **Polish (Phase 10)**: Phụ thuộc vào hoàn thành toàn bộ các User Story.

---

## Implementation Strategy (MVP First)

1. **Giai đoạn 1**: Hoàn tất Phase 1 (Setup) + Phase 2 (Foundational).
2. **Giai đoạn 2 (MVP)**: Hoàn tất Phase 3 (US1 - Custom Domain Assets) & Phase 4 (US2 - Custom 404 Page). Kiểm thử độc lập MVP.
3. **Giai đoạn 3 (SEO & Crawlers)**: Hoàn tất Phase 5 (US3 - Dynamic Meta), Phase 6 (US4 - Robots/Sitemap/LLMs).
4. **Giai đoạn 4 (Branding & Schema)**: Hoàn tất Phase 7 (US5 - Branding/OG), Phase 8 (US6 - Schema.org/Breadcrumbs).
5. **Giai đoạn 5 (De-Vibecode & Polish)**: Hoàn tất Phase 9 (US7 - Perf/No Sourcemap) và Phase 10 (Quality Gates 100% pass).

