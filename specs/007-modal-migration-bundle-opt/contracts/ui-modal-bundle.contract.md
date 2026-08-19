# Interface Contract: UI Modals & Vite Build Configuration

**Feature**: `007-modal-migration-bundle-opt`  
**Created**: 2026-08-19  

---

## 1. Modal Component Contract

### Invariants:
1. Mọi dialog overlay trong ứng dụng PHẢI bọc bên ngoài bằng component `<Modal>`.
2. Khi `open === true`:
   - Phím `Escape` kích hoạt `onClose()`.
   - Click bên ngoài khung dialog vào vùng backdrop kích hoạt `onClose()`.
   - `document.body.style.overflow` được gán thành `'hidden'` và tự động phục hồi khi `open === false` hoặc component unmount.
   - Thao tác phím `Tab` và `Shift+Tab` bị bẫy (trap) bên trong các phần tử tương tác của dialog.
3. Cấu trúc thị giác tuân thủ bảng màu "Mực & Chu Sa":
   - Nền dialog: `bg-parchment`
   - Viền dialog: `border border-parchment-2`
   - Bo góc: `rounded-md`
   - Tiêu đề: font `font-display`, kích thước `text-sm font-bold text-text-main`
   - Nút đóng: Icon `X` với `aria-label="Đóng"`

---

## 2. Vite Build & Manual Chunks Contract

### Invariants:
1. `vite.config.ts` phân tách các manual chunks độc lập:
   - `vendor-react`: `react`, `react-dom`, `scheduler`
   - `vendor-motion`: `motion`
   - `vendor-opencc`: `opencc-js`
   - `vendor-jszip`: `jszip`
   - `vendor-icons`: `lucide-react`
2. `chunkSizeWarningLimit` được đặt ở `1200` kèm theo khối chú thích kỹ thuật (JSDoc/comment) giải thích nguyên nhân do chunk từ điển chữ Hán `vendor-opencc`.
3. Không làm tăng kích thước bundle của `vendor-react` hay `index.js`.
