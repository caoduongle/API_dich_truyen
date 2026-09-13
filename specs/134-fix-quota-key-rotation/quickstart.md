# Quickstart & Validation Guide: Sửa Cơ Chế Xoay Vòng API Key Khi Chạm Quota & Tránh Kẹt Khóa Lỗi

**Feature**: `134-fix-quota-key-rotation`  
**Date**: 2026-09-13  
**Status**: Ready  

---

## 1. Mục Tiêu Kiểm Thử

Hướng dẫn này mô tả các kịch bản kiểm thử độc lập từ đầu đến cuối (End-to-End & Unit Tests) nhằm chứng minh lỗi kẹt con trỏ khóa #7 và lỗi nuốt mã `ALL_KEYS_EXHAUSTED` đã được khắc phục hoàn toàn.

---

## 2. Kịch Bản Kiểm Thử Tự Động (Automated Test Scenarios)

### Kịch bản 1: Con trỏ API Key tự động xoay tua qua từng chương khi thành công
- **File test**: `src/hooks/__tests__/useTranslationProcess.test.ts`
- **Mục đích**: Đảm bảo với 3 khóa API [Key1, Key2, Key3], Chương 1 dùng Key1 thành công, Chương 2 tự động chuyển sang Key2, Chương 3 tự động chuyển sang Key3.
- **Lệnh chạy**:
  ```bash
  npx vitest run src/hooks/__tests__/useTranslationProcess.test.ts
  ```

### Kịch bản 2: Con trỏ API Key tự động bỏ qua khóa lỗi sang khóa kế tiếp khi thất bại
- **File test**: `src/hooks/__tests__/useTranslationProcess.test.ts`
- **Mục đích**: Giả lập Chương 1 chạy với Key1 gặp lỗi 429 (hết quota), Chương 2 không được dùng lại Key1 mà phải bắt đầu bằng Key2.
- **Kỳ vọng**:
  - Chương 2 log: `Key xoay vòng: #2` (hoặc khóa khả dụng tiếp theo).
  - Không có hiện tượng 17 chương đều log `Key xoay vòng: #7`.

### Kịch bản 3: Bảo toàn mã lỗi `ALL_KEYS_EXHAUSTED` trong `chapterTranslationService`
- **File test**: `src/services/__tests__/chapterTranslationService.test.ts`
- **Mục đích**: Khi `translateRawDirect` ném ra lỗi có `code: 'ALL_KEYS_EXHAUSTED'`, ngoại lệ được ném ra từ `executeSingleChapterTranslation` MUST có `err.code === 'ALL_KEYS_EXHAUSTED'`.
- **Lệnh chạy**:
  ```bash
  npx vitest run src/services/__tests__/chapterTranslationService.test.ts
  ```

### Kịch bản 4: Dừng khẩn cấp toàn bộ tiến trình khi cạn kiệt toàn bộ khóa
- **File test**: `src/hooks/__tests__/useTranslationProcess.test.ts`
- **Mục đích**: Cung cấp hàng đợi 5 chương. Giả lập `translateSingleChapter` ném lỗi `ALL_KEYS_EXHAUSTED` tại Chương 1.
- **Kỳ vọng**:
  - Vòng lặp dừng ngay lập tức tại Chương 1 (`isProcessing === false`).
  - Chương 2..5 KHÔNG bị gọi.
  - Log hiển thị đúng: `"DỪNG KHẨN CẤP: Toàn bộ API Key đã chạm hạn mức..."`.
  - Không xuất hiện 4 dòng `"⚡ Chương ... lỗi tạm thời do model quá tải"`.

### Kịch bản 5: Khởi tạo khóa khả dụng lành mạnh khi gọi `handleRetryFailedChapters`
- **File test**: `src/hooks/__tests__/useTranslationProcess.test.ts`
- **Mục đích**: Giả lập `currentApiKeyIndexRef.current = 6` (Khóa 7 đang QuotaExhausted). Gọi `handleRetryFailedChapters`.
- **Kỳ vọng**: Con trỏ chuyển sang Khóa 8 hoặc Khóa 1 (khóa còn khỏe mạnh) thay vì giữ nguyên Khóa 7.

---

## 3. Lệnh Kiểm Tra Chất Lượng Toàn Diện (Hiến Pháp Dự Án)

```bash
npm run lint    # Kiểm tra TypeScript typecheck nghiêm ngặt
npm test        # Chạy toàn bộ test suite vitest
npm run build   # Đảm bảo bản build production sạch sẽ
```
