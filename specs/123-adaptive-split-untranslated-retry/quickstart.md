# Quickstart: Kiểm thử & Xác thực Tính năng Adaptive Split Retry cho UNTRANSLATED_CHINESE_LEFTOVER

**Feature**: `123-adaptive-split-untranslated-retry`  
**Date**: 2026-09-12  
**Status**: Ready for Implementation

Tài liệu này hướng dẫn cách chạy và xác thực các kịch bản kiểm thử đảm bảo tính năng cứu nguy phân đoạn thích ứng khi phát sinh lỗi `UNTRANSLATED_CHINESE_LEFTOVER` hoạt động chính xác.

---

## 1. Điều kiện tiên quyết (Prerequisites)

- Node.js >= 18.x
- Dependencies đã được cài đặt đầy đủ (`npm install`)
- Tham chiếu:
  - [data-model.md](./data-model.md)
  - [contracts/translation-engine.ts](./contracts/translation-engine.ts)

---

## 2. Kịch bản Kiểm thử Tự động (Automated Validation Scenarios)

### Kịch bản 1: Giai đoạn 1 (Dịch thô) tự động chia nhỏ khi gặp UNTRANSLATED_CHINESE_LEFTOVER

- **Mục tiêu**: Chứng minh `translateRawDirect` khi gặp lỗi `UNTRANSLATED_CHINESE_LEFTOVER` trên toàn bộ văn bản chương sẽ tự động chia đôi văn bản nguồn, gọi dịch lại từng phần thành công và ghép nối hoàn chỉnh mà không ném lỗi ra ngoài.
- **Lệnh thực thi**:
  ```bash
  npm test src/services/__tests__/directTranslationEngine.test.ts
  ```
- **Kỳ vọng**:
  - `callGeminiDirect` được gọi nhiều hơn 1 lần (1 lần thử toàn chương + các lần dịch phân đoạn con).
  - Kết quả trả về `rawTranslation` sạch chữ Hán (< 10%), bảo toàn tiêu đề chương.
  - Callback `onSplitRetry` được gọi với `{ stage: 'raw', depth: 0, partsCount: 2, ... }`.

### Kịch bản 2: Giai đoạn 2 (Chuốt văn phong) tự động kích hoạt chia nhỏ thích ứng khi chuốt văn sót chữ Hán

- **Mục tiêu**: Chứng minh `polishTranslationDirect` khi gặp `UNTRANSLATED_CHINESE_LEFTOVER` (thay vì chỉ rỗng/safety) sẽ kích hoạt `polishWithContentSplitDirect`, chia đồng bộ cả `sourceText` và `rawTranslation` thành các phần tương ứng.
- **Lệnh thực thi**:
  ```bash
  npm test src/services/__tests__/directTranslationEngine.test.ts
  ```
- **Kỳ vọng**:
  - Khi lượt gọi đầu tiên ném `UNTRANSLATED_CHINESE_LEFTOVER`, hệ thống không re-throw mà phân đoạn và chuốt lại từng cặp đoạn.
  - Kết quả cuối cùng ghép nối mượt mà, giữ trọn vẹn tiêu đề chương.

### Kịch bản 3: Tích hợp với dịch chương và tiến trình hàng loạt (`chapterTranslationService`)

- **Mục tiêu**: Xác minh trong luồng `executeChapterTranslation`, khi GĐ1 hoặc GĐ2 phát sinh lỗi sót chữ Hán, dịch vụ không bỏ qua chương mà ghi nhận nhật ký cảnh báo cứu nguy `[Cứu nguy GĐ1]` / `[Cứu nguy GĐ2]` qua `addLog`, và chương kết thúc ở trạng thái `completed`.
- **Lệnh thực thi**:
  ```bash
  npm test src/services/__tests__/chapterTranslationService.test.ts
  ```
- **Kỳ vọng**:
  - Test suite của `chapterTranslationService` hoàn thành 100% pass.
  - Không có exception nào làm gián đoạn tiến trình.

---

## 3. Lệnh Kiểm tra Toàn bộ Hệ thống (Gate Quality Verification)

Theo quy định bắt buộc của Hiến pháp dự án, chạy 3 lệnh kiểm soát chất lượng:

```bash
npm run lint    # Kiểm tra kiểu TypeScript (tsc --noEmit) - Phải sạch 0 lỗi
npm test        # Chạy toàn bộ 67+ test files (vitest run) - Phải pass 100%
npm run build   # Build gói sản phẩm (tsc && vite build) - Phải thành công
```
