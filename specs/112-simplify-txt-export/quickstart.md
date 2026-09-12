# Quickstart: Kiểm Thử Tính Năng Xuất File Tối Giản

**Feature**: `112-simplify-txt-export`  
**Date**: 2026-09-12  

---

## 1. Kiểm Thử Tự Động (Automated Testing)

Chạy bộ unit test để kiểm tra logic sinh tên file và component xuất tệp:
```bash
npm test src/utils/__tests__/exportFormatter.test.ts
npm test src/hooks/__tests__/useExportFiles.test.ts
```

Chạy toàn bộ cổng kiểm tra chất lượng của dự án:
```bash
npm run lint    # Kiểm tra TypeScript type safety
npm test        # Chạy toàn bộ vitest suite
npm run build   # Kiểm tra build bundle Vite production
```

---

## 2. Kịch Bản Kiểm Thử Thủ Công (Manual Scenarios)

### Kịch bản 1: Giao diện bảng xuất tệp (ExportFilesPanel)
1. Mở ứng dụng (`npm run dev`).
2. Mở một dự án truyện có sẵn chương.
3. Kéo xuống mục "Sản xuất tập tin kết quả sau dịch".
4. **Kỳ vọng**:
   - Thanh chọn chế độ xuất chỉ có 2 nút: "Web Truyện" và "Làm Audio" (chia đều 2 cột).
   - Nút "Gióng hàng FT" và khối text mô tả JSONL đã biến mất.
   - Nút hành động chính có nhãn "Bắt đầu xuất tải tệp .TXT sỉ".

### Kịch bản 2: Xuất tệp gom nhiều chương
1. Thiết lập gom 10 chương/file.
2. Chọn chế độ "Web Truyện".
3. Bấm "Bắt đầu xuất tải tệp .TXT sỉ".
4. Mở tệp `.zip` tải về.
5. **Kỳ vọng**:
   - Tên các file trong zip có dạng: `{Tên_truyện}_Chuong_001_den_Chuong_010_WEB.txt`, `{Tên_truyện}_Chuong_011_den_Chuong_020_WEB.txt`...
   - Tuyệt đối không chứa chữ Hán trong tên file.

### Kịch bản 3: Xuất tệp đơn lẻ (1 chương/file)
1. Kéo slider hoặc nhập gom 1 chương/file.
2. Bấm "Bắt đầu xuất tải tệp .TXT sỉ".
3. Mở tệp `.zip` tải về.
4. **Kỳ vọng**:
   - Tên các file có dạng `{Tên_truyện}_Chuong_001_WEB.txt`, `{Tên_truyện}_Chuong_002_WEB.txt`... (không có `_den_`).

### Kịch bản 4: Giới hạn phạm vi chương
1. Bật toggle "Giới hạn phạm vi chương xuất".
2. Chọn "Từ số 21" đến "Đến số 35".
3. Xuất file và kiểm tra tên các file .TXT tạo ra.
4. **Kỳ vọng**:
   - Số thứ tự bắt đầu từ `021`, ví dụ `Chuong_021_den_Chuong_030_WEB.txt`.
