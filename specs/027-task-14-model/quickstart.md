# Quickstart: Model Discovery Cache & SWR Lifecycle Validation

**Feature**: Model Discovery Cache & SWR Lifecycle  
**Branch**: `027-task-14-model` | **Date**: 2026-08-20  

---

## 1. Automated Test Execution

Chạy toàn bộ bộ test kiểm thử tự động cho cơ chế SWR Cache và Model Discovery:

```bash
# Chạy riêng các bài test Model Discovery & SWR Lifecycle
npx vitest run src/utils/__tests__/modelDiscoveryCache.test.ts
npx vitest run src/hooks/__tests__/useModelDiscovery.test.ts

# Chạy toàn bộ test suites của ứng dụng
npm test

# Kiểm tra tính toàn vẹn kiểu dữ liệu TypeScript
npm run lint

# Kiểm tra build sản phẩm
npm run build
```

---

## 2. End-to-End Validation Scenarios

### Scenario 1: Instant Render with Stale Cache (SWR)
1. Giả lập cache cũ trong `localStorage: gemini_discovered_models` với `timestamp = Date.now() - 7200000` (2 giờ trước - Stale).
2. Mount component `useModelDiscovery()`.
3. **Kết quả mong đợi**:
   - `models` lập tức chứa danh sách model từ stale cache (`isLoading: false`).
   - `isStale` là `true`.
   - `isRefreshing` chuyển thành `true` khi background request bắt đầu chạy ngầm.

### Scenario 2: In-Flight Deduplication
1. Gọi đồng thời 5 lần `fetchAndCacheDiscoveredModels(apiMock)` cùng 1 thời điểm.
2. **Kết quả mong đợi**:
   - `apiMock` chỉ được gọi **đúng 1 lần**.
   - Cả 5 lần gọi đều nhận về cùng 1 kết quả danh sách model hợp lệ.

### Scenario 3: Transient Error Resilience (Zero Registry Wipe)
1. Cache có sẵn 3 models đã khám phá.
2. Giả lập Google API trả về lỗi `HTTP 429 Too Many Requests` hoặc `Network Error`.
3. Kích hoạt background refresh hoặc manual refresh.
4. **Kết quả mong đợi**:
   - Danh sách 3 models trong cache **không bị xóa**.
   - `localStorage: gemini_discovered_models` vẫn lưu đủ 3 models.
   - `error` nhận thông điệp lỗi, `isRefreshing` chuyển về `false`.
