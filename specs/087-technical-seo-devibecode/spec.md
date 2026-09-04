# Feature Specification: Technical SEO & De-Vibecode Chuẩn Hóa Triển Khai Thực Tế

**Feature Branch**: `087-technical-seo-devibecode`  
**Created**: 2026-09-05  
**Role**: Technical Lead & Senior Technical SEO Specialist  
**Status**: Draft  
**Input**: User description: "Bạn là một Technical Lead kiêm Chuyên gia Technical SEO. Hãy rà soát toàn bộ dự án web này và tiến hành "de-vibecode" để đưa website đạt tiêu chuẩn chuyên nghiệp, sẵn sàng triển khai chính thức theo các hạng mục..."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Truy Cập Ứng Dụng Qua Custom Domain & Tải Tài Nguyên Chuẩn Xác (Priority: P1) 🎯 MVP

Là một người dùng hoặc biên tập viên truy cập ứng dụng thông qua tên miền tùy chỉnh (custom domain), tôi muốn toàn bộ tài nguyên (scripts, stylesheets, fonts, assets) được tải nhanh chóng, chuẩn xác theo base domain mà không bị lỗi đường dẫn hay rò rỉ địa chỉ IP nội bộ / localhost.

**Why this priority**: Đây là nền tảng sống còn của ứng dụng khi triển khai production trên tên miền riêng.

**Independent Test**: Truy cập website qua Custom Domain hoặc URL triển khai, mở DevTools Network tab, xác nhận toàn bộ 100% assets (JS, CSS, fonts, SVG) tải với mã HTTP 200/304, không có request nào trỏ về `localhost` hay sinh lỗi 404.

**Acceptance Scenarios**:
1. **Given** người dùng truy cập trang chủ trên custom domain, **When** trình duyệt tải HTML, **Then** toàn bộ đường dẫn static bundle tải từ domain hiện tại qua root-relative path `/assets/...`.
2. **Given** ứng dụng được cấu hình biến môi trường domain `APP_BASE_URL`, **When** render thẻ canonical hoặc Open Graph, **Then** URL tuyệt đối được ghép chính xác theo custom domain thay vì fallback localhost.

---

### User Story 2 - Trải Nghiệm Trang Lỗi 404 Tùy Chỉnh Đồng Bộ & Thân Thiện (Priority: P1)

Là một người dùng vô tình gõ sai URL hoặc truy cập một chương/dự án đã bị xóa, tôi muốn nhìn thấy một trang thông báo lỗi 404 mang phong cách "Mực & Chu Sa" trang nhã, giải thích rõ lý do và cung cấp nút bấm rõ ràng để quay lại Bàn Dịch Thuật hoặc trang trước đó.

**Why this priority**: Giữ chân người dùng không bị thoát trang (bounce rate) khi gặp liên kết gãy hoặc route không tồn tại.

**Independent Test**: Nhập đường dẫn bất kỳ không tồn tại (ví dụ: `/duong-dan-khong-ton-tai`), xác nhận giao diện hiển thị component `NotFoundPage` với ấn triện Chu Sa "無", tiêu đề 404 rõ ràng, và bấm nút "Quay về Bàn Dịch" đưa người dùng về không gian làm việc chính.

**Acceptance Scenarios**:
1. **Given** người dùng điều hướng đến một đường dẫn không hợp lệ, **When** ứng dụng render, **Then** hiển thị trang 404 tùy chỉnh với đầy đủ visual elements (Seal, Fraunces font, nút quay về).
2. **Given** client gọi một API route không tồn tại `/api/v1/invalid`, **When** server phản hồi, **Then** server trả về JSON `{ error: "Not Found", path: "/api/v1/invalid" }` với status code 404 thay vì trả về HTML document.

---

### User Story 3 - On-Page SEO & Metadata Động Cho Từng Phân Vùng (Priority: P2)

Là một người tìm kiếm trên Google/Bing hoặc người chia sẻ liên kết trên mạng xã hội, tôi muốn mỗi phân vùng chức năng (Bàn Dịch Thuật, Dịch Tự Động, Từ Điển Thuật Ngữ, Lịch Sử Chương, Quản Lý Tiểu Thuyết, Hako Checker) có tiêu đề `<title>`, thẻ `<meta description>`, thẻ canonical và thông tin Open Graph chính xác, thu hút.

**Why this priority**: Giúp công cụ tìm kiếm lập chỉ mục chính xác các tính năng của ứng dụng và hiển thị snippet hấp dẫn khi chia sẻ qua Zalo, Facebook, Telegram, Twitter.

**Independent Test**: Chuyển đổi giữa các tab và mở chi tiết tiểu thuyết; kiểm tra `document.title`, thẻ `<meta name="description">` và `<link rel="canonical">` trong DOM được cập nhật theo thời gian thực tương ứng với ngữ cảnh hiện tại.

**Acceptance Scenarios**:
1. **Given** người dùng đang ở tab "Từ Điển Thuật Ngữ", **When** xem mã nguồn DOM, **Then** `<title>` là "Từ Điển Nhân Vật & Thuật Ngữ | Bàn Biên Tập Bản Thảo Chu Sa", meta description mô tả tính năng trích xuất và quản lý glossary.
2. **Given** thẻ `<link rel="canonical">` trên trang, **When** chuyển tab, **Then** URL canonical phản ánh route tương ứng trên custom domain.
3. **Given** cấu trúc trang hiển thị, **When** phân tích cây DOM, **Then** mỗi màn hình có duy nhất một thẻ `<h1>` duy nhất chứa tên tính năng/tiểu thuyết và hệ thống heading `h2`, `h3` phân cấp theo đúng chuẩn WCAG.

---

### User Story 4 - Hỗ Trợ Thu Thập Dữ Liệu Cho Search Engine & AI Agents (Crawler & LLMs Ready) (Priority: P2)

Là một Search Engine Crawler (Googlebot, Bingbot) hoặc một AI Agent (Perplexity, ChatGPT, Claude), tôi muốn đọc được `robots.txt`, `sitemap.xml`, và `llms.txt` để hiểu rõ cấu trúc trang, quyền thu thập dữ liệu và ngữ cảnh tóm lược của công cụ dịch thuật này.

**Why this priority**: Tối ưu hóa thu thập dữ liệu tự động cho thế hệ tìm kiếm AI và bot tìm kiếm truyền thống.

**Independent Test**: Gửi request `GET /robots.txt`, `GET /sitemap.xml`, và `GET /llms.txt`, xác nhận phản hồi trả về mã 200 với định dạng chuẩn (text/plain, application/xml, text/markdown) và nội dung chính xác.

**Acceptance Scenarios**:
1. **Given** crawler truy cập `/robots.txt`, **When** đọc nội dung, **Then** nhận diện được quyền truy cập các route công khai, cấm crawl các API endpoint riêng tư (`/api/*`), và trỏ link tới sitemap.
2. **Given** crawler truy cập `/sitemap.xml`, **When** phân tích XML, **Then** danh sách các route công khai hiển thị với `lastmod`, `changefreq`, và `priority` hợp lệ.
3. **Given** AI agent truy cập `/llms.txt`, **When** đọc Markdown, **Then** cung cấp tổng quan súc tích về hệ thống, năng lực dịch thuật Gemini AI, và các tính năng chính.

---

### User Story 5 - Nhận Diện Thương Hiệu & Chia Sẻ Mạng Xã Hội (Branding & Rich Preview) (Priority: P3)

Là một người dùng chia sẻ liên kết ứng dụng lên mạng xã hội hoặc ghim ứng dụng vào màn hình chính, tôi muốn ứng dụng có bộ Favicon đầy đủ kích thước, ảnh xem trước Open Graph bắt mắt, và Web App Manifest để nhận diện thương hiệu nhất quán.

**Why this priority**: Tạo độ tin cậy và ấn tượng thương hiệu chuyên nghiệp cho sản phẩm.

**Independent Test**: Kiểm tra thẻ `<link rel="icon">`, `<link rel="apple-touch-icon">`, `<link rel="manifest">`, và thẻ `<meta property="og:image">`, xác minh các tệp ảnh và manifest tồn tại với kích thước chuẩn.

**Acceptance Scenarios**:
1. **Given** người dùng chia sẻ link trang web, **When** crawler mạng xã hội quét thẻ Open Graph, **Then** hiển thị banner `og-image` (1200x630px) mang nhận diện con dấu Chu Sa và khẩu hiệu biên tập.
2. **Given** trình duyệt tải ứng dụng, **When** đọc `manifest.webmanifest`, **Then** nạp đầy đủ tên app, theme color `#141210`, background color `#F7F4EB`, và icons.

---

### User Story 6 - Cấu Trúc Dữ Liệu Schema.org & Điều Hướng Ngữ Nghĩa (Priority: P3)

Là một công cụ tìm kiếm muốn hiểu bản chất kỹ thuật của ứng dụng, tôi muốn ứng dụng cung cấp dữ liệu có cấu trúc chuẩn JSON-LD (`SoftwareApplication` và `WebSite`) cùng thanh điều hướng Breadcrumb ngữ nghĩa để hiển thị Rich Results trên kết quả tìm kiếm.

**Why this priority**: Tăng tỷ lệ nhấp (CTR) từ công cụ tìm kiếm nhờ Rich Snippets (loại phần mềm, giá miễn phí, nhà phát triển).

**Independent Test**: Quét trang bằng Google Rich Results Test (hoặc kiểm tra thẻ `<script type="application/ld+json">`), xác nhận cấu trúc Schema.org hợp lệ không có lỗi schema.

**Acceptance Scenarios**:
1. **Given** trang chủ được tải, **When** đọc thẻ JSON-LD trong `<head>`, **Then** tồn tại Schema `SoftwareApplication` với `applicationCategory: "MultimediaApplication"`, `operatingSystem: "Web Browser"`, và Schema `WebSite`.
2. **Given** người dùng đang ở một tiểu thuyết hoặc tab chức năng, **When** quan sát thanh điều hướng, **Then** breadcrumb semantic `<nav aria-label="Breadcrumb">` hiển thị phân cấp Trang chủ > Tên Dự Án > Tính Năng.

---

### User Story 7 - Tối Ưu Hiệu Năng & Khử Sạch Vết Tích Template (De-Vibecode) (Priority: P3)

Là một người dùng trải nghiệm ứng dụng, tôi muốn trang web tải nhanh, không chứa bất kỳ văn bản vô nghĩa (lorem ipsum), không rò rỉ mã nguồn (sourcemaps) trên bản build production, và không xuất hiện lỗi/cảnh báo rác trong Console trình duyệt.

**Why this priority**: Đảm bảo chất lượng mã nguồn sạch, an toàn thông tin và tính chuyên nghiệp tuyệt đối.

**Independent Test**: Mở DevTools Console khi chạy production build, xác nhận 0 lỗi (0 errors), 0 cảnh báo rác, không tải được tệp `.js.map`, và các module lớn đều được nạp lười (lazy loading).

**Acceptance Scenarios**:
1. **Given** bản build production hoàn tất, **When** kiểm tra thư mục `dist/client/assets`, **Then** không tồn tại bất kỳ tệp `.js.map` hoặc `.css.map` nào.
2. **Given** ứng dụng khởi động, **When** kiểm tra console trình duyệt, **Then** các log gỡ lỗi nội bộ không cần thiết được lọc bỏ ở production mode.

---

### Edge Cases

- **Truy cập deep-link client-side route trực tiếp**: Người dùng gõ trực tiếp URL `/glossary` hoặc `/projects` trên thanh địa chỉ trình duyệt; máy chủ backend phải phục vụ `index.html` với mã HTTP 200, và client-side routing phải tự động kích hoạt đúng tab tương ứng thay vì rơi về tab mặc định.
- **Tên miền tùy chỉnh chạy đằng sau Reverse Proxy**: Ứng dụng chạy sau Cloudflare / Caddy / Nginx; cấu hình base URL và HTTPS redirect phải đọc đúng header `x-forwarded-host` và `x-forwarded-proto`.
- **Hỗ trợ chế độ Offline & PWA**: Khi người dùng mất mạng internet, bộ nhớ IndexedDB và Web App Manifest vẫn cho phép ứng dụng mở giao diện và hiển thị thông báo trạng thái offline phù hợp.
- **Crawler không hỗ trợ JavaScript**: Các file như `robots.txt`, `sitemap.xml`, và `llms.txt` được phục vụ dưới dạng static raw files trực tiếp từ HTTP server, không phụ thuộc vào React runtime.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST cấu hình Base URL linh hoạt thông qua biến môi trường (`APP_BASE_URL` hoặc `VITE_BASE_URL`), mặc định fallback an toàn và loại bỏ hoàn toàn các địa chỉ tuyệt đối `localhost` trong mã nguồn client.
- **FR-002**: Ứng dụng MUST tích hợp component `NotFoundPage` sẵn có để xử lý mọi đường dẫn client-side không hợp lệ, cung cấp nút quay về trang chủ.
- **FR-003**: Máy chủ Express MUST xử lý các yêu cầu gọi vào route API không xác định (`/api/*`) bằng phản hồi JSON `{ error: "Not Found", path: string }` với mã trạng thái HTTP 404 thay vì trả về tài liệu HTML.
- **FR-004**: Ứng dụng MUST cập nhật động thẻ `<title>`, `<meta name="description">`, và `<link rel="canonical">` phù hợp với từng phân vùng chức năng và tiểu thuyết đang hoạt động.
- **FR-005**: Giao diện mỗi màn hình/tab MUST có duy nhất một thẻ `<h1>` ngữ nghĩa, các tiêu đề phụ phân cấp tuần tự `h2`, `h3` theo chuẩn tiếp cận nội dung WCAG 2.1.
- **FR-006**: Hệ thống MUST cung cấp tệp `public/sitemap.xml` liệt kê đầy đủ các route chính của ứng dụng kèm thuộc tính `lastmod`, `changefreq`, và `priority`.
- **FR-007**: Hệ thống MUST cung cấp tệp `public/robots.txt` cho phép các công cụ tìm kiếm thu thập dữ liệu các trang công khai, đồng thời chặn truy cập vào các đường dẫn nội bộ `/api/` và `/ws/`.
- **FR-008**: Hệ thống MUST cung cấp tệp `public/llms.txt` theo chuẩn định dạng Markdown dành riêng cho các AI crawler, mô tả ngắn gọn mục đích dự án, kiến trúc và năng lực dịch thuật.
- **FR-009**: Hệ thống MUST cung cấp bộ favicon đa dạng kích thước (`favicon.ico`, `favicon.svg`, `apple-touch-icon.png`) và tệp `manifest.webmanifest`.
- **FR-010**: Trang `index.html` MUST chứa đầy đủ các thẻ meta Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) và Twitter Cards (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`).
- **FR-011**: Toàn bộ thẻ `<img>` trong hệ thống MUST có thuộc tính `alt` mô tả chính xác mục đích hiển thị của hình ảnh.
- **FR-012**: Ứng dụng MUST cung cấp thanh điều hướng Breadcrumbs ngữ nghĩa `<nav aria-label="Breadcrumb">` tại các màn hình dự án và không gian làm việc.
- **FR-013**: Trang `index.html` MUST nhúng đoạn mã có cấu trúc Schema.org JSON-LD khai báo `SoftwareApplication` và `WebSite` cho dự án.
- **FR-014**: Bản build production MUST tắt hoàn toàn việc tạo sourcemaps (`sourcemap: false`) trên cả Vite và esbuild để bảo vệ mã nguồn.
- **FR-015**: Ứng dụng MUST duy trì kiến trúc chia nhỏ mã nguồn (code-splitting) với `React.lazy` và `manualChunks` tối ưu trong `vite.config.ts`, đảm bảo không có cảnh báo bundle vượt ngưỡng ngoại trừ từ điển `vendor-opencc`.

---

### Key Entities *(include if feature involves data)*

- **SEOMetadata**: Cấu trúc dữ liệu đại diện cho thẻ meta trang (`title`, `description`, `canonicalUrl`, `ogImage`, `robotsDirective`).
- **BreadcrumbItem**: Cấu trúc thành phần phân cấp điều hướng (`label`, `href`, `current`).
- **WebManifest**: Bản mô tả ứng dụng web chuẩn PWA (`name`, `short_name`, `icons`, `theme_color`, `background_color`, `display`, `start_url`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% tài nguyên tĩnh (scripts, stylesheets, fonts, icons) tải thành công với HTTP 200/304 trên bất kỳ custom domain nào mà không có lỗi đường dẫn (0 lỗi asset 404).
- **SC-002**: Điểm kiểm tra Technical SEO trên Lighthouse đạt tối thiểu 95/100 điểm (Title, Meta Description, Canonical, Crawlable links, Image alt attributes).
- **SC-003**: 100% các tệp `robots.txt`, `sitemap.xml`, và `llms.txt` phản hồi HTTP 200 với đúng Content-Type và định dạng hợp lệ.
- **SC-004**: Không có bất kỳ tệp sourcemap (`.map`) nào xuất hiện trong thư mục `dist/client/assets` hoặc `dist/server` sau khi chạy `npm run build`.
- **SC-005**: 100% thẻ `<img>` trong toàn bộ codebase có thuộc tính `alt` hợp lệ.
- **SC-006**: Toàn bộ hệ thống vượt qua 100% Quality Gates: `npm run lint` (0 lỗi type), `npm test` (100% test suites pass), và `npm run build` thành công sạch sẽ.

---

## Assumptions

- Ứng dụng sử dụng mô hình Single Page Application (SPA) với Express tĩnh phía sau; việc đồng bộ route client-side có thể dùng HTML5 History API hoặc state-driven path synchronization.
- Tên miền sản xuất mặc định được dự kiến cấu hình qua biến môi trường `APP_BASE_URL` (ví dụ: `https://dich-truyen.example.com`). Khi chưa có cấu hình, hệ thống sử dụng origin hiện tại của trình duyệt (`window.location.origin`).
- Các bộ từ điển Hán-Việt OpenCC (`opencc-js`) là phụ thuộc bắt buộc phục vụ chuẩn hóa văn bản nên được cô lập trong chunk riêng `vendor-opencc` và được loại trừ khỏi yêu cầu thu nhỏ kích thước bundle dưới 500KB.
