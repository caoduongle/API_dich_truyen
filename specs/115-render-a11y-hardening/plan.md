# Implementation Plan: Render Production Hardening, WCAG 2.1 AA Accessibility & Semantic Design Tokens

**Branch**: `115-render-a11y-hardening` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/115-render-a11y-hardening/spec.md`

## Summary

Triển khai cấu hình hạ tầng Blueprint tĩnh cho Render (`render.yaml`), khắc phục lỗi 404 định tuyến SPA qua rewrite rules, siết chặt 7 tiêu đề HTTP security headers, chuẩn hóa Web Accessibility đạt WCAG 2.1 AA (bẫy focus modal, ARIA Live Region, skip-to-content, ARIA-expanded), thiết lập 4 nhóm token ngữ nghĩa chuẩn 3 theme, đảm bảo tỷ lệ tương phản văn bản $\ge 4.5:1$, và cập nhật sitemap/metadata chính xác cho `https://api-dich-truyen.onrender.com/`.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19

**Primary Dependencies**: `lucide-react`, `motion`, `clsx`, `tailwind-merge` (Không thêm bất kỳ thư viện ngoài nào)

**Storage**: IndexedDB client-side, sessionStorage

**Testing**: Vitest (`npm test`, `npx vitest run`)

**Target Platform**: Render Static Hosting, Modern Web Browsers

**Project Type**: 100% Pure Client-Side Single Page Application (SPA)

**Performance Goals**: Không tăng kích thước bundle vượt quá ngân sách; audit tương phản đạt $\ge 4.5:1$; 100% pass quality gates.

**Constraints**: Không sửa logic dịch/Gemini trong `src/services/`; không đổi schema IndexedDB `src/services/db.ts`; không phá vỡ các hosting provider khác (`public/_headers`, `vercel.json`).

**Scale/Scope**: Toàn bộ ứng dụng (AppShell, Navigation, Footers, Modals, Panels tạo sau Spec 084).

## Constitution Check

| Nguyên tắc Hiến pháp | Đánh giá | Trạng thái |
| :--- | :--- | :--- |
| **I. Strict Quality Gates** | Phải vượt qua `npm run lint`, `npm test`, `npm run build` không lỗi, không skip test. | **PASS** |
| **II. Dependency Minimization** | Tái sử dụng `clsx`, `tailwind-merge`, `lucide-react`, primitives hiện có. Không cài thêm npm package. | **PASS** |
| **III. MVC Domain Boundaries** | Trách nhiệm phân tách rõ: cấu hình hạ tầng root (`render.yaml`), cấu hình SEO/robots (`public/`), styling/tokens (`src/index.css`), primitives UI (`src/components/ui/`), các panel giao diện người dùng. | **PASS** |
| **IV. Immutable Core Schemas** | Schema IndexedDB và `types.ts` giữ nguyên 100%. | **PASS** |
| **V. Atomic Commits & Docs Sync** | Đồng bộ toàn bộ tài liệu spec, plan, tasks. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/115-render-a11y-hardening/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
└── tasks.md             # Tasks definition
```

### Source Code Touched

- `render.yaml`: Blueprint cấu hình hosting Render và 7 security headers
- `public/robots.txt`: Cập nhật sitemap và xóa disallow thừa
- `public/sitemap.xml`: Đồng bộ 6 routes theo VALID_TABS
- `index.html`: Cập nhật canonical domain & JSON-LD
- `src/index.css`: Bảng mã màu ngữ nghĩa & độ tương phản
- `src/App.tsx` & `src/components/layout/TabContent.tsx`: Skip-to-content link
- `src/components/layout/AppFooter.tsx`: Modal refactor & chính sách bảo mật
- `src/components/NotificationSystem.tsx`: ARIA Live Region & token ngữ nghĩa
- `src/components/ui/Badge.tsx`: Hỗ trợ tone='success'
- `src/components/translator-workspace/UnifiedAuditPanel.tsx`: ARIA role tablist & touch target
- `src/components/hako-checker/HakoIssueReviewPanel.tsx`: ARIA role & semantic tokens
- `src/components/hako-checker/HakoIssueCard.tsx`: Semantic tokens
- `src/components/glossary-manager/DuplicatePanel.tsx`: EmptyState & aria-expanded
- `src/components/ChapterHistoryPanel.tsx`: Focusable delete button & ARIA role tablist
- `src/components/api-settings/KeyListSection.tsx`: Focus visible & Quota warning note
- `src/components/auto-translator/ZuminovelPublishPanel.tsx`: Semantic tokens & focus rings
- `src/utils/contrastAuditor.ts`: Cập nhật palette audit
- `src/utils/seoConfig.ts` & `src/utils/__tests__/seoConfig.test.ts`: Fallback domain & test
- `README.md`: Hướng dẫn triển khai Render
```

