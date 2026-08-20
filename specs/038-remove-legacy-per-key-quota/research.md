# Phase 0 Research: Loại bỏ Legacy Per-Key Quota Ownership & Chuẩn hóa Kiến trúc Quota Group Authority

**Feature Branch**: `038-remove-legacy-per-key-quota`  
**Created**: 2026-08-20  
**Status**: Completed  
**Spec Reference**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/038-remove-legacy-per-key-quota/spec.md)

---

## 1. Nghiên cứu & Quyết định Kiến trúc Cốt lõi

### Quyết định 1: Quota Ownership Model (QuotaGroup vs ApiKey)

- **Vấn đề**: Trước đây codebase tồn tại các giả định per-key quota (`keyRpm`, `keyMaxTpm`, `keyMaxRpd`, `perKeyRpm`, `calculateKeyScore()`), ngầm hiểu mỗi API key có một hạn mức RPM/TPM/RPD riêng biệt. Điều này trái với tài liệu và hành vi thực tế của Google Cloud / Gemini AI Studio (rate limit tính theo Project/Billing level).
- **Quyết định**: 
  1. Hạn mức RPM, TPM, RPD và cơ chế Sliding Window 60s thuộc quyền sở hữu độc quyền của `QuotaGroup` (đại diện cho 1 Google Cloud Project).
  2. `ApiKeyEntity` không chứa bất kỳ trường quota nào (`independentProviderRpm`, `independentProviderTpm`, `independentProviderRpd`), chỉ lưu giữ thông tin sức khỏe (`healthState`, `circuitBreaker`, `cooldownUntilMs`, `lastUsedAtMs`) và thống kê quan sát được (`observedAttempts`).
  3. Loại bỏ hoàn toàn phương thức `calculateKeyScore()` cũ và chuyển toàn bộ việc chọn lựa sang:
     $$\text{evaluateQuotaGroups}() \longrightarrow \text{selectBestKeyInGroup}()$$
- **Rationale**: Phản ánh chính xác 100% mô hình hạn ngạch của Google AI Studio, ngăn chặn hiện tượng nhân ảo dung lượng (False Capacity) và giảm thiểu lỗi 429 dây chuyền.
- **Alternatives Considered**: 
  - *Giữ per-key quota song song với QuotaGroup*: Bị bác bỏ vì tạo ra hai nguồn chân lý (dual sources of truth), gây sai lệch khi tính toán pacing và thống kê số liệu.

---

### Quyết định 2: Tách biệt 3 Khái niệm Bắt buộc (Invariants)

- **Quyết định**:
  1. **API key ≠ Quota bucket**: Thêm $N$ API keys vào cùng một Google Cloud Project chỉ tăng tính dự phòng khi xoay vòng lỗi, không làm tăng hạn mức $15 \times N$ RPM.
  2. **Provider attempt ≠ Logical request**: 1 yêu cầu dịch logic (`POST /translate-raw`) có thể trải qua nhiều lần thử provider (`totalProviderAttempts`) do cơ chế xoay key hoặc thử lại khi gặp 503/429. `MetricsService` và `QuotaService` phải ghi nhận tách bạch hai số liệu này.
  3. **Pacing ≠ HTTP Rate Limit**: Pacing là khoảng cách an toàn được tính toán chủ động theo công thức:
     $$\text{intervalMs} = \max\left(400\text{ms}, \left\lceil \frac{60000}{\text{RPM} \times 0.9} \right\rceil\right)$$
     được quản lý ở cấp độ QuotaGroup, khác biệt hoàn toàn với phản hồi lỗi HTTP 429 Rate Limited / Quota Exceeded từ Google.
- **Rationale**: Đảm bảo sự phân tầng mạch lạc trong kiến trúc 5 tầng: Model Registry $\to$ Admission $\to$ Quota Group $\to$ API Key Health Pool $\to$ Gemini Execution.

---

### Quyết định 3: Xử lý Tương thích Ngược & Di trú Dữ liệu Giao diện

- **Vấn đề**: Giao diện trước đây có phần nhập `maxRpm`, `maxTpm`, `maxRpd` trong `CustomLimitsPanel` (lưu vào `localStorage['gemini_quota_custom_limits']` theo từng `keyHash`).
- **Quyết định**:
  1. Không xóa mù cấu hình của người dùng.
  2. Chuyển đổi dữ liệu từ `localStorage` thành cấu hình hạn mức của Quota Group (`configuredLimits`) hoặc gợi ý điều phối (`schedulingHint`).
  3. Giao diện QuotaPanel hiển thị trực quan theo cây phân cấp:
     - Khung Nhóm Hạn Mức (Quota Group) hiển thị tiến độ RPM / TPM / RPD của toàn nhóm.
     - Danh sách API Key thành viên hiển thị huy hiệu trạng thái sức khỏe (`Healthy`, `Degraded`, `Cooldown`, `AuthFailed`, `Disabled`), số lượt gọi và lỗi.
- **Rationale**: Bảo toàn trải nghiệm người dùng hiện có trong khi chuẩn hóa mô hình dữ liệu bên dưới.

---

### Quyết định 4: Chiến lược Xử lý Lỗi & Cô lập Sức khỏe Key

- **Quyết định**:
  1. **Lỗi 401 / 403 (Auth Failed)**: Đánh dấu riêng key đó là `AuthFailed` (`circuitBreaker: Open`). QuotaGroup vẫn giữ trạng thái `Available` nếu còn ít nhất 1 key khỏe mạnh khác.
  2. **Lỗi 503 (Overload) / 502 / 504**: Đánh dấu riêng key đó vào `Cooldown` tạm thời theo `retryAfterSec` (mặc định 3s). Nếu key khác trong group đang rảnh thì chuyển sang key đó; nếu toàn bộ key đều bận thì hoãn theo pacing.
  3. **Lỗi 429 (Rate Limited / Quota Exceeded)**: Kích hoạt Cooldown cho toàn bộ QuotaGroup (`triggerGroupCooldown`), vì toàn bộ key trong group đều dùng chung bucket quota của dự án. Scheduler lập tức chuyển sang QuotaGroup khác nếu có.
- **Rationale**: Đảm bảo nguyên tắc cô lập lỗi tối đa: lỗi tài khoản/khóa chỉ ảnh hưởng đến khóa đó, lỗi hạn ngạch dự án ảnh hưởng đến dự án đó, không làm sập toàn bộ hệ thống.

---

## 2. 6 Kịch bản Kiểm thử Bắt buộc (Mandatory Test Matrix)

| # | Kịch bản | Thiết lập | Hành vi Kỳ vọng |
|---|---|---|---|
| 1 | **Same project + 2 keys** | Project A có Key A1, Key A2 (15 RPM) | Gửi 8 req qua Key A1, 7 req qua Key A2 $\to$ Group A đạt 15 RPM, chuyển sang Rate Limited. Tổng số request cả 2 key không vượt quá 15/phút. |
| 2 | **Different projects** | Project A (15 RPM), Project B (60 RPM) | Project A bị bão hòa 15 RPM $\to$ Project B vẫn nhận request bình thường và được scheduler ưu tiên chọn. |
| 3 | **Group quota exhaustion** | Project A cạn kiệt RPD ngày (1500 RPD) | Toàn bộ Group A chuyển sang `Exhausted`, cả Key A1 và Key A2 đều không nhận request cho đến khi sang ngày mới PST. |
| 4 | **One key auth failure** | Project A có Key A1 (hỏng), Key A2 (chuẩn) | Key A1 gặp 401 $\to$ chuyển `AuthFailed`. Group A vẫn `Available`, toàn bộ request tự động chuyển sang Key A2 thành công. |
| 5 | **One key cooldown** | Project A có Key A1 (503), Key A2 (chuẩn) | Key A1 vào Cooldown 3s $\to$ Key A2 tiếp nhận request ngay lập tức mà không cần chờ. |
| 6 | **Group still available** | Project A có 3 keys, 2 keys bị lỗi | Chừng nào còn 1 key `Healthy`, Group A vẫn duy trì trạng thái `Available` và phục vụ tốt. |

---

## 3. Danh mục Tệp Cần Tái cấu trúc & Loại bỏ Legacy

1. `shared/models.ts`:
   - Rà soát các interface `QuotaGroup`, `ApiKeyEntity`, `ProviderQuota`, `ConfiguredQuota`, `GroupObservedUsage`, `GroupSchedulingHint`.
   - Xác nhận không còn trường `independentProviderRpm/Tpm/Rpd` hay `keyRpm` giả định.
2. `server/services/quotaService.ts`:
   - Loại bỏ hoàn toàn method `calculateKeyScore()` và `KeyScoreOptions`.
   - Chuẩn hóa quy trình điều phối độc quyền qua `evaluateQuotaGroups()` và `selectBestKeyInGroup()`.
   - Giữ vững máy trạng thái `KeyHealthState` và logic phục hồi PST midnight.
3. `server/services/geminiService.ts`:
   - Cập nhật hàm pacing thành `computeGroupIntervalMs` (hoặc alias an toàn).
   - Xóa tham số legacy `perKeyRpm` khỏi luồng gọi thực thi, ánh xạ vào `ensureKeyGroup`.
4. `server/services/__tests__/keyScheduler.test.ts`:
   - Cập nhật test suite để kiểm thử theo `evaluateQuotaGroups` và `selectBestKeyInGroup`, loại bỏ các test gọi `calculateKeyScore`.
5. `src/components/QuotaPanel.tsx` & `src/utils/modelRegistry.ts`:
   - Đồng bộ giao diện người dùng và hàm format pacing theo cấp độ Quota Group.
