# Implementation Plan: Toàn Diện 20 Hạng Mục Tối Ưu UI/UX Frontend

**Branch**: `084-ui-ux-optimization` | **Date**: 2026-09-05 | **Spec**: [`specs/084-ui-ux-optimization/spec.md`](./spec.md)

---

## 1. Summary

Kế hoạch triển khai đồng bộ và hoàn thiện toàn diện 20 hạng mục UI/UX cho ứng dụng AI Dịch Truyện Trung - Việt theo đúng triết lý thiết kế "Mực & Chu Sa" (*Ink & Cinnabar*), phân bổ thành 4 pha kỹ thuật:
1. **Pha 1: Chuẩn hóa Viewport, SEO & Nhận diện Thương hiệu** (Hạng mục 1, 4, 5, 6, 9)
   - Triệt tiêu hoàn toàn thanh cuộn ngang ngoài ý muốn tại root và container.
   - Bổ sung cấu hình favicon SVG/ICO ấn triện Chu Sa và thẻ `<meta name="description">`.
   - Cập nhật tự động `document.title` theo phân vùng và tên tác phẩm thời gian thực.
   - Trích xuất năm bản quyền tự động thông qua `new Date().getFullYear()`.
2. **Pha 2: Tối ưu Điều hướng, Mobile Menu & Trang 404** (Hạng mục 2, 3, 7, 8, 15, 17)
   - Hoàn thiện Mobile Drawer Menu trượt mượt mà, tự đóng khi chuyển tab trên màn hình <768px.
   - Biến cụm Logo và ấn triện `譯` thành nút điều hướng có thể bấm để trở về Bàn Dịch chính.
   - Xây dựng component `NotFoundPage` phong cách cổ phong với nút quay về bàn dịch.
   - Rà soát thẻ `<a>`, loại bỏ liên kết rỗng `href="#"`, dọn dẹp các dropdown điều hướng thừa thãi.
   - Hoàn thiện các liên kết chính sách bảo mật, điều khoản sử dụng và kho mã nguồn GitHub dưới footer.
3. **Pha 3: Tương tác Nút bấm, Phản hồi Form & Khả năng Tiếp cận** (Hạng mục 11, 12, 13, 14, 18, 19, 20)
   - Chuẩn hóa thuộc tính `type="button"` mặc định cho `Button.tsx` và các nút phân vùng tab.
   - Nâng cấp vùng chạm cảm ứng đạt chuẩn WCAG (tối thiểu 44x44px trên mobile).
   - Thiết lập font chữ tối thiểu 16px cho input trên mobile để ngăn Safari iOS tự động zoom.
   - Tích hợp Toast thông báo thành công khi lưu cài đặt AI và thông báo lỗi trực quan tại trường bắt buộc.
   - Định dạng toàn bộ email thành liên kết `mailto:` và số điện thoại thành `tel:`.
   - Dọn dẹp nhãn placeholder và văn bản mẫu tạm thời.
4. **Pha 4: Đa phương tiện, Hiệu năng Tải & Chống Tràn Bố Cục** (Hạng mục 10, 16)
   - Bổ sung `loading="lazy"`, `decoding="async"`, kích thước và cơ chế fallback ảnh hỏng cho toàn bộ thẻ `<img>`.
   - Bọc vùng cuộn ngang cục bộ an toàn (`overflow-x-auto`) cho bảng `GlossaryTable.tsx` và các khối dữ liệu rộng.

---

## 2. Technical Context

- **Language/Version**: TypeScript 5.8+, Node.js 20+, React 19
- **Primary Dependencies**: Tailwind CSS v4, Lucide React, motion (Motion One / Framer Motion core), Vite 6.x
- **Storage**: Client-side IndexedDB (`src/services/db.ts`) & localStorage
- **Testing**: Vitest (`npm test`), TypeScript compiler (`npm run lint` -> `tsc --noEmit`), Production Build (`npm run build`)
- **Target Platform**: Desktop và Mobile Web Browsers (Chrome, Safari iOS, Firefox, Edge)
- **Project Type**: Client-Side Single Page Application (SPA) with Express.js backend
- **Performance Goals**: Không tăng kích thước initial bundle; không gây CLS (Cumulative Layout Shift); không lag/jank khi cuộn trên mobile.
- **Constraints**:
  - Tuân thủ nghiêm ngặt Design System "Mực & Chu Sa" (`.agents/rules/design-system.md`): màu ink/parchment/polish, font Fraunces/Be Vietnam Pro, bo góc 2px-3px, không dùng thư viện ngoài.
  - Không thay đổi schema IndexedDB (`src/services/db.ts`) hoặc cấu trúc `types.ts`.
  - Không sửa logic dịch hoặc gọi API Gemini trong `server/` hay `src/services/`.
  - 100% test cases pass và `npm run lint` sạch lỗi type.

---

## 3. Constitution Check

| Nguyên tắc | Đánh giá | Trạng thái |
|---|---|---|
| **I. Strict Quality Gates** | `npm run lint`, `npm test`, và `npm run build` phải pass 100% không có lỗi. | ✅ PASS |
| **II. Dependency Minimization** | Không cài thêm package mới nào. Tái sử dụng `lucide-react`, `cn()`, `Button`, `Seal`, `NotificationSystem`. | ✅ PASS |
| **III. Concern Separation** | Chỉ can thiệp vào tầng giao diện trình bày (Frontend UI/UX). Tuyệt đối không can thiệp pipeline dịch hay backend Gemini API. | ✅ PASS |
| **IV. Immutable Core Schemas** | Giữ nguyên toàn bộ schema IndexedDB và các interface trong `src/types.ts`. | ✅ PASS |
| **V. Atomic Commits** | Chia nhỏ các bước theo từng nhóm file liên quan, kiểm tra chặt chẽ sau mỗi pha. | ✅ PASS |

---

## 4. Project Structure

### Documentation (this feature)

```text
specs/084-ui-ux-optimization/
├── plan.md              # Implementation Plan (Tài liệu này)
├── research.md          # Phase 0 Research & Decisions
├── data-model.md        # Phase 1 Data Model & Entities
├── quickstart.md        # Phase 1 Quickstart Validation Guide
├── contracts/           # Phase 1 Interface & UI Contracts
│   └── ui-ux-audit.contract.md
└── checklists/
    └── requirements.md  # Quality Checklist
```

### Source Code Modifications

```text
public/
└── favicon.svg                                  # [NEW] Favicon SVG phong cách ấn triện Chu Sa

index.html                                       # [MODIFY] Thêm thẻ favicon, meta description, viewport theme-color

src/
├── index.css                                    # [MODIFY] overflow-x hidden cho root, chống iOS zoom input font-size
├── App.tsx                                      # [MODIFY] Mobile drawer menu, dynamic title, clickable logo, footer links, copyright year
├── components/
│   ├── common/
│   │   └── NotFoundPage.tsx                     # [NEW] Trang 404 tùy chỉnh phong cách cổ phong
│   ├── ui/
│   │   └── Button.tsx                           # [MODIFY] Default type="button", nâng chuẩn touch targets 44x44px
│   ├── ApiSettings.tsx                          # [MODIFY] Thêm toast thông báo thành công khi lưu/đóng
│   ├── glossary-manager/
│   │   ├── AddGlossaryForm.tsx                  # [MODIFY] Inline form error highlight cho trường bắt buộc
│   │   └── GlossaryTable.tsx                    # [MODIFY] Bọc overflow-x-auto min-w-[640px] chống vỡ layout mobile
│   ├── google-sync/
│   │   ├── GoogleSyncModal.tsx                  # [MODIFY] loading="lazy", decoding="async" cho ảnh đại diện
│   │   ├── GoogleUserButton.tsx                 # [MODIFY] loading="lazy", onError fallback cho ảnh avatar
│   │   └── ShareProjectModal.tsx                # [MODIFY] Chuyển đổi email thành link mailto: bấm được
│   └── project-list/
│       └── ProjectFormModal.tsx                 # [MODIFY] Inline error highlight và dọn dẹp placeholder text
```

---

## 5. Implementation Phases

### Pha 1: Chuẩn hóa Root Viewport, SEO & Nhận diện Thương hiệu
- Tạo `public/favicon.svg` với con dấu triện chữ `譯` trên nền mực và viền Chu Sa.
- Sửa `index.html`: khai báo `<link rel="icon">`, `<meta name="description">`, `<meta property="og:...">`.
- Sửa `src/index.css`: bổ sung `max-width: 100vw; overflow-x: hidden;` cho `html, body, #root`.
- Sửa `src/App.tsx`:
  - Bổ sung `max-w-full overflow-x-clip` cho `#ai-story-translator-app`.
  - Tích hợp hook `useEffect` cập nhật `document.title` động theo `activeTab` và `activeProject.title`.
  - Cập nhật dòng bản quyền tự động với `new Date().getFullYear()`.

### Pha 2: Hệ thống Điều hướng, Mobile Menu & Trang 404
- Sửa `src/App.tsx`:
  - Thêm state `isMobileMenuOpen` và nút Hamburger Menu (`MoreHorizontal` / `X`) trên header cho mobile (<768px).
  - Thêm ngăn kéo điều hướng di động (Mobile Drawer) mượt mà, tự đóng khi click hoặc chuyển tab.
  - Chuyển cụm Logo + Seal `譯` thành nút bấm quay về Bàn Dịch chính.
  - Thay thế các span tĩnh dưới Footer thành liên kết hợp lệ (GitHub, Chính sách bảo mật, Mailto).
  - Tối ưu dropdown "Thêm" trên thanh tab desktop để tránh trùng lặp điều hướng.
- Tạo mới `src/components/common/NotFoundPage.tsx` tuân thủ chuẩn Seal, Button, Typography Mực & Chu Sa.

### Pha 3: Tương tác Nút bấm, Phản hồi Form & Khả năng Tiếp cận
- Sửa `src/components/ui/Button.tsx`:
  - Gán mặc định `type = props.type || 'button'`.
  - Nâng cấp kích thước vùng bấm (touch target) trên mobile (`min-h-[40px] sm:min-h-[32px]` hoặc vùng đệm tương đương).
- Sửa `src/index.css`:
  - Thêm media query mobile thiết lập font-size 16px cho `input, select, textarea` để ngăn chặn hành vi auto-zoom gây khó chịu trên Safari iOS.
- Sửa `src/components/ApiSettings.tsx`:
  - Bổ sung `showToast({ message: "Đã lưu và áp dụng cấu hình AI thành công!", type: 'success' })` khi người dùng bấm Lưu & Đóng.
- Sửa `src/components/glossary-manager/AddGlossaryForm.tsx` và `ProjectFormModal.tsx`:
  - Bổ sung inline error state (viền đỏ Chu Sa, thông báo lỗi trực quan dưới ô nhập liệu khi bỏ trống).
  - Dọn dẹp các nhãn placeholder chưa tối ưu.
- Sửa `src/components/google-sync/ShareProjectModal.tsx`:
  - Chuyển đổi chuỗi email thành thẻ `<a href="mailto:...">` có hover style.
- Bổ sung số điện thoại hỗ trợ dạng `<a href="tel:...">` tại footer.

### Pha 4: Đa phương tiện, Hiệu năng Tải & Chống Tràn Bố Cục
- Sửa `src/components/google-sync/GoogleUserButton.tsx`, `GoogleSyncModal.tsx`, `ShareProjectModal.tsx`:
  - Bổ sung `loading="lazy"`, `decoding="async"`, width, height và `onError` fallback cho toàn bộ thẻ `<img>`.
- Sửa `src/components/glossary-manager/GlossaryTable.tsx`:
  - Bọc bảng 12 cột trong container `<div className="w-full overflow-x-auto"><div className="min-w-[640px]">...</div></div>` để bảo đảm bảng cuộn mượt cục bộ, không phá vỡ chiều rộng màn hình điện thoại.

---

## 6. Verification Plan

### Automated Verification
- `npm run lint`: Xác minh TypeScript type check sạch 100% không có lỗi type.
- `npm test`: Chạy toàn bộ 96 test suites (675 tests), đảm bảo 100% pass và không có regression.
- `npm run build`: Build bundle production hoàn tất (Vite + esbuild server).

### Responsive & Visual Quality Verification
- Kiểm tra chế độ Responsive Device Emulation trên Chrome DevTools tại các kích thước:
  - Mobile nhỏ: iPhone SE (375 x 667px)
  - Mobile tiêu chuẩn: iPhone 14 / Pixel 7 (390 x 844px)
  - Tablet: iPad Mini (768 x 1024px)
  - Desktop: Laptop (1366 x 768px, 1920 x 1080px)
- Xác nhận:
  - Thanh cuộn ngang cửa sổ trình duyệt (`window.scrollX`) luôn bằng 0.
  - Hamburger Menu đóng mở mượt mà, chọn mục là chuyển tab và tự ẩn menu.
  - Bấm vào logo ở header luôn chuyển về tab Dịch Thuật.
  - Thử nhập liệu thiếu trường trong form thêm thuật ngữ, xác nhận ô nhập liệu hiện viền đỏ Chu Sa và thông báo lỗi rõ ràng.
  - Nhấn vào email hoặc số điện thoại, xác nhận trình duyệt kích hoạt giao thức `mailto:` và `tel:`.
