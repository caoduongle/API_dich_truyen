# Research: Tối Giản Xuất Tệp .TXT và Chuẩn Hóa Tên File Dễ Hiểu

**Feature**: `112-simplify-txt-export`  
**Date**: 2026-09-12  
**Status**: Completed  

---

## 1. Bối cảnh & Vấn đề Cần Giải Quyết

### 1.1. Hiện trạng đặt tên file xuất (.TXT)
- **Vấn đề**: Hiện tại trong [`src/hooks/useExportFiles.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useExportFiles.ts), tên file được tạo bằng công thức:
  ```ts
  const filename = `${cleanTitle}_[${startName}]_den_[${endName}]${suffix}.txt`;
  ```
  Trong đó `startName` và `endName` được lấy trực tiếp từ `sanitize(firstChapter.title)` và `sanitize(lastChapter.title)`.
  Vì `Chapter.title` khi nhập truyện vào hệ thống hầu như luôn là tiêu đề tiếng Trung gốc (ví dụ: `第一百二十一章_很有名`, `第一章_恐怖广播`), nên tên các tệp .TXT xuất ra hiển thị toàn chữ Hán:
  `Đài_Phát_Thanh_Kinh_Dị_[第一章_恐怖广播]_den_[第二十章_为什么]_WEB.txt`.
- **Hệ quả**:
  - Người dùng Việt Nam không thể phân biệt hoặc sắp xếp các tệp trên máy tính.
  - Tên file dễ bị quá dài hoặc lỗi hiển thị trên một số hệ điều hành khi chứa ký tự chữ Hán kèm ngoặc vuông `[...]`.
  - Khi gom 1 chương/file (`chaptersPerFile = 1`), tên file bị lặp vô nghĩa dạng `[Chương_1]_den_[Chương_1]`.

### 1.2. Hiện trạng giao diện bảng xuất tệp
- Bảng điều khiển [`ExportFilesPanel.tsx`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/auto-translator/ExportFilesPanel.tsx) chia 3 cột: "Web Truyện", "Làm Audio", "Gióng hàng FT".
- Tính năng "Gióng hàng FT" tạo file JSONL song ngữ để fine-tune AI, vốn là tính năng kỹ thuật nâng cao không phục vụ mục đích đọc hay xuất bản phổ thông của người dùng, khiến UI bị rối và chiếm dụng không gian.

---

## 2. Quyết định Kỹ thuật (Technical Decisions)

### 2.1. Quyết định Định dạng Tên File Xuất (Giải quyết Lựa chọn Q1: C)
- **Quyết định**: Áp dụng quy ước số thứ tự tiếng Việt chuẩn 3 chữ số với từ nối `_den_`:
  - **Trường hợp tệp gồm nhiều chương** ($N \ge 2$):
    `${cleanTitle}_Chuong_${pad3(startIndex)}_den_Chuong_${pad3(endIndex)}${suffix}.txt`
    *Ví dụ*: `Dai_Phat_Thanh_Kinh_Di_Chuong_001_den_Chuong_020_WEB.txt`
  - **Trường hợp tệp chỉ có 1 chương** ($N = 1$ hoặc $startIndex == endIndex$):
    `${cleanTitle}_Chuong_${pad3(chapterIndex)}${suffix}.txt`
    *Ví dụ*: `Dai_Phat_Thanh_Kinh_Di_Chuong_001_WEB.txt`
- **Đệm số (Padding)**: Sử dụng đệm 3 chữ số (`padStart(3, '0')`, ví dụ `001`, `020`, `150`) để các tệp luôn được Windows Explorer và macOS Finder sắp xếp theo đúng thứ tự tuyến tính khi xem theo tên tập tin.
- **Xác định chỉ số chương tuyệt đối**: Thay vì dùng chỉ số tương đối theo phân đoạn chunk (`chunkIdx * cap + idx + 1`), số thứ tự chương được tra cứu theo vị trí 1-indexed trong danh sách toàn bộ chương của dự án (`allChapters.findIndex(c => c.id === chap.id) + 1`). Điều này đảm bảo khi người dùng lọc xuất từ chương 21 đến chương 40, tên file sẽ hiển thị chính xác `Chuong_021_den_Chuong_040`.

### 2.2. Quyết định Loại bỏ Chế độ Gióng Hàng FT (Giải quyết Lựa chọn Q2: A)
- **Quyết định**: Dọn dẹp triệt để cả UI và mã nguồn xử lý xuất gióng hàng trong module xuất file:
  - Kiểu dữ liệu `ExportMode` được tinh gọn thành `'web' | 'audio'`.
  - `ExportFilesPanel.tsx` chuyển layout nút chế độ sang 2 cột (`grid-cols-2`), loại bỏ nút "Gióng hàng FT" và khối mô tả JSONL.
  - Loại bỏ prop `handleExportAlignJsonl` khỏi `ExportFilesPanelProps`.
  - Trong `useExportFiles.ts`, gỡ bỏ hàm `handleExportAlignJsonl` và dependency `alignChapterDirect`.
  - Nút xuất file luôn có nhãn "Bắt đầu xuất tải tệp .TXT sỉ" (hoặc "Đang xử lý kết xuất...").

### 2.3. Tách biệt Helper và Đảm bảo Kiểm thử (Clean Architecture)
- Tạo hàm helper chuyên trách `formatExportTxtFileName` trong [`src/utils/exportFormatter.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/exportFormatter.ts) để tách biệt hoàn toàn logic sinh tên file ra khỏi React Hook.
- Nhờ đó, logic sinh tên file có thể được kiểm thử tự động 100% bằng Vitest trong [`src/utils/__tests__/exportFormatter.test.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/__tests__/exportFormatter.test.ts).

---

## 3. Đánh giá Phương án Thay thế (Alternatives Considered)

| Phương án | Lý do không chọn |
|---|---|
| Giữ nguyên tên chương tiếng Trung | Người dùng không đọc hiểu được, không quản lý được thứ tự file. |
| Dùng tên chương tiếng Việt đã dịch | Tiêu đề chương tiếng Việt thường dài, có dấu và ký tự phong phú, dễ gây lỗi giới hạn độ dài đường dẫn trên Windows (MAX_PATH 260 ký tự) khi gom 2 chương vào tên file. |
| Chỉ ẩn nút UI nhưng giữ code xuất JSONL | Vi phạm nguyên tắc Clean Code và bảo trì; để lại dead code không sử dụng gây nhầm lẫn. |
