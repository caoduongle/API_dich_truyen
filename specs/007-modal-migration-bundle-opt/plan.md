# Implementation Plan: Hoàn Thiện Modal Chung & Minh Bạch Cấu Hình Bundle opencc-js

**Feature**: `007-modal-migration-bundle-opt`  
**Spec**: [specs/007-modal-migration-bundle-opt/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/007-modal-migration-bundle-opt/spec.md)  
**Research**: [specs/007-modal-migration-bundle-opt/research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/007-modal-migration-bundle-opt/research.md)  
**Data Model**: [specs/007-modal-migration-bundle-opt/data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/007-modal-migration-bundle-opt/data-model.md)  
**Contract**: [specs/007-modal-migration-bundle-opt/contracts/ui-modal-bundle.contract.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/007-modal-migration-bundle-opt/contracts/ui-modal-bundle.contract.md)  

---

## 1. Executive Summary

Kế hoạch này giải quyết dứt điểm 2 khoản nợ kỹ thuật và hoàn thiện cấu hình build:
1. **User Story 1**: Chuyển đổi các modal dialog còn lại (`ImportGuidelinesModal.tsx`, `QuickAddTermModal.tsx`) sang `src/components/ui/Modal.tsx` và chuẩn hóa thang z-index (`LanguageSelector.tsx` sang `z-40`).
2. **User Story 2**: Minh bạch hóa lý do kỹ thuật của `opencc-js` và `chunkSizeWarningLimit: 1200` trong `vite.config.ts`.

Theo quy tắc của `AGENTS.md`, mỗi bước sửa đổi sẽ được thực hiện độc lập, giữ nguyên 100% câu chữ tiếng Việt, không sửa logic dịch, và bảo đảm chạy sạch toàn bộ các cổng kiểm tra chất lượng (`npm run lint`, `npm test`, `npm run build`).

---

## 2. User Review Required

> [!NOTE]
> - `ProjectFormModal.tsx` được xác nhận là inline form nằm trong luồng trang `ProjectList.tsx`, không phải overlay dialog thật nên sẽ được giữ nguyên cấu trúc inline.
> - `opencc-js` (~1.12MB) bắt buộc phải nạp đồng bộ vì phục vụ các hàm so sánh Hán-Việt (`canonicalizeHan`, `isHanEquivalent`) chạy liên tục trong các React Hook và hàm lọc danh sách. Cấu hình `vite.config.ts` sẽ được bổ sung chú thích kỹ thuật chi tiết.

---

## 3. Proposed Changes

### Component 1: Glossary Manager Modal Migration

#### [MODIFY] [ImportGuidelinesModal.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/glossary-manager/ImportGuidelinesModal.tsx)
- Import `{ Modal } from '../ui/Modal'`.
- Thay thế thẻ `<div id="md-uploader-zone">` và nút đóng tự viết bằng component `<Modal open={isImporting} onClose={() => setIsImporting(false)} title="..." description="..." icon={<FileText />} size="xl">`.
- Giữ nguyên toàn bộ nội dung tiếng Việt và logic xử lý file `.md`.

---

### Component 2: Translator Workspace Modal Migration

#### [MODIFY] [QuickAddTermModal.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/translator-workspace/QuickAddTermModal.tsx)
- Import `{ Modal } from '../ui/Modal'`.
- Giữ thanh trigger banner nhỏ gọn khi người dùng bôi đen chữ Hán (`!quickAddOpen`).
- Khi `quickAddOpen === true`, bọc form nhập liệu và trạng thái loading trong `<Modal open={quickAddOpen} onClose={handleCancelQuickAdd} title="..." icon={<Sparkles />} size="lg">`.
- Loại bỏ lệnh `console.error` thô và bảo toàn các thông báo toast tiếng Việt.

---

### Component 3: Z-Index Standardization

#### [MODIFY] [LanguageSelector.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/common/LanguageSelector.tsx)
- Thay đổi class `z-50` của menu dropdown `listbox` thành `z-40` theo đúng thang dropdown/tooltip của `.agents/rules/design-system.md`.

---

### Component 4: Build Configuration Documentation

#### [MODIFY] [vite.config.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/vite.config.ts)
- Bổ sung khối chú thích kỹ thuật (code comments) chi tiết về:
  - Bản chất của chunk `vendor-opencc` (1.12MB từ điển Giản-Phồn).
  - Lý do không thể lazy-load bất đồng bộ (phục vụ engine chuẩn hóa đồng bộ cho `sinoNormalize.ts`).
  - Lý do đặt `chunkSizeWarningLimit: 1200` và chiến lược cách ly chunk độc lập để bảo vệ kích thước bundle của `vendor-react` và `index.js`.

---

## 4. Verification Plan

### Automated Tests
1. `npm run lint` (`tsc --noEmit`) - Xác nhận không có lỗi kiểu dữ liệu TypeScript.
2. `npm test` (`vitest run`) - Xác nhận 100% test suites pass (210/210 tests).
3. `npm run build` - Xác nhận Vite và esbuild biên dịch sạch sẽ, tạo đúng các manual chunks.

### Manual Verification
- Kiểm tra trực quan thao tác mở/đóng modal `ImportGuidelinesModal` và `QuickAddTermModal`.
- Kiểm tra thao tác phím Escape và click backdrop.
- Kiểm tra menu chọn ngôn ngữ không đè lớp sai lệch.
