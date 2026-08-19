# Feature Specification: Điều Phối Nhịp Độ Gọi API Động Dựa Trên Quota Cá Nhân (Dynamic Quota-Driven Pacing & Rate Limiting)

**Feature Branch**: `012-dynamic-quota-pacing`  
**Created**: 2026-08-19  
**Status**: Draft  

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tự Động Điều Phối Nhịp Độ Theo RPM & Model (Priority: P1) 🎯 MVP

Là người dùng dịch truyện tự động, tôi muốn ứng dụng tự động tính toán khoảng cách an toàn giữa các request dựa trên giới hạn RPM mà tôi đã cấu hình cho từng API key hoặc Model (thay vì áp cứng 4500ms tĩnh cho mọi trường hợp), để tôi có thể tăng tốc độ dịch tối đa nếu có tài khoản trả phí (ví dụ 60-300 RPM) hoặc dịch an toàn không bị lỗi 429 nếu dùng Free Tier (15 RPM).

**Why this priority**: Hiện tại hệ thống đang áp dụng thời gian chờ cứng 4500ms tĩnh trên mỗi key (`AI_SERVICE_CONFIG.MIN_REQUEST_INTERVAL_PER_KEY_MS = 4500`), khiến người dùng có tài khoản trả phí bị bóp nghẽn tốc độ ở mức ~13 req/phút, trong khi người dùng có model nhạy cảm lại không thể nới rộng thời gian chờ.

**Independent Test**:
1. Đặt RPM của Key là `60` trong bảng Cấu hình Ngưỡng cá nhân.
2. Kiểm tra thông số nhịp độ hiển thị: khoảng cách giữa các request giảm xuống còn `~1.1 giây/lần gọi`.
3. Gửi dịch tự động nhiều chương, kiểm tra thời gian hoàn thành nhanh hơn gấp nhiều lần mà không bị server delay 4.5s.
4. Đổi RPM thành `10`, xác nhận khoảng cách tự động giãn ra `~6.8 giây/lần gọi`.

**Acceptance Scenarios**:
1. **Given** người dùng cấu hình `maxRpm = 60`, **When** tính toán khoảng trễ gọi API, **Then** `pacingIntervalMs` đạt xấp xỉ `1.136ms` (`Math.max(500, Math.ceil(60000 / (60 * 0.88)))`), server áp dụng `keyMinInterval = 1.111ms` thay vì 4500ms.
2. **Given** người dùng cấu hình `maxRpm = 300` (Tier 2/Pay-as-you-go), **When** dịch, **Then** hệ thống chạy với khoảng trễ tối thiểu an toàn `500ms` (không thấp hơn sàn an toàn `400ms`).

---

### User Story 2 - Cơ Chế Tự Động Giãn Nhịp Chống Tràn Token (TPM Throttling) (Priority: P1) 🎯 MVP

Là người dịch tiểu thuyết với các chương dài, tôi muốn khi lượng token tiêu thụ trong 60 giây gần nhất (`tokensThisMinute`) chạm ngưỡng 85% hạn mức TPM định mức, hàng đợi dịch tự động (`useAutoTranslationQueue`) sẽ tạm hoãn và hiển thị thông báo "Đang giãn nhịp để nạp lại hạn mức Token...", để ngăn chặn hoàn toàn việc tài khoản bị Google AI Studio tạm khóa 429 vì tràn TPM.

**Why this priority**: Các chương tiểu thuyết dài có thể ngốn 3.000 - 8.000 tokens mỗi request; nếu dịch liên tục dù RPM chưa vượt nhưng TPM đã chạm trần 1.000.000 TPM thì API sẽ bị lỗi 429 hàng loạt.

**Independent Test**:
1. Giả lập hoặc theo dõi khi `tokensThisMinute` vượt quá 85% `maxTpm` (ví dụ 850.000 / 1.000.000 tokens).
2. Hàng đợi tự động nhận diện và hiển thị trạng thái chờ nạp lại token.
3. Khi các request cũ trượt ra khỏi cửa sổ 60 giây và `tokensThisMinute` hạ xuống dưới 85%, hàng đợi tự động tiếp tục dịch mượt mà.

**Acceptance Scenarios**:
1. **Given** `tokensThisMinute >= maxTpm * 0.85`, **When** chuẩn bị gửi request dịch tiếp theo trong hàng đợi, **Then** hệ thống tạm hoãn và cập nhật trạng thái thông báo chờ cửa sổ trượt hạ nhiệt.

---

### User Story 3 - Hiển Thị Trực Quan Trạng Thái Pacing Trên UI (Priority: P2)

Là người dùng, tôi muốn xem thông tin trực quan về tốc độ điều phối hiện tại ngay trên modal "Cấu hình AI & Bản Thảo" và tab "Quota & Hạn mức" ("Tốc độ điều phối: ~X req/phút (Khoảng cách ~Y giây/lần gọi)"), để hiểu rõ hệ thống đang hoạt động với nhịp độ nào.

**Why this priority**: Tăng tính minh bạch và sự tin cậy, giúp người dùng nắm bắt ngay hiệu quả khi họ thay đổi số RPM trong cài đặt.

**Independent Test**:
1. Mở modal "Cấu hình AI & Bản Thảo".
2. Xem card tóm tắt: thấy hiển thị nhịp độ tính toán (ví dụ: `~13.2 req/phút (~4.5s/lần gọi)`).
3. Chỉnh sửa ô RPM trong tab Quota -> card tóm tắt cập nhật số liệu ngay lập tức.

**Acceptance Scenarios**:
1. **Given** người dùng thay đổi giá trị `maxRpm` trong `CustomLimitsPanel`, **When** lưu, **Then** thông số nhịp độ trên toàn bộ UI đồng bộ ngay lập tức.

---

### Edge Cases

- **Giá trị RPM quá nhỏ hoặc <= 0**: Fallback về mặc định an toàn theo tier model (Flash = 15 RPM ~ 4500ms, Pro = 10 RPM ~ 6000ms).
- **Giá trị RPM cực lớn (> 300 RPM)**: Giới hạn sàn an toàn `intervalMs >= 400ms` để bảo vệ kết nối HTTP/socket.
- **Không truyền custom RPM lên server**: Server giữ nguyên fallback mặc định 4500ms an toàn.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Trong `src/utils/modelRegistry.ts`:
  - Viết hàm `getDynamicPacingInterval(customRpm?: number, modelId?: string): number` với hệ số an toàn $0.88$ và giới hạn sàn $500\text{ms}$.
  - Viết hàm `isTpmNearLimit(currentTpm: number, maxTpm?: number): boolean` (ngưỡng 85%).
  - Viết hàm `formatPacingSummary(intervalMs: number): { estimatedRpm: number; intervalSec: string }`.
- **FR-002**: Trong `server/services/geminiService.ts` & `server/routes/api.ts`:
  - `server/routes/api.ts`: Đọc `x-custom-rpm` từ request headers hoặc `req.body.customRpm` và truyền vào `geminiService`.
  - `server/services/geminiService.ts`: Tính toán `keyMinInterval = customRpm > 0 ? Math.max(400, Math.ceil(60000 / (customRpm * 0.9))) : 4500` và cập nhật `nextAllowedTimeByKey.set(key, now + keyMinInterval)`.
- **FR-003**: Trong `src/utils/apiClient.ts`:
  - Bổ sung header `x-custom-rpm` trong các hàm gọi API dịch thuật (`translateRaw`, `polishTranslation`, `qaCritique`, `translateSegmentStream`).
- **FR-004**: Trong `src/hooks/useAutoTranslationQueue.ts` & `src/hooks/useTranslationProcess.ts`:
  - Sử dụng khoảng trễ động giữa các bước dịch.
  - Tích hợp kiểm tra an toàn TPM trước mỗi lượt dịch batch.
- **FR-005**: Trong `src/components/QuotaPanel.tsx` & `src/components/ApiSettings.tsx`:
  - Hiển thị thông số nhịp độ điều phối ("Tốc độ điều phối: ~X req/phút • ~Y s/lần gọi").

### Non-Functional Requirements & Guardrails

- **NFR-001 (Safety Floor)**: Không cho phép `intervalMs < 400ms` trên server và `500ms` trên client.
- **NFR-002 (Type Safety)**: `npm run lint` (`tsc --noEmit`) đạt 0 lỗi type.
- **NFR-003 (Unit Tests Pass)**: `npm test` (`vitest run`) pass 100% tất cả test suites.
- **NFR-004 (Build Clean)**: `npm run build` thành công.
- **NFR-005 (Design System Compliance)**: Tuân thủ 100% Design System "Mực & Chu Sa".

---

## Success Criteria *(mandatory)*

1. **Eliminated Hardcoded 4500ms**: Thời gian chờ giữa các request trên client và server thích ứng 100% theo RPM cấu hình của người dùng.
2. **TPM Protection Active**: Hàng đợi dịch tự động giãn nhịp an toàn khi `tokensThisMinute` vượt 85% TPM định mức.
3. **All Quality Gates Passed**: `npm run lint`, `npm test`, `npm run build` đều pass 100%.
