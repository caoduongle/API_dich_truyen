# Quickstart & Validation Guide: Fix Iterative Polish Cache Bypass

**Feature**: `111-fix-iterative-polish-cache`  
**Date**: 2026-09-12

## 1. Prerequisites

- Mã nguồn đã cài đặt dependencies: `npm install`
- Node.js >= 18
- Trình duyệt hiện đại (Chrome / Edge) có cấu hình ít nhất 1 Gemini API Key hợp lệ trong Cấu hình AI

---

## 2. Automated Test Commands

Chạy bộ kiểm thử tự động cho các hàm thuật toán mới và các engine dịch thuật:

```bash
# Kiểm tra Type checking nghiêm ngặt
npm run lint

# Chạy unit tests cho hàm tính toán tương đồng và chiến lược phân tầng
npx vitest run src/lib/__tests__/text.test.ts

# Chạy unit tests cho engine chuốt văn và pipeline dịch thuật
npx vitest run src/services/__tests__/directTranslationEngine.test.ts
npx vitest run src/services/__tests__/chapterTranslationService.test.ts

# Chạy unit tests cho engine phân tích từ điển và hook quét thuật ngữ
npx vitest run src/services/__tests__/directGlossaryEngine.test.ts
npx vitest run src/hooks/__tests__/useGlossaryScan.test.ts

# Toàn bộ test suite phải vượt qua 100%
npm test

# Build production bundle
npm run build
```

---

## 3. Manual Validation Scenarios

### Scenario 1: Chuốt văn học 3 vòng (Multi-cycle Polish)
1. Mở giao diện **Dịch tự động** (`AutoTranslator`).
2. Chọn số vòng chuốt: **3 vòng** (`polishCycles = 3`).
3. Nhập 1 chương truyện chữ tiếng Trung mẫu (~1000 - 2000 ký tự).
4. Bấm **Bắt đầu dịch**.
5. **Kỳ vọng quan sát**:
   - Vòng 1: Log hiển thị `Biên tập chuốt chữ trực tiếp Lượt 1/3 [Cơ bản]...` với nhãn `[BẢN DỊCH THÔ BAN ĐẦU]`.
   - Vòng 2: Log hiển thị `Biên tập chuốt chữ trực tiếp Lượt 2/3 [Nhịp điệu]...` với nhãn `[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 1]` và thông tin diff (ví dụ: `Thay đổi 8.5% từ vựng/câu cú`).
   - Vòng 3: Log hiển thị `Biên tập chuốt chữ trực tiếp Lượt 3/3 [Nhân vật & Chi tiết]...`.
   - Bản dịch cuối cùng có chất lượng văn phong mượt mà rõ rệt qua từng giai đoạn, không bị tình trạng câu chữ bị lặp y nguyên như vòng 1.

### Scenario 2: Kiểm tra dừng sớm khi hội tụ (Convergence Detection)
1. Thử nghiệm với đoạn văn ngắn (< 300 từ) hoặc chọn 5 vòng chuốt.
2. Nếu tại Vòng 3, Gemini trả về bản dịch gần như giống hệt Vòng 2 (độ tương đồng $\ge 96\%$):
3. **Kỳ vọng quan sát**:
   - Log hệ thống thông báo: `[Hội tụ] Bản dịch đã đạt độ hoàn thiện tối ưu tại Lượt 3/5 (Độ tương đồng 97.2%). Tự động dừng sớm để tiết kiệm hạn mức API.`
   - Hệ thống không gọi tiếp Vòng 4 và Vòng 5, chuyển sang giai đoạn kế tiếp ngay lập tức.

### Scenario 3: Quét thuật ngữ 2-3 vòng lặp (Multi-loop Glossary Scan)
1. Mở tab **Rà soát từ điển** trong Dịch tự động.
2. Chọn số vòng quét: **2 vòng** (`extractionLoops = 2`).
3. Bấm **Quét thuật ngữ**.
4. **Kỳ vọng quan sát**:
   - Vòng 1: Trích xuất các thực thể chính (nhân vật chính, môn phái lớn).
   - Vòng 2: Log hiển thị `[Vòng 2/2] Quét sâu tìm thuật ngữ bị sót... (Bỏ qua N từ đã phát hiện)`.
   - Vòng 2 phát hiện thêm các danh từ riêng phụ, địa danh nhỏ hoặc chiêu thức ẩn bị bỏ sót ở vòng 1.

### Scenario 4: Chuốt tiếp trong Trình soạn thảo đơn chương (`handlePolishTranslation`)
1. Trong màn hình **Không gian dịch thuật** (`TranslatorWorkspace`), mở một chương đã có bản dịch thô.
2. Bấm **Chuốt văn thuần Việt** lần 1 → Nhận bản chuốt 1.
3. Bấm **Chuốt văn thuần Việt** lần 2.
4. **Kỳ vọng quan sát**: Hệ thống chuốt tiếp dựa trên văn bản đã chuốt của lần 1, không quay trở lại bản dịch thô sơ khai ban đầu.
