# Feature Specification: Đo Lường Hạn Ngạch Thời Gian Thực: RPM, TPM & RPD (Sliding Window Token & Request Quota Observability)

**Feature Branch**: `011-quota-sliding-window-tpm`  
**Created**: 2026-08-19  
**Status**: Draft  

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đo Lường RPM & TPM Theo Cửa Sổ Trượt 60 Giây (Priority: P1) 🎯 MVP

Là người dùng dịch tiểu thuyết số lượng lớn bằng Gemini API, tôi muốn biết chính xác tốc độ gọi API tức thời (Requests Per Minute - RPM) và lượng token tiêu thụ mỗi phút (Tokens Per Minute - TPM) theo cửa sổ trượt 60 giây (Sliding Window Log), để tôi có thể chủ động điều chỉnh số luồng song song mà không bị lỗi 429 Resource Exhausted hay vượt ngưỡng hạn mức TPM của tài khoản Google AI Studio.

**Why this priority**: Cơ chế Fixed Window (phút theo đồng hồ hệ thống) dễ gây sai lệch tại biên phút (spike traffic). Chuyển sang Sliding Window Log 60s cho phép đo lường chính xác tuyệt đối lưu lượng trong 60 giây qua và phản ánh đúng lượng token thực tế trả về từ SDK `response.usageMetadata`.

**Independent Test**:
1. Gửi liên tiếp 3 request dịch với mỗi request tiêu thụ 1.500 tokens.
2. Kiểm tra tab "Quota & Hạn mức", xác nhận RPM hiển thị `3` và TPM hiển thị `4.5k tokens` (hoặc `4,500`).
3. Đợi sau 60 giây (hoặc tua nhanh thời gian test bằng fake timers), xác nhận các request cũ tự động trượt ra khỏi cửa sổ 60s và RPM/TPM trở về `0` mà không làm mất số liệu tổng `requestsToday` / `tokensToday`.

**Acceptance Scenarios**:
1. **Given** 1 request dịch vừa hoàn thành với 2.000 prompt tokens và 500 output tokens, **When** gọi `recordAttempt`, **Then** `recentCalls` ghi nhận bản ghi `{ timestamp: now, tokens: 2500 }`, tăng `tokensTotal` và `tokensTodayCount` thêm 2.500.
2. **Given** một số bản ghi `recentCalls` có `timestamp < now - 60_000`, **When** `recordAttempt` hoặc `getSnapshot` được gọi, **Then** hệ thống tự động lọc bỏ các bản ghi cũ này, đảm bảo `requestsThisMinute` và `tokensThisMinute` chỉ tính toán trong đúng 60 giây gần nhất.

---

### User Story 2 - Theo Dõi Tổng Lượng Token Tiêu Thụ Trong Ngày (TPD - Tokens Per Day) (Priority: P1) 🎯 MVP

Là người dùng, tôi muốn xem tổng lượng token đã tiêu thụ trong ngày hôm nay (`tokensToday`) tính theo múi giờ chuẩn của Google AI Studio (`America/Los_Angeles` - PST/PDT), cùng tổng lũy kế phiên làm việc (`tokensTotal`), để đối chiếu với hóa đơn chi phí hoặc giới hạn Free Tier.

**Why this priority**: Gemini tính hạn mức hàng ngày (RPD / TPD) theo múi giờ Thái Bình Dương (PST/PDT). Hiển thị rõ ràng giúp người dùng quản lý chi phí và tài nguyên minh bạch.

**Independent Test**:
1. Dịch nhiều chương truyện qua nhiều key.
2. Xác nhận `tokensToday` và `tokensTotal` được cộng dồn chính xác theo từng model và từng key.
3. Khi múi giờ PST chuyển sang ngày mới (00:00 PST), `tokensToday` tự động reset về 0 trong khi `tokensTotal` vẫn được giữ nguyên.

**Acceptance Scenarios**:
1. **Given** ngày hiện tại tại PST là `2026-08-19`, **When** có các request phát sinh, **Then** `tokensTodayCount` tăng liên tục.
2. **Given** đồng hồ chuyển sang ngày `2026-08-20` (PST), **When** request mới phát sinh, **Then** `tokensTodayCount` được reset và bắt đầu tính cho ngày mới.

---

### User Story 3 - Cấu Hình Ngưỡng TPM Cá Nhân & Giao Diện Đo Lường Trực Quan (Priority: P2)

Là người dùng, tôi muốn có thể thiết lập ngưỡng giới hạn TPM cho từng API key (ví dụ: `1,000,000` hoặc `4,000,000` TPM tùy theo tier tài khoản) và xem thanh đo lường phần trăm (Progress Gauge) hiển thị trực quan cả RPM, TPM, và RPD trên màn hình "Quota & Hạn mức".

**Why this priority**: Cung cấp khả năng cảnh báo sớm khi tốc độ dịch sắp chạm trần TPM của tài khoản (đặc biệt khi dịch phân đoạn nhiều chương song song).

**Independent Test**:
1. Mở modal "Cấu hình AI & Bản Thảo", sang tab "Quota & Hạn mức", bấm "Ngưỡng cá nhân".
2. Nhập ngưỡng TPM (ví dụ: `1000000`), RPM (`15`), RPD (`1500`).
3. Xác nhận các thanh tiến độ phần trăm RPM, TPM, RPD hiển thị trực quan và đổi màu cảnh báo (Xanh -> Vàng -> Đỏ khi >= 90%).

**Acceptance Scenarios**:
1. **Given** người dùng đặt ngưỡng `maxTpm: 1,000,000`, **When** `tokensThisMinute` đạt `920,000`, **Then** thanh tiến độ TPM hiển thị `92%` kèm màu đỏ cảnh báo (`bg-polish`).

---

### Edge Cases

- **Request thất bại hoặc lỗi mạng**: `tokens` = 0 nhưng vẫn ghi nhận 1 request attempt để tính RPM chính xác.
- **Không có `usageMetadata` trong response từ API**: Fallback về `0` tokens an toàn, không gây crash ứng dụng.
- **Rò rỉ bộ nhớ**: Mảng `recentCalls` được tự động thu dọn (garbage collection) mỗi lần tính toán snapshot hoặc ghi nhận request, kích thước mảng tối đa bị giới hạn tự nhiên theo số request thực tế trong 60 giây.
- **Định dạng số lớn**: Hàm định dạng hiển thị `formatTokenCount(tokens)` hiển thị gọn gàng (`1.5k`, `250k`, `3.2M`).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Nâng cấp `server/services/quotaService.ts`:
  - `KeyUsageRecord` & `ModelUsageRecord` bổ sung `recentCalls: Array<{ timestamp: number; tokens: number }>`.
  - Bổ sung `tokensTotal`, `tokensTodayCount`, `tokensTodayDateKey`.
  - Hàm `recordAttempt` nhận thêm `tokenStats?: { promptTokens: number; outputTokens: number; totalTokens: number }`.
  - Tự động lọc bỏ các bản ghi cũ hơn $60.000\text{ms}$ (`timestamp < now - 60_000`).
  - Tính `requestsThisMinute = recentCalls.length` và `tokensThisMinute = recentCalls.reduce((s, c) => s + c.tokens, 0)`.
  - `KeyUsageSnapshot` & `ModelUsageSnapshot` trả về thêm `tokensThisMinute`, `tokensToday`, `tokensTotal`.
- **FR-002**: Nâng cấp `server/services/geminiService.ts`:
  - Trong `generateWithRotation`: Trích xuất `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`) từ SDK response và truyền vào `recordAttempt` khi request thành công.
- **FR-003**: Cập nhật Controller & API Client Types:
  - `server/controllers/quotaController.ts` & `src/utils/apiClient.ts`: Cập nhật `QuotaKeyStatus`, `QuotaModelUsage`, `KeyQuotaFullSnapshot`, `ModelUsageStats`.
- **FR-004**: Cập nhật `src/utils/modelRegistry.ts`:
  - Mở rộng `ModelStatsSummary` và `computeModelStatsSummary` để tổng hợp `tokensThisMinute`, `tokensToday`, `tokensTotal` cho Model đang chọn.
  - Bổ sung hàm tiện ích `formatTokenCount(count: number): string`.
- **FR-005**: Nâng cấp `src/components/QuotaPanel.tsx`:
  - Mở rộng `CustomLimit` hỗ trợ `maxTpm: number` (mặc định 1.000.000 TPM).
  - Thêm ô nhập Giới hạn TPM trong `CustomLimitsPanel`.
  - Thêm cột / ô hiển thị TPM trong Tile Metrics tổng quan trên cùng và trong từng `KeyCardItem`.
  - Hiển thị thanh tiến độ phần trăm TPM (`tpmPercent = (tokensThisMinute / limit.maxTpm) * 100`).

### Non-Functional Requirements & Guardrails

- **NFR-001 (Security & Privacy)**: Tuyệt đối không để lộ raw API key trong response hoặc logger. Tiếp tục mã hóa / mask bằng `hashKey`, `maskApiKey`, `redactApiKey`.
- **NFR-002 (Type Safety)**: `npm run lint` (`tsc --noEmit`) đạt 0 lỗi type.
- **NFR-003 (Unit Tests Pass)**: `npm test` (`vitest run`) pass 100% tất cả test suites.
- **NFR-004 (Build Clean)**: `npm run build` thành công.
- **NFR-005 (Design System Compliance)**: Giữ vững 100% phong cách thiết kế "Mực & Chu Sa".

---

## Success Criteria *(mandatory)*

1. **Sliding Window Accuracy**: RPM và TPM phản ánh chính xác lưu lượng trong 60 giây trượt gần nhất; hết 60 giây không có request thì RPM và TPM trở về 0.
2. **Real-time Token Observability**: Hiển thị chính xác số token tiêu thụ thực tế từ Google SDK `usageMetadata`.
3. **PST Rollover**: `tokensToday` tự động reset chính xác theo 00:00 PST.
4. **All Quality Gates Passed**: `npm run lint`, `npm test`, `npm run build` đều pass 100%.
