# Implementation Plan: Technical SEO & De-Vibecode Hoàn Thiện Triển Khai Thực Tế

**Branch**: `087-technical-seo-devibecode` | **Date**: 2026-09-05 | **Spec**: [`specs/087-technical-seo-devibecode/spec.md`](./spec.md)

---

## 1. Summary

Kế hoạch triển khai "de-vibecode" toàn diện và tối ưu hóa Technical SEO cho hệ thống **AI Dịch Truyện Trung - Việt** (Bàn Biên Tập Bản Thảo Chu Sa), chuyển hóa ứng dụng từ dạng nguyên mẫu thử nghiệm sang sản phẩm web chuyên nghiệp, sẵn sàng triển khai chính thức với Custom Domain:
1. **Custom Domain & Page Sources**: Chuẩn hóa Base URL trong `vite.config.ts`, đảm bảo tài nguyên tĩnh tải qua root-relative path và thiết lập biến môi trường `APP_BASE_URL` phía server để sinh Canonical URL, Open Graph và Sitemap chuẩn xác.
2. **Custom 404 Page**: Tích hợp component `NotFoundPage` sẵn có (mang nhận diện triện "無" và phong cách Mực & Chu Sa) vào luồng định tuyến của `App.tsx`; bổ sung JSON 404 handler cho các route API `/api/*` không xác định trên Express server.
3. **On-Page SEO Foundations**: Xây dựng hook `useSeoMetadata` quản lý dynamic `<title>`, `<meta name="description">`, và `<link rel="canonical">` cho từng phân vùng; chuẩn hóa hệ thống heading ngữ nghĩa (duy nhất một `<h1>` và phân cấp `h2`, `h3`).
4. **Crawler & AI Indexing**: Phát hành `public/sitemap.xml`, `public/robots.txt`, và `public/llms.txt` phục vụ cả công cụ tìm kiếm truyền thống (Googlebot) và các tác tử AI (AI Agents / Perplexity / Claude).
5. **Branding & Social Share**: Bổ sung `public/site.webmanifest`, ảnh banner `public/og-image.png` (1200x630px), đầy đủ thẻ Open Graph & Twitter Cards, và thẩm định thuộc tính `alt` cho 100% thẻ `<img>`.
6. **Cấu Trúc Dữ Liệu & Điều Hướng**: Nhúng Schema.org JSON-LD (`WebApplication` & `WebSite`) vào `index.html`, tạo component `Breadcrumbs` ngữ nghĩa với Microdata.
7. **Performance & Dọn Dẹp Dấu Vết Template**: Tắt sourcemap production, dọn dẹp console logging ở production, duy trì chiến lược code-splitting với `React.lazy` và `manualChunks`.

---

## 2. Technical Context

- **Language/Version**: TypeScript 5.8+, Node.js 20+, React 19
- **Primary Dependencies**: Express 4.21+, Helmet 8.3+, ioredis 5.5+, ws 8.21+, Vite 6.2+, Tailwind CSS v4, Lucide React, motion
- **Storage**: Client-side IndexedDB (`src/services/db.ts`), Redis distributed cache/session/rate-limiter, Google Drive OAuth PKCE
- **Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint` -> `tsc --noEmit`), Production Build (`npm run build`)
- **Target Platform**: Web Browsers (Chrome, Edge, Safari, Firefox), Linux Node.js Container (Cloud Run / Render / Docker)
- **Project Type**: Single Page Application (React) + Express Backend API
- **Performance Goals**: First Contentful Paint (FCP) < 1.2s, Largest Contentful Paint (LCP) < 2.5s, 0 console errors, 0 asset 404s
- **Constraints**:
  - Tuân thủ Hiến pháp AI Dịch Truyện Trung-Việt v1.0.0 (100% test pass, không đổi core schema `src/types.ts` hoặc IndexedDB schema, không sửa logic dịch thuật prompt của Gemini).
  - Không thêm thư viện NPM bên ngoài nếu có thể giải quyết bằng công nghệ sẵn có.

---

## 3. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá Tuân thủ | Trạng thái |
|---|---|---|
| **I. Strict Quality Gates (NON-NEGOTIABLE)** | `tsc --noEmit`, `vitest run`, và `npm run build` PHẢI pass sạch 100% không có lỗi. Không xóa hay tắt test. | ✅ PASS |
| **II. Dependency Minimization & Existing Library Reuse** | Sử dụng React built-in hooks, DOM API chuẩn cho SEO meta, Lucide React, tailwindcss v4, không cài thêm `react-helmet` hay thư viện nặng. | ✅ PASS |
| **III. Strict Concern Separation & Domain Boundary Preservation** | Chỉ tác động đến tầng SEO meta, routing fallback, assets static, và server route handlers. Tuyệt đối không chạm vào prompt dịch thuật Gemini. | ✅ PASS |
| **IV. Immutable Core Schemas & Storage Stability** | Giữ nguyên các interface trong `src/types.ts` và schema IndexedDB trong `src/services/db.ts`. Giữ nguyên văn phong tiếng Việt chuẩn mực. | ✅ PASS |
| **V. Atomic Commits & Documentation Sync** | Triển khai theo từng module độc lập, cập nhật đồng bộ các tài liệu hợp đồng và đặc tả. | ✅ PASS |

---

## 4. Project Structure

### Documentation (this feature)

```text
specs/087-technical-seo-devibecode/
├── spec.md              # Bản đặc tả 7 hạng mục Technical SEO & De-Vibecode
├── plan.md              # Kế hoạch thực hiện chi tiết (file này)
├── research.md          # Nghiên cứu giải pháp kỹ thuật & quyết định kiến trúc
├── data-model.md        # Cấu trúc dữ liệu SEO metadata, Breadcrumbs, Manifest
├── quickstart.md        # Kịch bản kiểm thử nghiệm thu SEO end-to-end
├── contracts/
│   └── seo-endpoints.contract.md # Hợp đồng API 404, robots, sitemap, llms.txt
└── checklists/
    └── requirements.md  # Checklist nghiệm thu chất lượng đặc tả
```

### Source Code Impact Matrix

```text
public/
├── robots.txt                       # [NEW] Chỉ dẫn crawler tìm kiếm và bảo vệ API
├── sitemap.xml                      # [NEW] Sơ đồ trang web liệt kê các route công khai
├── llms.txt                         # [NEW] Ngữ cảnh cho AI models & agent crawl
├── site.webmanifest                 # [NEW] Web App Manifest chuẩn PWA
└── og-image.png                     # [NEW] Banner xem trước mạng xã hội chuẩn 1200x630px

index.html                           # Nhúng Open Graph, Twitter Card, Favicon, JSON-LD Schema
vite.config.ts                       # Cấu hình base URL, tắt sourcemap production, dọn dẹp console
server.ts                            # API 404 handler trả JSON, hỗ trợ APP_BASE_URL
server/config/env.ts                 # Thêm biến APP_BASE_URL vào schema validation

src/
├── utils/
│   └── seoConfig.ts                 # [NEW] Cấu hình Domain & URL Canonical tập trung
├── hooks/
│   └── useSeoMetadata.ts            # [NEW] Hook cập nhật dynamic title, meta desc, canonical
├── components/
│   ├── common/
│   │   ├── Breadcrumbs.tsx          # [NEW] Thanh điều hướng phân cấp ngữ nghĩa Microdata
│   │   └── NotFoundPage.tsx         # [CÓ SẴN] Trang 404 Mực & Chu Sa
│   └── translator-workspace/
│       └── CollaboratorPresenceBar.tsx # Bổ sung fallback alt cho avatar
└── App.tsx                          # Tích hợp NotFoundPage, breadcrumbs, useSeoMetadata
```

---

## 5. Phases & Execution Roadmap

### Pha 1: Chuẩn Hóa Base URL, Tắt Sourcemap & API 404 Handler (Hạng mục 1, 2, 7)
- Cập nhật `vite.config.ts`: thêm `base: process.env.VITE_BASE_URL || '/'`, `sourcemap: false`, lọc drop console ở production.
- Cập nhật `server/config/env.ts` và `server.ts`: gắn API 404 handler trả JSON cho `/api/*`.
- Tạo `src/utils/seoConfig.ts` quản lý URL tập trung.

### Pha 2: Tích Hợp Custom 404 Page & Dynamic Routing Fallback (Hạng mục 2)
- Cập nhật `App.tsx` kiểm tra `window.location.pathname` để render `NotFoundPage` khi route không hợp lệ.
- Viết unit test cho `NotFoundPage` và logic route fallback.

### Pha 3: On-Page SEO Hook, Canonical & Heading Optimization (Hạng mục 3)
- Tạo `src/hooks/useSeoMetadata.ts` cập nhật động title, description, canonical link khi chuyển tab hoặc đổi tiểu thuyết.
- Tích hợp vào `App.tsx`, đảm bảo phân cấp heading chuẩn (duy nhất một `<h1>`, các tab con dùng `<h2>`).

### Pha 4: Crawler & AI Indexing Files (Hạng mục 4)
- Tạo `public/robots.txt`, `public/sitemap.xml`, và `public/llms.txt`.
- Cấu hình server static hoặc route phục vụ tệp với đúng Content-Type.

### Pha 5: Branding, Social Share & Structured Data (Hạng mục 5, 6)
- Tạo `public/site.webmanifest` và `public/og-image.png`.
- Nhúng Schema.org JSON-LD (`WebApplication` và `WebSite`) vào `index.html`.
- Bổ sung thẻ Open Graph & Twitter Cards vào `index.html`.
- Tạo `src/components/common/Breadcrumbs.tsx` với Microdata Schema.org.

### Pha 6: Quality Gates & Verification Toàn Diện
- Chạy `npm run lint` (`tsc --noEmit`), `npm test`, `npm run build`.
- Kiểm tra không còn sourcemap nào rò rỉ trong `dist/client/assets` và `dist/server`.
- Kiểm tra toàn diện qua curl và DevTools Console.

