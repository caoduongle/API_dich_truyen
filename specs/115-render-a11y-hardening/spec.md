# Feature Specification: Render Production Hardening, WCAG 2.1 AA Accessibility & Semantic Design Tokens

**Feature Branch**: `115-render-a11y-hardening`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Bạn là Senior Full-Stack Engineer kiêm chuyên gia AppSec, Web Accessibility (WCAG 2.1 AA) và Technical SEO. Dự án này là 'Bản Thảo Chu Sa — AI Dịch Truyện Trung-Việt', một ứng dụng 100% Pure Client-Side SPA (React 19 + Vite + TypeScript + Tailwind v4), KHÔNG có backend, KHÔNG có database, KHÔNG có tài khoản/mật khẩu do máy chủ quản lý. Toàn bộ dữ liệu nằm trong IndexedDB/sessionStorage của trình duyệt; AI được gọi trực tiếp từ trình duyệt tới Google Gemini bằng API key do người dùng tự nhập. Ứng dụng được build bằng `npm run build` ra `dist/` và triển khai làm Static Site trên Render... domain hiện tại tôi đang dùng là https://api-dich-truyen.onrender.com/"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bảo vệ an ninh & Định tuyến tĩnh trên nền tảng Render (Priority: P0)

Người dùng truy cập ứng dụng trên Render qua domain chính thức `https://api-dich-truyen.onrender.com/`. Hệ thống áp dụng toàn bộ các tiêu đề an ninh HTTP (CSP, HSTS, X-Frame-Options, Permissions-Policy, COOP, X-Content-Type-Options) thông qua Blueprint `render.yaml`. Khi người dùng truy cập trực tiếp hoặc F5 tại các đường dẫn URL sâu (`/glossary`, `/history`, `/projects`, `/hako-checker`, `/auto-translate`), máy chủ Render định tuyến rewrite về `/index.html` thay vì trả về lỗi 404 vật lý của CDN.

**Why this priority**: Đây là nền tảng an ninh cao nhất của ứng dụng khi triển khai thật trên Render. Hiện tại các header an ninh đang không hoạt động trên Render vì thiếu `render.yaml`.

**Independent Test**:
- Kiểm tra file `render.yaml` có cấu hình `runtime: static`, `buildCommand: npm ci && npm run build`, `staticPublishPath: dist`.
- Khối `routes` chứa rewrite `source: /*` -> `destination: /index.html`.
- Khối `headers` chứa đầy đủ 7 header bảo mật chuẩn.
- `public/robots.txt` loại bỏ các đường dẫn `/api/`, `/ws/` không tồn tại và trỏ đúng Sitemap domain `https://api-dich-truyen.onrender.com/sitemap.xml`.
- `index.html` và `public/sitemap.xml` cập nhật domain sản xuất chính xác.

**Acceptance Scenarios**:
1. **Given** cấu hình Blueprint `render.yaml`, **When** Render biên dịch và phân phối static assets, **Then** toàn bộ phản hồi HTTP đều kèm CSP, HSTS, COOP, Permissions-Policy và X-Frame-Options: DENY.
2. **Given** người dùng tải lại trang tại `https://api-dich-truyen.onrender.com/glossary`, **When** yêu cầu gửi đến CDN Render, **Then** yêu cầu được rewrite về `/index.html` và app mở đúng tab Từ Điển mà không gặp màn hình 404 của Render.

---

### User Story 2 - Trải nghiệm trợ năng bàn phím & Trình đọc màn hình đạt chuẩn WCAG 2.1 AA (Priority: P1)

Người dùng khiếm thị hoặc người dùng thao tác hoàn toàn bằng bàn phím có thể điều hướng liền mạch trên ứng dụng. Khi mở trang, liên kết "Bỏ qua đến nội dung chính" (Skip to content) cho phép nhảy thẳng qua thanh điều hướng vào phân vùng làm việc. Hai modal Chính sách bảo mật & Điều khoản sử dụng tận dụng component `Modal` chuẩn có bẫy focus (focus trap), đóng bằng phím Escape, và trả focus về phần tử kích hoạt. Toàn bộ thông báo nổi (toast) trong `NotificationSystem` phát tín hiệu `aria-live` và `role="alert"` để trình đọc màn hình công bố kết quả. Mọi dropdown/accordion sở hữu đầy đủ thuộc tính `aria-expanded` và `aria-haspopup`.

**Why this priority**: Đảm bảo tính công bằng và tiện dụng cho mọi đối tượng người dùng, khắc phục các thiếu sót đo được trong kiểm toán trợ năng WCAG.

**Independent Test**:
- Bấm Tab ngay khi nạp trang -> Nút "Bỏ qua đến nội dung chính" xuất hiện rõ ràng. Bấm Enter -> Focus nhảy vào `#main-content`.
- Mở modal Chính sách bảo mật ở footer -> Bấm Tab luân chuyển bên trong modal, bấm Escape -> Modal đóng và focus trả lại.
- Kích hoạt thông báo toast -> Trình đọc màn hình nhận sự kiện live announcement.

**Acceptance Scenarios**:
1. **Given** modal Chính sách bảo mật hoặc Điều khoản sử dụng được mở, **When** người dùng bấm phím Tab, **Then** tiêu điểm bàn phím bị bẫy trong modal và không lọt ra nền; khi nhấn Escape, modal đóng lại ngay lập tức.
2. **Given** một toast thông báo lỗi hoặc thành công hiển thị, **When** toast xuất hiện trên DOM, **Then** vùng chứa `aria-live="polite"` hoặc `role="alert"` thông báo nội dung ngay cho người dùng trợ năng.

---

### User Story 3 - Hệ thống Màu Ngữ Nghĩa Đồng Bộ & Đảm Bảo Độ Tương Phản (Priority: P1)

Hệ thống giao diện bổ sung 4 nhóm biến ngữ nghĩa (`success`, `warning`, `danger`, `info`) với đầy đủ các sắc độ (`lightest`, `lighter`, `default`, `darker`, `darkest`) cho cả 3 theme (`dark`, `light`, `sepia`), hòa quyện với phong cách "Mực & Chu Sa". Tinh chỉnh độ tương phản của `--color-text-muted` trên nền `--color-parchment-2` đạt tối thiểu 4.5:1 đối với chữ thường. Thay thế toàn bộ các class màu inline (`emerald-*`, `red-*`, `green-*`) trong `ZuminovelPublishPanel` và `NotificationSystem` bằng các token ngữ nghĩa mới.

**Why this priority**: Chuẩn hóa hệ thống thiết kế, loại bỏ mã màu hard-code không đồng bộ và đảm bảo độ dễ đọc theo WCAG 2.1 AA.

**Independent Test**:
- Kiểm tra tính toán tương phản `calculateContrastRatio` của `--color-text-muted` trên `--color-parchment-2` đạt $\ge 4.5:1$ ở cả 3 theme.
- Kiểm tra `ZuminovelPublishPanel.tsx` và `NotificationSystem.tsx` không còn dùng class màu Tailwind mặc định rời rạc.

**Acceptance Scenarios**:
1. **Given** người dùng chuyển đổi giữa theme Dark, Light và Sepia, **When** các huy hiệu trạng thái, thông báo ngữ nghĩa (thành công, cảnh báo, lỗi, thông tin) hiển thị, **Then** màu sắc tự động thích ứng với bảng màu chủ đạo cổ phong và duy trì độ tương phản chuẩn.
2. **Given** các văn bản phụ dùng class `text-text-muted`, **When** hiển thị trên nền `bg-parchment-2`, **Then** tỷ số tương phản đạt $\ge 4.5:1$.

---

### User Story 4 - Rà soát Hồi quy UI/UX & Đồng bộ Sitemap Chuẩn (Priority: P2)

Rà soát 20 tiêu chí UI/UX trên các component mới từ Spec 093 đến Spec 114 (Unified Audit Panel, Hako Issue Reviewer, Batch Operations). Đồng bộ file `public/sitemap.xml` khớp 100% với danh mục phân vùng thực tế (`VALID_TABS`) gồm 6 route thật (`/`, `/auto-translate`, `/glossary`, `/history`, `/projects`, `/hako-checker`), loại bỏ các đường dẫn cũ không tồn tại (`/workspace`, `/memory`, `/hako`, `/export`, `/settings`).

**Why this priority**: Loại bỏ liên kết 404 chết trong SEO sitemap, bảo đảm tính toàn vẹn của ứng dụng sau nhiều đợt nâng cấp tính năng.

**Independent Test**:
- Kiểm tra sitemap chứa chính xác 6 route hợp lệ trỏ tới `https://api-dich-truyen.onrender.com/`.
- Không có bất kỳ link sitemap nào gây ra trang 404 khi truy cập.

**Acceptance Scenarios**:
1. **Given** tệp `public/sitemap.xml`, **When** công cụ tìm kiếm thu thập dữ liệu, **Then** 100% URL hợp lệ và trả về nội dung phân vùng tương ứng mà không gặp lỗi điều hướng.

---

### User Story 5 - Thắt Chặt Bảo Mật Sản Xuất & Tinh Chỉnh Nội Dung Minh Bạch (Priority: P2/P3)

Thực hiện kiểm tra an ninh phụ thuộc (`npm audit`), xác nhận 0 lỗ hổng mức cao/nghiêm trọng. Tài liệu hóa lý do duy trì `'unsafe-inline'` trong CSP do tính chất thuần Client-Side và yêu cầu của thư viện Google API/GIS. Cập nhật nội dung minh bạch trong Chính sách bảo mật (cam kết không cookie theo dõi, không bên thứ ba) và bổ sung gợi ý người dùng tự cài đặt Quota Alert trên Google Cloud Console.

**Why this priority**: Nâng cao tính an tâm và minh bạch về quyền riêng tư cho người dùng sử dụng công cụ mã nguồn mở miễn phí.

**Independent Test**:
- Đọc `render.yaml` và `public/_headers` có ghi chú giải thích kỹ thuật CSP rõ ràng.
- Đọc modal Chính sách bảo mật có cam kết không tracking.
- Đọc `KeyListSection` có gợi ý quota alert.

**Acceptance Scenarios**:
1. **Given** người dùng mở xem Chính sách bảo mật, **When** đọc điều khoản lưu trữ, **Then** người dùng thấy rõ cam kết bảo vệ dữ liệu cục bộ và không có bên thứ ba theo dõi.
2. **Given** người dùng cấu hình API Key, **When** xem hướng dẫn hạn mức, **Then** có gợi ý thiết lập Quota / Billing Alert trên Google Cloud Console.

## Functional Requirements

- **FR-001**: Hệ thống PHẢI cung cấp tệp cấu hình Blueprint `render.yaml` tại thư mục gốc với các chỉ thị rewrite SPA và toàn bộ 7 HTTP security headers.
- **FR-002**: Tệp `public/robots.txt` PHẢI loại bỏ 2 dòng `Disallow: /api/` và `Disallow: /ws/`, đồng thời cập nhật dòng `Sitemap` trỏ về `https://api-dich-truyen.onrender.com/sitemap.xml`.
- **FR-003**: Toàn bộ placeholder `dich-truyen.example.com` trong `index.html`, `public/sitemap.xml`, `src/utils/seoConfig.ts` và các test liên quan PHẢI được thay thế bằng domain thực `https://api-dich-truyen.onrender.com`.
- **FR-004**: Tệp `README.md` PHẢI bổ sung hướng dẫn triển khai cho nền tảng Render.
- **FR-005**: Hai modal Chính sách bảo mật và Điều khoản sử dụng trong `AppFooter.tsx` PHẢI được refactor để tái sử dụng component `src/components/ui/Modal.tsx`.
- **FR-006**: Vùng thông báo toast trong `NotificationSystem.tsx` PHẢI tích hợp `aria-live="polite"` (và `role="alert"` cho thông báo lỗi) phục vụ Screen Reader.
- **FR-007**: Các dropdown, popover và accordion (bao gồm `ThemeSwitcher`, accordion trong `KeyCardItem`, `DuplicatePanel`) PHẢI có đầy đủ thuộc tính `aria-expanded` và `aria-haspopup`.
- **FR-008**: Ứng dụng PHẢI có liên kết "Bỏ qua đến nội dung chính" ẩn-hiện-khi-focus trỏ trực tiếp đến `id="main-content"` của phần tử `<main>`.
- **FR-009**: Tệp `src/index.css` PHẢI khai báo 4 nhóm biến ngữ nghĩa `--color-success-*`, `--color-warning-*`, `--color-danger-*`, `--color-info-*` với 5 mức độ sắc độ trên cả 3 theme.
- **FR-010**: Tỷ số tương phản của `--color-text-muted` trên nền `--color-parchment-2` PHẢI đạt $\ge 4.5:1$ trên cả 3 theme.
- **FR-011**: Các class màu inline không thuộc bảng màu dự án (`text-emerald-600`, `text-red-500`) trong `ZuminovelPublishPanel.tsx` và `NotificationSystem.tsx` PHẢI được thay thế bằng token ngữ nghĩa.
- **FR-012**: Tệp `public/sitemap.xml` PHẢI được cập nhật khớp chính xác với 6 phân vùng trong `VALID_TABS`.

## Success Criteria

- **SC-001**: 100% các lệnh kiểm tra chất lượng `npm run lint`, `npm test` và `npm run build` thực thi thành công không phát sinh bất kỳ cảnh báo hoặc lỗi nào.
- **SC-002**: Không có bất kỳ thay đổi nào vi phạm Deny-list trong AGENTS.md (không chạm vào `src/services/` logic dịch/Gemini, không thay đổi schema IndexedDB).
- **SC-003**: Điểm tương phản WCAG 2.1 AA của chữ thường phụ (`text-muted`) trên nền panel (`parchment-2`) đạt $\ge 4.5:1$.
- **SC-004**: Người dùng khiếm thị / dùng bàn phím có thể chuyển vùng nhanh và đóng mở modal an toàn bằng phím Escape mà không bị kẹt tiêu điểm.
- **SC-005**: Tệp `sitemap.xml` không chứa bất kỳ liên kết chết hoặc đường dẫn 404 nào.
