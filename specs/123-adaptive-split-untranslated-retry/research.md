# Research: Adaptive Content Split Retry for UNTRANSLATED_CHINESE_LEFTOVER

**Feature**: `123-adaptive-split-untranslated-retry`  
**Date**: 2026-09-12  
**Status**: Completed

## Overview

Tính năng này giải quyết vấn đề khi mô hình Gemini API trả về văn bản chưa dịch hoặc "nhại lại" văn bản gốc tiếng Trung (> 10% ký tự Hán), kích hoạt lỗi `UNTRANSLATED_CHINESE_LEFTOVER` từ hàm `validateTranslationOutput(text)`. Hiện tại, lỗi này khiến chương bị bỏ qua (`skipFailedChapters`) hoặc làm ngắt tiến trình dịch. Bằng cách áp dụng cơ chế chia nhỏ thích ứng (Adaptive Content Split / Divide & Conquer) cho cả Giai đoạn 1 (Dịch thô) và Giai đoạn 2 (Chuốt văn), hệ thống tự động phục hồi các chương lỗi và hoàn thành bản dịch sạch chữ Hán mà không cần sự can thiệp của người dùng.

---

## Technical Decisions & Trade-offs

### Decision 1: Hợp nhất tiêu chí phân loại lỗi cứu nguy (`isAdaptiveSplitRetryableError`)

- **Decision**: Mở rộng và chuẩn hóa hàm phân loại lỗi `isAdaptiveSplitRetryableError(err: any): boolean` trong `src/services/directTranslationEngine.ts` để nhận diện cả 3 nhóm lỗi cứu nguy:
  1. Lỗi bộ lọc an toàn (`bộ lọc an toàn`, `SAFETY`).
  2. Lỗi phản hồi rỗng (`phản hồi rỗng`, `kết quả trả về trống`).
  3. Lỗi sót chữ Hán chưa dịch (`UNTRANSLATED_CHINESE_LEFTOVER`).
- **Rationale**: Hiện tại `isSafetyOrEmptyErrorDirect` chỉ bắt lỗi an toàn và rỗng, hoàn toàn bỏ qua `UNTRANSLATED_CHINESE_LEFTOVER`. Việc chuẩn hóa thành `isAdaptiveSplitRetryableError` giúp tái sử dụng logic phân loại lỗi thống nhất cho cả GĐ1 và GĐ2, tránh bỏ sót trường hợp ngoại lệ.
- **Alternatives considered**:
  - *Chỉ sửa trong GĐ2*: Bị từ chối vì GĐ1 là nơi phát sinh lỗi thô đầu tiên; nếu GĐ1 thất bại thì chương bị bỏ qua trước khi tới GĐ2.
  - *Bắt lỗi riêng biệt ở từng hàm*: Bị từ chối vì trùng lặp code kiểm tra chuỗi (string matching) và khó bảo trì khi có thêm mã lỗi mới.

---

### Decision 2: Kiến trúc phân đoạn thích ứng đệ quy cho Giai đoạn 1 (`translateRawWithContentSplitDirect`)

- **Decision**: Tái cấu trúc `translateRawDirect` để bọc lệnh gọi `callRawDirectCore` trong hàm đệ quy `rawWithContentSplitDirect` tương tự như `polishWithContentSplitDirect` của GĐ2:
  - Cấp độ sâu phân đoạn tối đa: `depth = 2` (tối đa 4–6 phân đoạn con).
  - Phân tách văn bản: `splitTextAdaptively(text, partsCount)` với `partsCount = depth >= 1 ? 3 : 2`.
  - Tái tạo kết quả: Ghép nối các phân đoạn dịch thô thành công bằng `\n\n`, đồng thời gộp các `discoveredEntities` đã trích xuất và bảo toàn tiêu đề chương qua `separateChapterTitleAndBody`.
  - Xử lý khi chạm trần `depth >= 2`: Ném lỗi chẩn đoán chi tiết rõ ràng, tuyệt đối không trả về văn bản tiếng Trung thô chưa dịch vào database.
- **Rationale**: GĐ1 không có bản dịch dự phòng (khác với GĐ2 đã có bản thô). Do đó, nếu AI từ chối dịch một đoạn văn bản sau khi đã chia nhỏ đến độ sâu tối đa, hệ thống phải dừng lại phân đoạn đó một cách an toàn và có kiểm soát, bảo vệ tính toàn vẹn của dữ liệu theo Nguyên tắc I của Hiến pháp.
- **Alternatives considered**:
  - *Bỏ qua đoạn văn bị lỗi và lưu đoạn tiếng Trung*: Bị từ chối vì vi phạm nghiêm trọng tính toàn vẹn của bản dịch.
  - *Chia nhỏ trước (pre-split) toàn bộ mọi chương*: Bị từ chối vì làm tăng gấp đôi số lượng request API không cần thiết đối với 95% chương dịch bình thường.

---

### Decision 3: Chiến lược thực thi các phân đoạn con: Tuần tự vs Song song

- **Decision**:
  - **Giai đoạn 1 (Dịch thô)**: Thực thi tuần tự qua vòng lặp `for (let i = 0; i < chunks.length; i++)` kết hợp xoay vòng `staggeredKeyIndex = (currentKeyIdx + i) % apiKeys.length`.
  - **Giai đoạn 2 (Chuốt văn)**: Tiếp tục duy trì `Promise.all` với so le key index `(startKeyIndex + index) % apiKeys.length` như hiện tại, có bọc bắt lỗi từng phần để fallback về bản thô nếu phân đoạn chuốt con bị lỗi.
- **Rationale**:
  - GĐ1 cần gom dồn và chuyển giao `successKeyIndex` tuần tự giữa các đoạn văn bản để tránh nghẽn RPM/TPM của Gemini API đối với người dùng sử dụng key miễn phí, đồng thời hỗ trợ trích xuất thực thể từ điển gối đầu mượt mà.
  - GĐ2 hoạt động độc lập trên các cặp đoạn (source part & raw part) đã có sẵn bản thô làm mốc dự phòng, nên xử lý song song giúp rút ngắn thời gian chuốt văn đáng kể.
- **Alternatives considered**:
  - *Dùng `Promise.all` cho cả GĐ1*: Bị từ chối vì có thể gây bùng nổ request đồng thời khi chia nhỏ nhiều cấp, dễ gây lỗi 429 RESOURCE_EXHAUSTED trên các API key đơn lẻ.

---

### Decision 4: Cơ chế phát tín hiệu chẩn đoán thời gian thực (`onSplitRetry`)

- **Decision**: Bổ sung trường tùy chọn `onSplitRetry` vào cả `DirectRawTranslationParams` và `DirectPolishTranslationParams`:
  ```typescript
  export interface SplitRetryEventInfo {
    stage: 'raw' | 'polish';
    depth: number;
    partsCount: number;
    reason: string;
  }
  ```
  Trong `chapterTranslationService.ts`, truyền callback này để đẩy thông báo vào `addLog`:
  `[Cứu nguy GĐ1/GĐ2] Phát hiện lỗi sót chữ Hán (...). Tự động kích hoạt phân đoạn thích ứng cấp N (chia M phần)...`
- **Rationale**:
  - Tuân thủ nghiêm ngặt Nguyên tắc III của Hiến pháp (phân tách MVC): `directTranslationEngine.ts` là Model/Service thuần túy, không được import component hoặc hook của View. Truyền callback giúp tầng Engine thông báo sự kiện mà không bị dính líu đến UI.
  - Đáp ứng trực tiếp yêu cầu FR-009 và SC-005: hiển thị thông báo thời gian thực < 1s cho người dùng khi xảy ra cứu nguy phân đoạn.
- **Alternatives considered**:
  - *Console.log trong engine*: Người dùng không nhìn thấy trong Activity Log của ứng dụng.
  - *Import hook/state vào engine*: Vi phạm Hiến pháp kiến trúc của dự án.

---

## Summary of Resolved Clarifications

| Yêu cầu | Phương án giải quyết |
|---|---|
| **Cách xử lý GĐ1 khi chạm trần depth 2** | Ném lỗi chẩn đoán rõ ràng, dừng phân đoạn thay vì trả về chữ Hán gốc |
| **Cách xử lý GĐ2 khi chạm trần depth 2** | Fallback về bản dịch thô hợp lệ của đoạn đó từ GĐ1 (`isPartial: true`) |
| **Phân tách đoạn văn bản** | Tái sử dụng `splitTextAdaptively` sẵn có (cắt theo `\n\n`, `\n` hoặc câu/từ tự nhiên) |
| **Độ sâu đệ quy tối đa** | Giới hạn `depth < 2` (tương đương 2 cấp, chia 2 hoặc 3 phần) |
| **Thông tin phản hồi người dùng** | Ghi log thời gian thực qua callback `onSplitRetry` hiển thị trên thanh tiến trình |
