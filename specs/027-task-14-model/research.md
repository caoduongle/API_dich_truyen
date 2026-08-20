# Research: Model Discovery Cache (Resilient & SWR Lifecycle)

**Feature**: Model Discovery Cache & SWR Lifecycle  
**Branch**: `027-task-14-model` | **Date**: 2026-08-20  

---

## 1. Research Objectives & Problem Analysis

Việc truy vấn danh sách model từ Google Gemini API (`ListModels`) cần đáp ứng các yêu cầu:
1. **Render tức thời (< 10ms)**: Không block giao diện người dùng khi mở cài đặt hoặc bắt đầu dịch.
2. **Tiết kiệm API calls**: Tối thiểu 80% số lần mở app không cần gọi API ListModels nếu dữ liệu chưa hết hạn.
3. **Chống gọi trùng lặp (In-Flight Deduplication)**: Khi 3-4 component cùng mount (ví dụ `ApiSettings`, `TranslatorWorkspace`, `ModelObservabilityPanel`), chỉ gửi 1 request duy nhất tới server/Google.
4. **Khả năng phục hồi khi lỗi (Resilience)**: Nếu Google API trả về 429 Quota Exceeded, 503, hoặc mất mạng, tiếp tục dùng stale cache đã có, TUYỆT ĐỐI KHÔNG xóa registry hoặc làm mất model đang chọn.

---

## 2. Technical Decisions & Trade-off Analysis

### Decision 1: Stale-While-Revalidate (SWR) Pattern on Client & Server

- **Decision**: Áp dụng mô hình SWR ở 2 lớp:
  1. **Client Memory / LocalStorage Layer**: Trả về dữ liệu từ `localStorage` ngay lập tức khi component khởi tạo. Nếu timestamp > TTL (1 giờ), kích hoạt background revalidation không đồng bộ.
  2. **Server Registry Cache Layer**: Server lưu trữ cache model trong memory (`modelInfoService.ts`) với TTL 15 phút để bảo vệ key khỏi việc spam từ nhiều tab/clients.
- **Rationale**:
  - Loại bỏ hoàn toàn cảm giác giật lag hoặc layout shift khi mở ứng dụng.
  - Phục vụ người dùng offline hoặc khi mạng yếu một cách tự nhiên.
- **Alternatives Considered**:
  - *Cache-first with hard blocking on expiry*: Buộc người dùng chờ khi cache hết hạn → Gây gián đoạn trải nghiệm người dùng không cần thiết.
  - *Always-fetch on mount*: Gây tốn API quota, tăng độ trễ mở app và dễ bị lỗi 429 nếu mở nhiều tab.

---

### Decision 2: In-Flight Promise Singleton for Duplicate Prevention

- **Decision**: Sử dụng biến tham chiếu module-level `inFlightDiscoveryPromise: Promise<RegisteredModelDef[]> | null` trong `modelRegistry.ts` (client) và `pendingFetchMap: Map<string, Promise<ModelInfoItem[]>>` trong `modelInfoService.ts` (server).
- **Rationale**:
  - Khi nhiều component gọi `fetchDiscoveredModels()` cùng 1 lúc (ví dụ trong cùng 100ms khi trang chủ load), tất cả component đều `await` cùng 1 Promise duy nhất.
  - Giảm số lượng network request từ N xuống 1.
  - Tự động dọn dẹp biến singleton trong khối `finally { inFlightDiscoveryPromise = null; }`.
- **Alternatives Considered**:
  - *Debounce bằng `setTimeout`*: Trì hoãn request thêm 300ms–500ms làm tăng tổng thời gian chờ. Singleton Promise thực thi ngay lập tức cho request đầu tiên và chia sẻ kết quả cho các request tiếp theo.

---

### Decision 3: Error Handling & Zero-Wipe Fallback Policy

- **Decision**:
  1. Khi background refresh nhận lỗi (HTTP 4xx/5xx, network error, timeout):
     - Giữ nguyên 100% dữ liệu trong `localStorage: gemini_discovered_models`.
     - Cập nhật trường `lastRefreshError` và thông báo toast/badge nhẹ trên UI.
     - Đặt cooldown 60 giây trước khi cho phép background refresh tự động tiếp theo.
  2. Khi người dùng bấm nút làm mới thủ công (Manual Refresh):
     - Hiển thị spinner xoay trên nút làm mới.
     - Nếu lỗi, hiển thị thông báo "Không thể làm mới danh sách model từ Google, hệ thống đang tiếp tục sử dụng danh mục đã lưu."
- **Rationale**:
  - Dữ liệu model của Google rất ít khi thay đổi theo từng giây. Một model đã khám phá thành công trước đó vẫn có giá trị sử dụng cao ngay cả khi API Google tạm thời quá tải.
  - Xóa cache khi lỗi là hành vi nguy hiểm, phá vỡ luồng làm việc của người dùng.
- **Alternatives Considered**:
  - *Xóa cache khi nhận 401/403*: Không nên xóa ngay vì có thể người dùng chỉ tạm thời gặp sự cố mạng hoặc proxy. Chỉ xóa khi người dùng chủ động xóa API key hoặc đăng xuất.

---

### Decision 4: TTL and Stale Thresholds

- **Client TTL**: `DISCOVERED_MODELS_TTL_MS = 60 * 60 * 1000` (1 giờ).
- **Client Background Cooldown on Error**: `DISCOVERY_RETRY_COOLDOWN_MS = 60 * 1000` (60 giây).
- **Server In-Memory TTL**: `SERVER_MODEL_CACHE_TTL_MS = 15 * 60 * 1000` (15 phút).
- **Rationale**:
  - 1 giờ là khoảng thời gian cân bằng hoàn hảo giữa việc cập nhật các mô hình mới ra mắt và giảm thiểu tối đa API call không cần thiết.

---

## 3. Risk Assessment & Mitigations

| Rủi ro (Risk) | Khả năng | Tác động | Giải pháp giảm thiểu (Mitigation) |
|:---|:---|:---|:---|
| **Người dùng đổi API key sang tài khoản khác có quyền model khác nhau** | Thấp - Trung bình | Trung bình | Khi lưu API key mới trong `useAIConfig` / `ApiSettings`, tự động xóa cờ cache và kích hoạt discovery mới cho key đó. |
| **Dữ liệu JSON trong localStorage bị sửa đổi / corrupt** | Rất thấp | Thấp | Bọc toàn bộ `JSON.parse` trong `try/catch`. Nếu corrupt, fallback an toàn về Presets và dọn dẹp key lỗi. |
| **Race condition khi ghi cache từ nhiều tab** | Thấp | Thấp | Cập nhật nguyên tử toàn bộ payload JSON kèm timestamp. |
