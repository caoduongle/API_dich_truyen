# Quickstart Validation Guide: Cải tiến Xuất & Nhập File Cẩm Nang Từ Điển

**Feature**: `165-glossary-import-export-upgrade` | **Date**: 2026-11-22

## Prerequisites

- Node.js & npm đã cài đặt, dependencies đã đồng bộ (`npm ci` nếu cần).
- Dự án chạy thuần client-side SPA (`npm run dev`).

## Automated Verification

```bash
npm run lint
npm test
npm run build
```

Tất cả unit tests mới trong `src/services/__tests__/glossaryIO.test.ts` và các tests hiện có phải pass 100% không skip/mute.

## End-to-End Manual Validation Scenarios

1. **Xuất `.md` có cột Ngày thêm**:
   - Mở một dự án có cả từ mới (có `createdAt`) và từ cũ (không có `createdAt`).
   - Vào tab **Từ điển** -> bấm **Xuất từ điển** -> chọn định dạng Markdown (`.md`).
   - Mở tệp tải về: kiểm tra bảng có 5 cột (`Tiếng Trung | Phiên âm | Tiếng Việt | Ghi chú | Ngày thêm`), từ có ngày hiển thị `DD/MM/YYYY`, từ cũ hiển thị `—`.
2. **Xuất `.csv` và `.json`**:
   - Chọn xuất `.csv`: mở bằng Excel/Notepad kiểm tra UTF-8 BOM, hiển thị đúng tiếng Việt có dấu và cột `Ngày thêm`.
   - Chọn xuất `.json`: kiểm tra đầy đủ `createdAt` ISO, `variants`, `type`, `note`.
3. **Xuất theo bộ lọc**:
   - Lọc từ điển theo một loại (vd: `Nhân vật`) hoặc theo ngày -> chọn xuất phạm vi **Đang lọc** -> xác nhận số lượng trong tệp khớp danh sách đang lọc.
4. **Nhập trực tiếp ngoại tuyến & giữ nguyên Ngày thêm**:
   - Xóa bớt hoặc mở dự án khác, tắt/bỏ qua API key AI -> kéo-thả tệp `.md` (hoặc `.csv`/`.json`) vừa xuất vào hộp thoại **Nhập cẩm nang từ điển**.
   - Xác nhận hệ thống hiển thị chế độ **Đọc trực tiếp (không cần AI)**, thống kê chính xác số từ mới / trùng, và sau khi nhập **Ngày thêm** của các mục từ được giữ nguyên như trong tệp.
5. **Xử lý trùng lặp hàng loạt & fallback AI**:
   - Nhập tệp có mục trùng với từ điển hiện tại -> thử từng lựa chọn `Bỏ qua`, `Ghi đè`, `Rà soát trùng lặp`.
   - Nhập một tệp `.md` văn xuôi tự do (không có bảng) -> xác nhận hệ thống tự động dùng AI để trích xuất như trước đây.
