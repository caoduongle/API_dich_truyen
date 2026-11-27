# Quickstart & Validation Guide: Cải Tiến Từ Điển Để Cải Thiện Chất Lượng Dịch

**Feature**: `169-glossary-translation-quality` | **Date**: 2026-11-27

## Prerequisites
- Node.js & npm đã cài đặt sẵn dependencies (`package-lock.json` đồng bộ).
- Làm việc tại thư mục gốc repository trên nhánh/working tree hiện tại (`specs/169-glossary-translation-quality`).
- Đối chiếu thiết kế chi tiết tại:
  - [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/169-glossary-translation-quality/data-model.md)
  - [glossary-quality-contracts.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/169-glossary-translation-quality/contracts/glossary-quality-contracts.md)

## Automated Quality Gates (Bắt buộc)

Chạy kiểm tra cục bộ đầy đủ sau khi triển khai (PowerShell):

```powershell
npm run lint
npm test
npm run build
```

## Targeted Test Verification

Chạy riêng các bộ test liên quan trong quá trình phát triển:

```powershell
npx vitest run src/lib/__tests__/glossaryMatch.test.ts src/services/ai/__tests__/prompts.test.ts src/services/translation/__tests__/translationValidation.test.ts src/services/__tests__/glossaryIO.test.ts src/hooks/__tests__/useGlossaryScan.test.ts src/components/__tests__/GlossaryManager.test.ts
```

## End-to-End Validation Scenarios

1. **US1 — Ngữ cảnh đầy đủ & đồng nhất qua cả 3 pha (Raw/Polish/QA)**:
   - Tạo từ điển có nhân vật kèm `note` chi tiết, `variants` và `characterProfile`, cùng 2 mục trùng nghĩa gốc khác ưu tiên.
   - Kiểm tra payload từ `buildRawTranslationPayload`, `buildPolishTranslationPayload` và `buildQaCritiquePayload`: cả 3 đều có đủ `note`, `variants`, `characterProfile`, nhóm theo vai trò và cùng chọn đúng mục thắng cuộc.
2. **US2 — Khớp cụm dài nhất & không báo lỗi giả**:
   - Đưa đoạn gốc có `"张三丰出手了"` với từ điển gồm `"张三丰" -> "Trương Tam Phong"` và `"三丰" -> "Tam Phong"`.
   - Kiểm tra `checkGlossaryCompliance` trả về `0` lỗi khi bản dịch viết `"Trương Tam Phong ra tay."`, nhưng vẫn phát hiện lỗi nếu `"三丰"` xuất hiện độc lập ngoài `"张三丰"` mà bị dịch sai.
3. **US3 — Ưu tiên loại trừ theo chương, lọc nhiễu & gợi ý giới tính**:
   - Quét chương với từ điển 400 mục trong đó các mục khớp chương nằm cuối mảng: xác nhận chúng nằm trong danh sách loại trừ gửi AI.
   - Trích xuất nhân vật mới có ghi chú giới tính rõ ràng cùng 1 đại từ rác (`"他们"`): rác bị chặn, nhân vật mới được gắn `characterProfile.gender`, nhân vật đã ghim/sửa tay giữ nguyên hồ sơ cũ.
4. **US4 — Chẩn đoán Sức khỏe từ điển**:
   - Mở tab Từ điển với tập mẫu chứa cặp xung đột Giản/Phồn thể, nhân vật thiếu giới tính và mục thiếu nghĩa Việt.
   - Kiểm tra `GlossaryHealthBar` hiển thị đúng bộ đếm và bấm từng pill lọc đúng danh sách tương ứng.
5. **US5 — Thao tác hàng loạt & Nhập tệp 2 chế độ (`Chỉ thêm` vs `Thay toàn bộ`)**:
   - Chọn nhiều mục trong bảng từ điển (từng dòng, cả trang, toàn bộ lọc) và thử cả 4 nút: Ghim/Bỏ ghim, Đổi phân loại, Gán giới tính nhân vật (trên tập chọn hỗn hợp), và Xóa hàng loạt (có hộp thoại xác nhận).
   - Mở hộp thoại Nhập file cẩm nang, kiểm tra chế độ **Chỉ thêm thuật ngữ** vs **Thay toàn bộ thuật ngữ** (xác nhận cảnh báo số mục cũ, giữ nguyên hàng chờ kiểm duyệt, chặn thay thế nếu tệp không có mục hợp lệ).
