# Quickstart Validation Guide: Feature 167

**Feature**: `specs/167-translation-guidelines-style-upgrade`  
**Date**: 2026-11-27

Tài liệu này mô tả các bước kiểm chứng tự động và thủ công sau khi triển khai Feature 167 để chứng minh tính năng hoạt động đúng đặc tả (`US1`–`US4`, `FR-001`–`FR-014`, `SC-001`–`SC-006`).

---

## 1. Quality Gates Bắt Buộc (Baseline Commands)

Chạy từ thư mục gốc repository trên PowerShell:

```powershell
npm run lint
npm test
npm run build
```

Tất cả 3 lệnh bắt buộc trả về exit code `0`, không xóa hoặc skip assertion cũ.

---

## 2. Targeted Unit & Integration Test Suites

Kiểm tra nhanh từng nhóm module liên quan trong quá trình phát triển:

```powershell
npx vitest run src/config/__tests__/translationStyles.test.ts
npx vitest run src/lib/__tests__/text.test.ts
npx vitest run src/services/ai/__tests__/prompts.test.ts
npx vitest run src/services/__tests__/directGlossaryEngine.test.ts
npx vitest run src/services/translation/__tests__/targetedRepair.test.ts
```

**Kịch bản bắt buộc phải được phủ bởi unit test**:
1. Toàn bộ 17 thể loại dựng sẵn và 11 tông giọng dựng sẵn đều có `styleGuide` khác rỗng và phân biệt rõ ràng (`translationStyles.test.ts`).
2. `detectStyleConflicts` phát hiện chính xác xung đột (ví dụ `Đô Thị` + `Trang nghiêm cổ phong`, hoặc lệnh cấm Hán-Việt + tông `Trang nghiêm cổ phong`) và không báo giả với các cặp hợp lệ.
3. `parseStructuredGuidelines` ⇄ `serializeStructuredGuidelines` và `formatGuidelinesMarkdownExport` ⇄ `parseGuidelinesMarkdownLocal` bảo toàn 100% nội dung (kể cả ghi chú cũ không theo heading).
4. `extractGuidelinesProseSection` lọc sạch bảng từ điển Markdown lớn mà vẫn giữ nguyên các đoạn quy tắc nằm ở cuối tệp dài > 15.000 ký tự; `analyzeGuidelinesDirect` giữ được phần quy tắc đó và rơi về `local_fallback` khi không có API key.
5. `prompts.ts` và `targetedRepair.ts` đều chứa đầy đủ `getGenreStyleGuide`, `getToneStyleGuide`, thứ tự ưu tiên `#2 Quy tắc riêng > #3 Tông giọng > #4 Thể loại`, và giữ nguyên ràng buộc cấu trúc 1-1.

---

## 3. Manual / Browser Verification Checklist

Khởi động dev server (`npm run dev`) và kiểm tra trực tiếp trên trình duyệt:

1. **Đồng nhất tạo mới & chỉnh sửa dự án (`SC-001`, `FR-001`, `FR-003`)**:
   - Mở hộp thoại tạo truyện mới (`Tạo truyện mới`) và hộp thoại thông tin dự án trong workspace (`Thông tin truyện`).
   - Xác nhận danh sách Thể loại chính (17 thể loại + Khác/tự nhập) và Tông giọng biên tập (11 tông + tự nhập) giống hệt nhau; chọn "Khác / Tự nhập" và lưu với giá trị hợp lệ; thử để trống giá trị tùy chỉnh để xác nhận cảnh báo lỗi chặn lưu rỗng.
2. **Mẫu khởi tạo & Soạn thảo có cấu trúc (`SC-003`, `FR-006`, `FR-007`)**:
   - Chọn thể loại bất kỳ (ví dụ `Cung Đấu / Gia Đấu`), bấm chèn mẫu khởi tạo → kiểm tra 5 mục được điền rõ ràng và thời gian thao tác nhanh chóng.
   - Bấm chèn lại khi ô đang có chữ → xác nhận hiện tùy chọn hỏi thay thế hay chèn bổ sung (không âm thầm xóa chữ người dùng).
   - Chuyển đổi qua lại giữa chế độ Có cấu trúc và Markdown thô để xác nhận đồng bộ 2 chiều.
3. **Nhập tệp cẩm nang dài > 15.000 ký tự & Xem trước (`SC-004`, `FR-008`, `FR-009`, `FR-010`)**:
   - Tạo/tải tệp `.md` mẫu có bảng thuật ngữ dài ở đầu và quy tắc xưng hô ở cuối (> 15.000 ký tự).
   - Thử nhập ở cả màn hình tạo dự án lẫn màn hình chỉnh sửa dự án trong workspace → kiểm tra khung Xem trước hiện đủ Thể loại, Tông giọng, Quy tắc cuối tệp, Số lượng thuật ngữ, cho chọn Áp dụng / Hợp nhất / Giữ nguyên.
4. **Xuất cẩm nang & Cảnh báo mâu thuẫn (`FR-011`, `FR-012`)**:
   - Chọn cặp `Đô Thị` + `Trang nghiêm cổ phong` → xác nhận banner cảnh báo màu amber hiện ra với nút gợi ý chuyển nhanh, và vẫn cho phép bấm Lưu nếu muốn giữ nguyên.
   - Bấm Xuất Cẩm Nang `.md` → kiểm tra tệp tải về chứa đủ Thể loại, Tông giọng và các mục quy tắc.
5. **Tương thích ngược dự án cũ (`SC-006`, `FR-014`)**:
   - Mở một dự án có dữ liệu cũ (ví dụ `tone: "Trang nghiêm cổ kính"` hoặc `description` là ghi chú tự do không heading) → xác nhận không lỗi, hiển thị nguyên vẹn và có thể lưu/dịch tiếp bình thường.
