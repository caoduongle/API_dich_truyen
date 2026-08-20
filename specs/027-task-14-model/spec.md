# Feature Specification: Model Discovery Cache (Resilient & SWR Lifecycle)

**Feature**: Model Discovery Cache & SWR Lifecycle  
**Branch**: `027-task-14-model` | **Status**: `Draft` | **Created**: 2026-08-20  

---

## 1. Feature Overview & Problem Statement

### 1.1 Context
Trong ứng dụng dịch truyện, danh sách mô hình AI (Gemini 2.5 Flash, Gemini 3.1 Flash Lite, v.v.) đóng vai trò then chốt cho mọi luồng dịch thuật, kiểm định thuật ngữ và tối ưu hóa chi phí. Danh sách này được cấu thành từ:
1. **Preset Models**: Danh mục mô hình mặc định sẵn có trong hệ thống (`shared/models.ts`).
2. **Discovered Models**: Danh mục mô hình được tự động khám phá và truy vấn từ Google Gemini API (`/v1beta/models`) thông qua API Key của người dùng.
3. **Custom Models**: Các mô hình do người dùng tự cấu hình thủ công.

### 1.2 Problem Statement
Trước đây, việc truy vấn danh sách mô hình từ Google API (`ListModels`) gặp phải các hạn chế:
- **Chậm trễ giao diện (Latency)**: Khi mở cài đặt hoặc bắt đầu dịch, người dùng phải chờ API roundtrip (300ms–2000ms) để tải danh sách model.
- **Lãng phí API Quota**: Nhiều thao tác giao diện kích hoạt gọi lại API ListModels liên tục, làm tiêu tốn quota của key mà không tạo thêm giá trị.
- **Dễ đứt gãy khi API lỗi (Brittleness)**: Nếu Google API trả về lỗi mạng tạm thời hoặc 429 Quota Exceeded, danh sách model bị xóa trắng hoặc bị reset về rỗng, gây gián đoạn trải nghiệm người dùng và làm mất lựa chọn model hiện tại.
- **Race conditions**: Nhiều component đồng thời yêu cầu discovery gây ra hiện tượng nhiều request song song (duplicate in-flight calls).

### 1.3 Proposed Solution: Stale-While-Revalidate (SWR) Model Discovery
Triển khai cơ chế bộ đệm mô hình có khả năng phục hồi cao (Resilient Model Discovery Cache) theo chuẩn **Stale-While-Revalidate**:
```text
┌─────────────────────────────────────────────────────────┐
│                    User Opens App / UI                  │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
           ┌─────────────────────────────────┐
           │ Cache Available in LocalStorage?│
           └───────┬─────────────────┬───────┘
                   │ YES             │ NO
                   ▼                 ▼
        ┌──────────────────┐  ┌───────────────────┐
        │ Render Stale     │  │ Render Presets &  │
        │ Immediately (<5ms│  │ Show Skeleton     │
        └──────────┬───────┘  └─────────┬─────────┘
                   │                    │
                   └──────────┬─────────┘
                              │
                              ▼
        ┌───────────────────────────────────────────┐
        │ Need Background Refresh?                  │
        │ (Cache Stale > TTL OR Manual Refresh)     │
        └─────────────────────┬─────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────────┐
        │ In-Flight Lock Active?                    │
        │ (Prevent Duplicate Discovery Requests)    │
        └─────────────────────┬─────────────────────┘
                              │ NO (Acquire Lock)
                              ▼
        ┌───────────────────────────────────────────┐
        │ Query Google API / Server Model Registry  │
        └─────────────────────┬─────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼ SUCCESS                     ▼ ERROR / TIMEOUT
    ┌─────────────────────────┐   ┌───────────────────────────┐
    │ 1. Validate Models      │   │ 1. Keep Stale Cache Intact│
    │ 2. Deduplicate Presets  │   │ 2. Log Warning / Toast    │
    │ 3. Update Cache & Store │   │ 3. Zero Registry Wipe     │
    │ 4. Notify Listeners     │   │ 4. Release Lock           │
    └─────────────────────────┘   └───────────────────────────┘
```

---

## 2. User Stories & Priorities

### User Story 1 (P1) — Instant UI Render via Stale Cache (MVP)
**As a** biên dịch viên mở giao diện dịch thuật,  
**I want** danh sách mô hình hiển thị ngay lập tức (< 10ms) từ bộ đệm đã lưu,  
**So that** tôi không phải chờ đợi loading spinner và có thể bắt đầu dịch truyện ngay mà không bị nghẽn mạng.

#### Acceptance Scenarios
- **Given** người dùng đã từng khám phá mô hình thành công và có dữ liệu đệm trong `localStorage`,
- **When** người dùng mở ứng dụng hoặc mở bảng chọn model,
- **Then** hệ thống nạp và hiển thị ngay danh sách mô hình từ cache mà không block giao diện.

---

### User Story 2 (P2) — Non-Blocking Background Revalidation & Concurrency Lock
**As a** người dùng thao tác trên hệ thống,  
**I want** ứng dụng tự động kiểm tra và làm mới danh sách model ở chế độ chạy ngầm (background) khi cache hết hạn (stale),  
**So that** danh sách model luôn được cập nhật phiên bản mới nhất từ Google mà không gây giật lag giao diện và không gửi trùng lặp nhiều request cùng lúc.

#### Acceptance Scenarios
- **Given** cache mô hình đã vượt quá thời gian TTL (ví dụ > 1 giờ),
- **When** người dùng mở màn hình hoặc nhiều component đồng thời yêu cầu danh sách model,
- **Then** hệ thống:
  1. Giữ nguyên danh sách model hiện tại trên giao diện.
  2. Tạo duy nhất 1 in-flight Promise chạy ngầm để gọi API cập nhật.
  3. Sau khi có kết quả mới, cập nhật nguyên tử (atomic update) vào bộ đệm và thông báo cập nhật giao diện êm dịu (zero flicker).

---

### User Story 3 (P3) — Transient Failure Resilience & Zero-Wipe Fallback
**As a** người dùng khi gặp sự cố mạng hoặc Google API tạm thời quá tải (429/503),  
**I want** hệ thống tiếp tục duy trì danh mục mô hình hợp lệ từ bộ đệm cũ (stale cache),  
**So that** tôi vẫn chọn được model và không bị mất cấu hình hay bị xóa trắng danh sách model.

#### Acceptance Scenarios
- **Given** cache có sẵn danh sách model nhưng API Google trả về lỗi (429 Quota Exceeded, 500 Server Error hoặc Network Offline),
- **When** tiến trình background refresh thực thi và nhận lỗi,
- **Then** hệ thống:
  1. KHÔNG xóa dữ liệu cache hiện có.
  2. KHÔNG reset model đang chọn về rỗng.
  3. Ghi nhận lỗi chạy ngầm và hiển thị trạng thái nhẹ nhàng nếu là thao tác thủ công.
  4. Đặt thời gian thử lại an toàn (cooldown).

---

### User Story 4 (P4) — Manual Refresh & Visual Sync State
**As a** người dùng muốn kiểm tra xem tài khoản vừa được cấp quyền truy cập model mới hay chưa,  
**I want** một nút "Làm mới danh sách mô hình" trực tiếp trong giao diện cài đặt,  
**So that** tôi có thể chủ động kích hoạt cập nhật ngay lập tức bất kể TTL.

#### Acceptance Scenarios
- **Given** người dùng đang ở tab Cài đặt API,
- **When** người dùng nhấn nút "Làm mới mô hình",
- **Then** hệ thống bỏ qua TTL, kích hoạt gọi API cập nhật, hiển thị trạng thái xoay loading trên nút và hiển thị thông báo kết quả (số model mới phát hiện hoặc thông báo giữ nguyên cache nếu lỗi).

---

## 3. Functional Requirements

### 3.1 Lifecycle & Caching Rules
- **FR-001**: Hệ thống PHẢI lưu trữ danh sách mô hình khám phá kèm timestamp metadata: `{ timestamp: number, models: RegisteredModelDef[], lastRefreshedAt: string, etag?: string }`.
- **FR-002**: Thời gian sống mặc định (TTL) của cache mô hình trên Client là **1 giờ** (`DISCOVERED_MODELS_TTL_MS = 3600000`).
- **FR-003**: Khi dữ liệu cache đã quá TTL (stale), hệ thống PHẢI trả về dữ liệu stale cho UI trước (instant render) và kích hoạt tiến trình background revalidation không đồng bộ.

### 3.2 In-Flight Deduplication & Concurrency Lock
- **FR-004**: Hệ thống PHẢI sử dụng cờ/Promise singleton (`inFlightDiscoveryPromise`) để ngăn chặn việc gửi nhiều request `fetchDiscoveredModels` đồng thời từ các component khác nhau.
- **FR-005**: Mọi lời gọi `refreshDiscoveredModels()` trong khi một tiến trình khám phá đang chạy PHẢI tái sử dụng cùng Promise đang thực thi thay vì tạo kết nối mới.

### 3.3 Validation & Deduplication
- **FR-006**: Khi nhận phản hồi từ API, hệ thống PHẢI lọc chỉ giữ lại các model hỗ trợ `generateContent` (sinh văn bản) và có định dạng ID hợp lệ (`MODEL_ID_REGEX`).
- **FR-007**: Hệ thống PHẢI tự động loại bỏ các model trùng lặp với danh mục Presets có sẵn để tránh gây rối danh sách chọn.
- **FR-008**: Cập nhật bộ nhớ đệm và registry PHẢI diễn ra nguyên tử (atomic), cập nhật cả in-memory Map lẫn `localStorage`.

### 3.4 Resilience & Error Recovery
- **FR-009**: Khi background refresh hoặc manual refresh thất bại (lỗi 4xx, 5xx, timeout, network error), hệ thống TUYỆT ĐỐI KHÔNG ĐƯỢC xóa bộ đệm `gemini_discovered_models` hoặc reset `gemini_selected_model`.
- **FR-010**: Nếu dữ liệu cache rỗng và API gặp lỗi, hệ thống PHẢI cung cấp danh mục mô hình Presets mặc định làm lớp bảo vệ cuối cùng (fail-safe fallback).
- **FR-011**: Hệ thống PHẢI ghi nhận mã lỗi và thông điệp lỗi ngắn gọn (ví dụ: `429 Quota Exceeded - Using cached models`) mà không làm lộ API Key hay token nhạy cảm trong log.

### 3.5 Manual Trigger & UI Feedback
- **FR-012**: Giao diện PHẢI cung cấp hàm/hook `refreshModels(force?: boolean)` cho phép ép buộc làm mới bỏ qua TTL và trả về trạng thái `isRefreshing`, `lastRefreshError`, `lastRefreshedAt`.

---

## 4. Edge Cases & Handling

| Tình huống ngoại lệ (Edge Case) | Hành vi mong đợi của hệ thống |
|:---|:---|
| **Mất kết nối mạng hoàn toàn (Offline)** | UI render ngay từ stale cache / presets. Background refresh bắt lỗi `Failed to fetch`, ghi nhận cờ offline, giữ nguyên 100% cache. |
| **API Key bị thu hồi hoặc hết hạn (401/403)** | Giữ stale cache để không vỡ UI; thông báo yêu cầu cập nhật API key trong tab cài đặt; không xóa cache cũ ngay lập tức. |
| **Google API bị Rate Limit (429 Too Many Requests)** | Bỏ qua cập nhật lần này, giữ nguyên stale cache, kích hoạt cooldown tối thiểu 60 giây trước khi cho phép background refresh lần tiếp theo. |
| **Người dùng click nút "Làm mới" liên tục nhiều lần** | Request đầu tiên chạy; các click tiếp theo trong 5000ms bị debounce hoặc dùng chung singleton Promise, tránh spam API. |
| **Dữ liệu JSON trong cache bị lỗi cú pháp / hỏng** | Bắt ngoại lệ `JSON.parse`, tự động xóa entry hỏng, fallback về Presets và kích hoạt làm mới tự động. |
| **Đổi API Key trong phiên làm việc** | Khi người dùng lưu API Key mới, hệ thống tự động xóa cờ cache cũ và kích hoạt discovery mới cho key đó. |

---

## 5. Key Entities & Data Schema

### 5.1 Discovered Models Cache Schema (`localStorage: gemini_discovered_models`)
```typescript
export interface DiscoveredModelsCachePayload {
  version: 1;
  timestamp: number;          // Epoch timestamp khi lưu cache (ms)
  lastRefreshedAt: string;    // ISO string hiển thị cho người dùng
  models: RegisteredModelDef[]; // Danh sách model đã lọc và chuẩn hóa
  sourceKeyHash?: string;     // Hash an toàn (SHA-256) của key đã dùng khám phá (tránh trộn key)
}
```

### 5.2 Model Discovery State Hook (`useModelDiscovery`)
```typescript
export interface ModelDiscoveryState {
  models: RegisteredModelDef[];
  isLoading: boolean;         // True khi chưa có cache và đang tải lần đầu
  isRefreshing: boolean;      // True khi đang background refresh hoặc manual refresh
  isStale: boolean;           // True khi timestamp đã vượt quá TTL 1 giờ
  lastRefreshedAt: Date | null;
  error: string | null;
  refresh: (force?: boolean) => Promise<RegisteredModelDef[]>;
}
```

---

## 6. Measurable Success Criteria

- **SC-001 (Zero Latency UI)**: 100% các lần mở ứng dụng có sẵn cache đạt thời gian render danh sách model ban đầu < **10ms** (không bị block bởi mạng).
- **SC-002 (API Call Reduction)**: Giảm tối thiểu **80%** số lượng request `ListModels` trong các phiên làm việc thông thường nhờ cơ chế 1-hour TTL và deduplication.
- **SC-003 (Duplicate Request Prevention)**: 0 trường hợp gửi song song 2 request `ListModels` cùng lúc khi nhiều component mount đồng thời.
- **SC-004 (100% Resilience on Outage)**: 100% các trường hợp Google API lỗi mạng hoặc 429 không làm mất danh sách model đang hiển thị và không làm mất model đang chọn.
- **SC-005 (Quality Gates)**: Đạt 100% bài kiểm thử tự động (`vitest`), 0 lỗi kiểu dữ liệu TypeScript (`npm run lint`), và build thành công (`npm run build`).
