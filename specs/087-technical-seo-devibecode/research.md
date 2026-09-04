# Research & Technical Decisions: Technical SEO & De-Vibecode Hardening

**Feature**: `087-technical-seo-devibecode`  
**Date**: 2026-09-05  
**Role**: Technical Lead & Application Architect  

---

## 1. Technical Decisions & Architectural Rationale

### Quyết định 1: Cơ chế xử lý Base URL & Custom Domain
- **Bối cảnh**: Ứng dụng Single Page Application (SPA) triển khai với Custom Domain riêng hoặc chạy sau reverse proxy (Cloudflare/Nginx) có thể gặp lỗi 404 tài nguyên tĩnh nếu cấu hình asset path sai lệch.
- **Quyết định**:
  - Trong `vite.config.ts`: Cấu hình `base: process.env.VITE_BASE_URL || '/'`. Điều này đảm bảo đường dẫn tài nguyên tĩnh luôn là root-relative `/assets/...`, tránh phụ thuộc vào tên miền cục bộ `localhost`.
  - Phía máy chủ Express (`server.ts`): Bổ sung biến môi trường `APP_BASE_URL` (ví dụ: `https://dich-truyen.example.com`). Sử dụng biến này để sinh URL tuyệt đối cho `sitemap.xml`, `robots.txt`, và các thẻ Open Graph / Canonical. Nếu chưa cấu hình, fallback sang `req.protocol + '://' + req.get('host')`.
- **Phương án thay thế bị loại bỏ**:
  - Dùng relative path `./assets`: Dễ gây lỗi khi người dùng truy cập các sub-routes sâu (deep-linking) như `/projects/123/chapter/1`.

---

### Quyết định 2: Tích hợp Custom 404 Page (Phía Client & Server)
- **Bối cảnh**: Khi người dùng nhập sai URL hoặc bấm vào liên kết gãy, ứng dụng hiện tại chỉ hiển thị tab mặc định (`translate`) mà không thông báo lỗi 404, làm sai lệch nhận thức người dùng và giảm chất lượng SEO (soft 404).
- **Quyết định**:
  - **Client**: Tận dụng component `src/components/common/NotFoundPage.tsx` sẵn có (mang dấu triện Chu Sa "無" và ngôn ngữ thiết kế Mực & Chu Sa). Thêm logic kiểm tra `window.location.pathname` trong `App.tsx`: nếu pathname không nằm trong danh sách tab hợp lệ (`translate`, `auto-translate`, `glossary`, `history`, `projects`, `hako-checker`), hiển thị `NotFoundPage` kèm nút bấm quay về Bàn Dịch Thuật.
  - **Server**: Express router chặn tất cả các yêu cầu `/api/*` không xác định và trả về JSON chuẩn HTTP 404 (`{ error: "Not Found", path: req.originalUrl }`), ngăn chặn việc trả về HTML Single Page Application cho các lời gọi API lỗi.
- **Phương án thay thế bị loại bỏ**:
  - Tải lại toàn bộ trang qua `window.location.href = '/'`: Làm mất trạng thái offline và IndexedDB đang mở; thay vào đó, điều hướng nội bộ bằng việc cập nhật `activeTab = 'translate'` và cập nhật `history.pushState`.

---

### Quyết định 3: Quản lý On-Page SEO (Dynamic Head Meta) không cài thêm thư viện
- **Bối cảnh**: Cần cập nhật động `<title>`, `<meta name="description">`, `<link rel="canonical">` và Open Graph tags cho từng phân vùng làm việc mà không vi phạm **Constitution Gate II** (không cài thêm thư viện phụ thuộc như `react-helmet` hay `next-seo`).
- **Quyết định**:
  - Tạo custom hook `src/hooks/useSeoMetadata.ts` nhẹ (< 50 dòng code), sử dụng trực tiếp DOM API (`document.title`, `document.querySelector('meta[name="..."]')`). Hook này tự động dọn dẹp và cập nhật khi tab hoặc tiểu thuyết thay đổi.
- **Phương án thay thế bị loại bỏ**:
  - Cài `react-helmet` hoặc `react-helmet-async`: Tăng kích thước bundle thêm ~40KB và gây xung đột React 19 concurrent mode.

---

### Quyết định 4: Chiến lược Crawler & AI Indexing (`robots.txt`, `sitemap.xml`, `llms.txt`)
- **Bối cảnh**: Các công cụ tìm kiếm truyền thống (Googlebot, Bingbot) và các AI Agent mới (Perplexity, ChatGPT, Claude) cần thông tin máy học và chỉ mục để thu thập dữ liệu chính xác.
- **Quyết định**:
  - Đặt trực tiếp các file tĩnh `robots.txt`, `sitemap.xml`, và `llms.txt` trong thư mục `public/`. Khi Vite chạy `npm run build`, các tệp này tự động được sao chép nguyên vẹn sang `dist/client/`.
  - Phía server Express: Bổ sung cấu hình explicit route handlers để đảm bảo trả về đúng MIME type (`text/plain` cho robots.txt, `application/xml` cho sitemap.xml, và `text/markdown` cho llms.txt).
- **Lợi ích**:
  - Phục vụ tĩnh tức thì, không tiêu tốn CPU/RAM của server.
  - Hỗ trợ chuẩn `llms.txt` mới nhất của cộng đồng AI/LLM.

---

### Quyết định 5: Loại bỏ Sourcemap & Làm Sạch Dấu Vết Template (De-Vibecode)
- **Bối cảnh**: Bản build thử nghiệm đôi khi chứa sourcemap hoặc để lại log console ở production, làm giảm hiệu năng và rò rỉ cấu trúc mã nguồn.
- **Quyết định**:
  - Thiết lập `sourcemap: false` tường minh trong `vite.config.ts`.
  - Cấu hình esbuild `drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []` để tự động loại bỏ mọi `console.log` cấp thấp khi đóng gói production.
  - Kiểm tra 100% thuộc tính `alt` của thẻ `<img>` đảm bảo tuân thủ tiêu chuẩn tiếp cận WCAG và Technical SEO.

