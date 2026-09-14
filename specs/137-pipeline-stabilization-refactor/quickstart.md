# Quickstart Validation Guide: Ổn Định Hóa Pipeline Dịch Thuật & Tái Cấu Trúc (137-pipeline-stabilization-refactor)

**Date**: 2026-09-14  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Tài liệu này hướng dẫn chạy các kịch bản kiểm thử độc lập để xác minh tính ổn định và tính đúng đắn của toàn bộ các hạng mục P0, P1, P2.

---

## 1. Kiểm Tra Toàn Vẹn Ban Đầu (Baseline Check)

Trước khi thực hiện các thay đổi, bảo đảm toàn bộ hệ thống đang sạch lỗi:

```bash
npm run lint    # Kiểm tra TypeScript typecheck không lỗi
npm test        # Chạy toàn bộ test suite vitest
npm run build   # Kiểm tra đóng gói Vite bundle
```

---

## 2. Kịch Bản Kiểm Thử P0: Quota Tracker & PST Reset

### Kịch Bản 2.1: Tính Toán RPM từ Provider Attempt
- **Mục tiêu**: Xác minh `requestsThisMinute` (RPM) tăng ngay khi gọi `recordProviderAttempt`, không chờ `recordSuccess`.
- **Lệnh chạy**:
  ```bash
  npm test src/services/__tests__/localQuotaTracker.test.ts
  ```
- **Kỳ vọng**:
  - Ghi nhận 3 lần `recordProviderAttempt` với 2 lần lỗi 429 và 1 lần thành công → `getQuotaStatus()` trả về `requestsThisMinute: 3`.
  - `tokensThisMinute` chỉ phản ánh số lượng token của lần thành công duy nhất.

### Kịch Bản 2.2: Tính Toán Giờ Reset Chuẩn PST (America/Los_Angeles)
- **Mục tiêu**: Khi gặp lỗi `QuotaExhausted`, thời gian mở lại khóa khớp chính xác 00:00:00 PST ngày tiếp theo.
- **Kỳ vọng**:
  - Giả lập `now = 2026-09-14T10:00:00Z` (03:00 PDT): `cooldownUntil` là `2026-09-15T07:00:00Z` (00:00 PDT ngày 15/09).
  - Không còn hiện tượng cộng cứng 4 giờ (`now + 4 * 3600 * 1000`).

---

## 3. Kịch Bản Kiểm Thử P0: Phân Đoạn Song Ngữ & Concurrency Limiter

### Kịch Bản 3.1: Đồng Bộ Ranh Giới Đoạn Văn (`splitBilingualAdaptively`)
- **Mục tiêu**: Văn bản tiếng Trung và bản dịch thô tiếng Việt được chia thành các `TranslationChunk` khớp 1:1 theo chỉ số đoạn văn.
- **Lệnh chạy**:
  ```bash
  npm test src/services/translation/__tests__/bilingualSplit.test.ts
  ```
- **Kỳ vọng**:
  - Mỗi chunk chứa đoạn nguồn và đoạn thô tương ứng chính xác.
  - Không xảy ra hiện tượng đoạn văn bản nguồn ở chunk 1 nhưng bản thô lại nhảy sang chunk 2.

### Kịch Bản 3.2: Giới Hạn Tương Tranh Khi Phân Đoạn
- **Mục tiêu**: Không phát sinh burst requests vượt quá giới hạn đồng thời.
- **Kỳ vọng**:
  - Khi phân đoạn thành 4 chunks với `maxConcurrency = 2`, tại mọi thời điểm chỉ có tối đa 2 promise chạy đồng thời.

---

## 4. Kịch Bản Kiểm Thử P1: Tái Cấu Trúc Mô-đun

### Kịch Bản 4.1: Kiểm Thử Độc Lập Cho `GeminiClient`
- **Mục tiêu**: Các module `geminiRequestBuilder`, `geminiTransport`, `geminiErrorClassifier`, `geminiKeyScheduler` hoạt động đúng chức năng riêng biệt.
- **Lệnh chạy**:
  ```bash
  npm test src/services/gemini/__tests__/
  ```

### Kịch Bản 4.2: Tương Thích Ngược Tuyệt Đối
- **Mục tiêu**: Mọi bài test cũ gọi `callGeminiDirect` và `translateRawDirect`, `polishTranslationDirect` tiếp tục pass 100% không cần sửa đổi interface.
- **Lệnh chạy**:
  ```bash
  npm test src/services/__tests__/directGeminiClient.test.ts
  npm test src/services/__tests__/directTranslationEngine.test.ts
  ```

---

## 5. Kịch Bản Kiểm Thử P1: Lưu Trữ Cục Bộ & Đồng Bộ Đám Mây

### Kịch Bản 5.1: Minh Bạch Lỗi `StorageResult`
- **Mục tiêu**: Lỗi mở IndexedDB trả về `{ ok: false, error: ... }` thay vì nuốt lỗi trả về mảng rỗng `[]`.
- **Lệnh chạy**:
  ```bash
  npm test src/services/__tests__/db.test.ts
  ```

### Kịch Bản 5.2: Phòng Tránh Tạo Thư Mục Trùng Trên Drive
- **Mục tiêu**: Thao tác song song `ensureAppFolder()` sử dụng single-flight lock để chỉ tạo duy nhất 1 thư mục.

---

## 6. Kịch Bản Kiểm Thử P2: Bảo Mật Giao Diện & Script Đa Nền Tảng

### Kịch Bản 6.1: Khử Bỏ `dangerouslySetInnerHTML` Trong `DiffModal`
- **Lệnh chạy**:
  ```bash
  npm test src/components/auto-translator/__tests__/DiffModal.test.tsx
  ```
- **Kỳ vọng**: Kết xuất qua các React node an toàn, kiểm thử tiêm mã `<script>` hay `<img onerror>` không tạo ra lỗ hổng.

### Kịch Bản 6.2: Kiểm Tra Lệnh `npm run clean` Trên Windows
- **Lệnh chạy**:
  ```powershell
  npm run clean
  ```
- **Kỳ vọng**: Lệnh hoàn thành êm dịu, không báo lỗi lệnh shell không tìm thấy.
