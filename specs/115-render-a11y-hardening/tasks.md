# Tasks: Render Production Hardening, WCAG 2.1 AA Accessibility & Semantic Design Tokens (115-render-a11y-hardening)

**Input**: Design artifacts from `specs/115-render-a11y-hardening/` (`spec.md`, `plan.md`)

---

## Phase 1: Setup & Foundational (Render Blueprint & Deployment Configuration)

**Purpose**: Thiết lập hạ tầng triển khai tĩnh trên Render và chuẩn hóa cấu hình SEO/domain.

- [X] T001 [P0] Tạo tệp cấu hình Blueprint `render.yaml` với static runtime, rule rewrite SPA (`/*` -> `/index.html`) và 7 HTTP security headers per FR-001
- [X] T002 [P0] Cập nhật `public/robots.txt` loại bỏ `/api/`, `/ws/` và trỏ sitemap về `https://api-dich-truyen.onrender.com/sitemap.xml` per FR-002
- [X] T003 [P0] Cập nhật URL canonical và Schema.org trong `index.html` và fallback domain trong `src/utils/seoConfig.ts` per FR-003
- [X] T004 [P0] Cập nhật unit test SEO trong `src/utils/__tests__/seoConfig.test.ts` per FR-003
- [X] T005 [P0] Bổ sung hướng dẫn triển khai Render vào `README.md` per FR-004

---

## Phase 2: User Story 2 - Trải nghiệm trợ năng bàn phím & Trình đọc màn hình (WCAG 2.1 AA)

**Purpose**: Khắc phục các vi phạm trợ năng về bẫy tiêu điểm, thông báo động và điều hướng bàn phím.

- [X] T006 [P1] [US2] Refactor modal Chính sách bảo mật và Điều khoản sử dụng trong `src/components/layout/AppFooter.tsx` dùng component `Modal` chuẩn per FR-005
- [X] T007 [P1] [US2] Thêm `aria-live="polite"` và `role="alert"` vào vùng chứa toast trong `src/components/NotificationSystem.tsx` per FR-006
- [X] T008 [P1] [US2] Bổ sung `aria-expanded` và `aria-haspopup` cho `ThemeSwitcher.tsx`, `KeyCardItem.tsx`, và `DuplicatePanel.tsx` per FR-007
- [X] T009 [P1] [US2] Thêm liên kết truy cập nhanh "Bỏ qua đến nội dung chính" trong `src/App.tsx` trỏ tới `id="main-content"` trong `TabContent.tsx` per FR-008

---

## Phase 3: User Story 3 - Hệ thống Màu Ngữ Nghĩa & Độ Tương Phản Chuẩn

**Purpose**: Chuẩn hóa design tokens và đảm bảo độ tương phản WCAG 2.1 AA >= 4.5:1.

- [X] T010 [P1] [US3] Khai báo 4 nhóm token ngữ nghĩa (`success`, `warning`, `danger`, `info`) cho 3 theme trong `src/index.css` per FR-009
- [X] T011 [P1] [US3] Tinh chỉnh `--color-text-muted` đạt tương phản >= 4.5:1 trên `parchment-2` trong `src/index.css` và cập nhật `src/utils/contrastAuditor.ts` per FR-010
- [X] T012 [P1] [US3] Mở rộng kiểu `BadgeTone` hỗ trợ `'success'` trong `src/components/ui/Badge.tsx` per FR-009
- [X] T013 [P1] [US3] Thay thế mã màu cứng inline bằng token ngữ nghĩa trong `ZuminovelPublishPanel.tsx` và `NotificationSystem.tsx` per FR-011
- [X] T014 [P1] [US3] Bổ sung vòng nét `focus-visible` cho các ô nhập liệu và nút trong `KeyListSection.tsx` và `ZuminovelPublishPanel.tsx`

---

## Phase 4: User Story 4 - Rà soát Hồi quy UI/UX & Đồng bộ Sitemap

**Purpose**: Đảm bảo 20 tiêu chí UI/UX trên các panel tạo mới và loại bỏ 404 trong sitemap.

- [X] T015 [P2] [US4] Kiểm tra và hoàn thiện touch target >= 36-44px, thuộc tính ARIA tablist/tab, focusable delete button, và EmptyState trong `UnifiedAuditPanel`, `HakoIssueReviewPanel`, `DuplicatePanel`, `ChapterHistoryPanel`
- [X] T016 [P2] [US4] Đồng bộ `public/sitemap.xml` với 6 route hợp lệ trong `VALID_TABS` trỏ về `https://api-dich-truyen.onrender.com/` per FR-012

---

## Phase 5: User Story 5 - Thắt Chặt Bảo Mật Sản Xuất & Tinh Chỉnh Minh Bạch

**Purpose**: Xác minh an ninh phụ thuộc và tăng cường minh bạch chính sách bảo mật/chi phí.

- [X] T017 [P2] [US5] Thực thi kiểm tra lỗ hổng thư viện qua `npm audit`
- [X] T018 [P2] [US5] Tài liệu hóa lý giải kỹ thuật về `'unsafe-inline'` trong CSP của `render.yaml`
- [X] T019 [P3] [US5] Bổ sung điều khoản cam kết Pure Client-Side không tracking trong `AppFooter.tsx`
- [X] T020 [P3] [US5] Bổ sung khuyến nghị thiết lập Quota / Billing Alert Google Cloud trong `KeyListSection.tsx`

---

## Phase 6: Quality Gates Verification

**Purpose**: Đảm bảo toàn bộ tiêu chuẩn chất lượng của dự án được đáp ứng nghiêm ngặt.

- [X] T021 [QG] Kiểm tra `npm run lint` (`tsc --noEmit`) đạt 0 lỗi type per SC-001
- [X] T022 [QG] Kiểm tra `npm test` (`vitest run`) pass 100% (65/65 files, 507/507 tests) per SC-001
- [X] T023 [QG] Kiểm tra `npm run build` xuất bản bundle `dist/` thành công per SC-001
