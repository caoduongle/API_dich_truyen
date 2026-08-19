# Research & Technical Discovery: Modal Migration & opencc-js Bundle Analysis

**Feature**: `007-modal-migration-bundle-opt`  
**Created**: 2026-08-19  

---

## 1. Modal Dialog Migration Audit

### Context & Goal
`.agents/rules/design-system.md` ghi nhận sự tồn tại của ~8 modal tự viết riêng với các cấu trúc markup, backdrop, và z-index khác nhau. Mục tiêu là hợp nhất toàn bộ các hộp thoại overlay thực sự sang component chuẩn `src/components/ui/Modal.tsx`.

### Audit Chi Tiết Từng Component

| Component | Vị trí file | Trạng thái hiện tại | Phân loại & Hướng xử lý |
|:---|:---|:---|:---|
| **DiffModal** | `src/components/auto-translator/DiffModal.tsx` | Đã dùng `{ Modal } from '../ui/Modal'` | ✅ **Đã hoàn thành**. Giữ nguyên. |
| **AuthModal** | `src/components/AuthModal.tsx` | Đã dùng `{ Modal } from './ui/Modal'` | ✅ **Đã hoàn thành**. Giữ nguyên. |
| **ProjectMetadataModal** | `src/components/translator-workspace/ProjectMetadataModal.tsx` | Đã dùng `{ Modal } from '../ui/Modal'` | ✅ **Đã hoàn thành**. Giữ nguyên. |
| **ApiSettings** | `src/components/ApiSettings.tsx` | Đã dùng `{ Modal } from './ui/Modal'` | ✅ **Đã hoàn thành**. Giữ nguyên. |
| **ReviewQueuePanel** (Fuzzy Context Modal) | `src/components/glossary-manager/ReviewQueuePanel.tsx` | Đã dùng `{ Modal } from '../ui/Modal'` | ✅ **Đã hoàn thành**. Giữ nguyên. |
| **ImportGuidelinesModal** | `src/components/glossary-manager/ImportGuidelinesModal.tsx` | Đang render inline card `id="md-uploader-zone"` khi `isImporting=true` | ⚠️ **Cần migrate**. Chuyển đổi thành `<Modal open={isImporting} onClose={() => setIsImporting(false)} title="..." size="xl">`. |
| **QuickAddTermModal** | `src/components/translator-workspace/QuickAddTermModal.tsx` | Khi bôi đen, hiển thị bar inline. Khi bấm "Tra cứu & Thêm nhanh", form nhập liệu hiển thị inline trong cùng container. | ⚠️ **Cần migrate**. Giữ trigger banner nhỏ gọn bên dưới textarea; khi người dùng kích hoạt `quickAddOpen=true`, hiển thị form nhập liệu và loading trong `Modal` chuẩn (`ui/Modal.tsx`). |
| **ProjectFormModal** | `src/components/project-list/ProjectFormModal.tsx` | Render inline `<form>` bên trong luồng trang `ProjectList.tsx` | ℹ️ **Xác nhận giữ nguyên**. Đây là form inline trên trang danh sách truyện, không phải overlay dialog. |
| **ImportChaptersModal** | `src/components/translator-workspace/ImportChaptersModal.tsx` | Render sub-section trong `ProjectMetadataModal` (`importSection`) | ℹ️ **Xác nhận giữ nguyên**. Đã nằm bên trong `Modal` của `ProjectMetadataModal`. |

---

## 2. Phân Tích Kỹ Thuật opencc-js & Bundle Optimization

### 2.1. Đánh giá Khả Năng Lazy-Load
Thư viện `opencc-js` (1.12MB minified, 485KB gzip) chứa toàn bộ từ điển và bảng ánh xạ ký tự Hán Phồn thể - Giản thể.

Đánh giá chi tiết sự phụ thuộc trong `shared/sinoNormalize.ts`:
1. `shared/sinoNormalize.ts` khởi tạo converter đồng bộ:
   ```ts
   const t2sConverter = OpenCC.Converter({ from: 't', to: 'cn' });
   ```
2. Các hàm cốt lõi:
   - `canonicalizeHan(text: string): string`
   - `isHanEquivalent(a: string, b: string): boolean`
   - `findCanonicalSubstring(haystack: string, needle: string): string | null`
   - `validateAndSnapBackEntities(items: any[], sourceText: string): any[]`
   - `findFuzzyCandidates(sourceText: string, targetHan: string, maxCandidates: number = 3): FuzzyCandidate[]`
3. Các điểm gọi trong ứng dụng:
   - `useProjects.ts`: cập nhật glossary, đồng bộ chương truyện.
   - `useTranslationProcess.ts`: đối soát từ vựng trước khi gọi prompt AI.
   - `useGlossaryDuplicates.ts`: gom nhóm và lọc từ khóa trùng lặp đồng bộ.
   - `useGlossaryScan.ts`: quét từ vựng thời gian thực trong source text.
   - `GlossaryManager.tsx`: tìm kiếm, lọc danh sách (`useMemo` và `.filter`).
   - `AddGlossaryForm.tsx`: kiểm tra trùng chữ Hán ngay khi người dùng gõ phím.

### 2.2. Kết luận Kỹ Thuật
- **Không thể chuyển sang dynamic `import()` bất đồng bộ**: Nếu chuyển các hàm trên thành asynchronous (`async/await`), toàn bộ các hàm lọc danh sách (`Array.prototype.filter`, `some`, `every`, `find`), các `useMemo`, và các handler React trên toàn bộ ứng dụng sẽ bị phá vỡ, hoặc gây ra lỗi sai lệch dữ liệu nghiêm trọng (false negatives: nhận diện `萧炎` và `蕭炎` là 2 từ khác nhau trước khi module nạp xong).
- **Chiến lược Chunking Hiện Tại Là Tối Ưu**: `vite.config.ts` đã cấu hình `manualChunks` tách riêng `vendor-opencc`. Điều này đảm bảo:
  - `vendor-react` (~219KB) và file entry chính `index.js` (~93KB) giữ được kích thước rất nhỏ gọn.
  - Trình duyệt tải song song các chunk độc lập và cache `vendor-opencc` dài hạn.
- **Minh Bạch Hóa Cấu Hình**: Cần bổ sung comment chi tiết ngay trong `vite.config.ts` giải thích rõ:
  1. Lý do `chunkSizeWarningLimit` đặt mức `1200` (để tránh cảnh báo giả cho chunk từ điển 1.12MB).
  2. Kiến trúc phân tách chunk `vendor-opencc` và tính chất đồng bộ bắt buộc của engine ngôn ngữ Hán-Việt.

---

## 3. Z-Index Ladder Audit

Đối chiếu với quy tắc `.agents/rules/design-system.md`:
- `z-10`: Nội bộ trong component
- `z-30`: Sticky Header (`App.tsx`), Tab bar (`App.tsx`)
- `z-40`: Dropdown menu / Tooltip
- `z-50`: Modal / Dialog overlay (`Modal.tsx`, `NotificationSystem.confirmModal`)
- `z-[60]`: Toast notification (`NotificationSystem.toastStack`)

### Phát hiện sai lệch:
- `src/components/common/LanguageSelector.tsx` dòng 49 đang sử dụng `z-50` cho menu dropdown `listbox`.
- **Hướng khắc phục**: Chuyển sang `z-40` để đúng chuẩn thang dropdown, không đè lên backdrop của modal (`z-50`).
