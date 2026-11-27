# Quickstart & Validation Guide: Feature 172

**Feature**: `172-rpm-cooldown-split-guard` | **Date**: 2026-11-28

Tài liệu này mô tả các bước kiểm chứng end-to-end cho Feature 172 sau khi triển khai, đối chiếu trực tiếp với `SC-001`–`SC-007` trong [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/spec.md), [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/data-model.md) và [rate-limit-guard.contract.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/172-rpm-cooldown-split-guard/contracts/rate-limit-guard.contract.md).

## 1. Quality Gates Bắt Buộc

Chạy toàn bộ 3 lệnh baseline từ thư mục gốc repository:

```powershell
npm run lint
npm test
npm run build
```

Mọi kiểm tra phải thoát với mã `0`, không có test bị skip hoặc nới lỏng assertion.

## 2. Ma Trận Kịch Bản Xác Minh (`SC-001` – `SC-007`)

| Tiêu chí | Kịch bản kiểm chứng | Kết quả kỳ vọng |
|---|---|---|
| **SC-001** | Mô phỏng lỗi `429 RATE_LIMIT_RPM` và `503 SERVICE_OVERLOAD` tại GĐ1, GĐ2, GĐ3 và bên trong nhánh con của `rawWithContentSplitDirect` | `classifyTranslationOutcome` trả về `canSplitRetry: false`; hệ thống tự chờ hồi phục rồi thử lại đúng bước (0 lần chia nhỏ `2→4→8→16`, 0 lần gọi `sino-fallback`) |
| **SC-002** | Kiểm tra `onSplitRetry` và log chờ hồi phục cho từng loại sự cố (`429`, `503`, `ETIMEDOUT`, `EMPTY_RESPONSE`, `CONTENT_BLOCKED`, `PARAGRAPH_STRUCTURE_DIVERGENCE`, `POLISH_TRUNCATION_DETECTED`) | 0% dòng log gắn nhãn `"Phản hồi rỗng"` cho lỗi `429`/`503`/mạng; phản hồi rỗng thực sự vẫn ghi đúng `"Phản hồi rỗng"` |
| **SC-003** | Chạy bộ test mẫu với bản thô GĐ1 lệch nhẹ cấu trúc 1-1 có thể căn chỉnh an toàn, và bản chuốt GĐ2 viết cô đọng tự nhiên đủ số đoạn không mất nghĩa | Giảm >= 60% số lần kích hoạt split đa tầng không cần thiết ở GĐ1 & GĐ2; vẫn chặn khi sót chữ Hán hoặc mất đoạn thật |
| **SC-004** | So sánh 2 chương đều từng bật `rawHasPartialFallback = true` ở GĐ1: (a) GĐ2 + QA phục hồi sạch chữ Hán & đạt chuẩn; (b) bản cuối vẫn còn sót chữ Hán | (a) trả về `hasPartialFallback` tắt (`false`); (b) giữ `hasPartialFallback = true` |
| **SC-005** | Kích hoạt `AbortController.abort()` trong lúc `waitWithAbort` đang chờ cửa sổ 60s hoặc chờ cooldown 45s | Promise chờ hủy trong `< 1000ms` (mục tiêu `< 100ms`), ném `AbortError`, 0 HTTP request phát sinh thêm |
| **SC-006** | Mô phỏng tất cả khóa trong pool cạn hạn mức ngày thật sự (`QUOTA_EXHAUSTED_RPD` hoặc vượt `MAX_COOLDOWN_WAITS_PER_CHAPTER`) trên hàng đợi 5 chương | Tiến trình hàng loạt dừng ngay sau chương gặp lỗi, không chạy tiếp các chương sau |
| **SC-007** | (1) Cấu hình `maxRpm` / `maxTpm` trên nhiều khóa và gửi chuỗi 30 lượt gọi liên tiếp; (2) Gửi lỗi `429` có chứa chữ `"quota"` mơ hồ khi `requestsToday` mới là `18 / 500` | (1) Gate 60s tự xoay khóa nguội nhất và tự chờ mở cửa sổ 60s không cần đếm giới hạn số lần; (2) Khóa tạm nghỉ 45–60s rồi hồi phục sau thành công, không bị khóa oan `Hết hạn mức ngày` ở lần đầu |
