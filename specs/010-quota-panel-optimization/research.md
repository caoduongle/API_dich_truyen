# Research & Architecture Decisions: Quota Panel Performance Optimization

**Feature**: `010-quota-panel-optimization`  
**Created**: 2026-08-19  

---

## 1. Phân Tích Hiện Trạng & Điểm Nghẽn Hiệu Năng (Bottlenecks)

### 1.1. Timer Đếm Lùi Toàn Cục Trong `useModelObservability.ts`
- **Hiện trạng**: Hook `useModelObservability` chứa `useEffect` chạy `setInterval` 1000ms:
  ```typescript
  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshotKeys(prev => ...);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  ```
- **Hậu quả**: Khi có bất kỳ key nào đang ngắt mạch hoặc hoãn rate limit, `setSnapshotKeys` được gọi mỗi giây -> Hook cha thay đổi state -> `ApiSettings` re-render -> `computeModelStatsSummary` chạy lại -> `QuotaPanel` và tất cả các thẻ key con bị re-render lại toàn bộ mỗi giây.

### 1.2. Cascading Re-render Do `registerDiscoveredModels`
- **Hiện trạng**: Trong `useAIConfig.ts`, `handleRegisterDiscoveredModels` gọi:
  ```typescript
  const handleRegisterDiscoveredModels = useCallback((models: ModelInfoItem[]) => {
    const updated = saveDiscoveredModels(models);
    setDiscoveredModels(updated);
  }, []);
  ```
- **Hậu quả**: `setDiscoveredModels` nhận một reference mảng mới (`updated = [...]`) kể cả khi danh sách model không có gì thay đổi so với `discoveredModels` hiện tại trong React state. Việc này kích hoạt React Context (`AIConfigContext`) cập nhật, kéo theo toàn bộ ứng dụng (`App.tsx`, `TranslatorWorkspace.tsx`, `ProjectList.tsx`, `ApiSettings.tsx`) re-render thừa thãi.

### 1.3. Thiếu Bộ Đệm Cache Cho Quota Status Khi Chuyển Tab Modal
- **Hiện trạng**: Mỗi lần chuyển tab hoặc mở lại modal, `useModelObservability` lại gửi request `fetchQuotaStatus()`.
- **Hậu quả**: Tạo request HTTP dư thừa và gây độ trễ hiển thị (flash loading spinner).

---

## 2. Các Quyết Định Kiến Trúc & Giải Pháp Kỹ Thuật

### 2.1. Quyết định 1: Cô Lập Đồng Hồ Đếm Lùi Vào Component Lá `CountdownBadge`
- **Design**:
  - `useModelObservability` KHÔNG còn chạy timer `setInterval` mỗi giây. Nó chỉ nhận dữ liệu tĩnh từ server: `blacklistRemainingMs` và `nextAllowedRemainingMs` tại thời điểm tải snapshot (`lastUpdatedTimestamp`).
  - Tạo component `CountdownBadge`:
    ```typescript
    interface CountdownBadgeProps {
      initialRemainingMs: number;
      type: 'blacklist' | 'rateLimit';
      targetTimestamp?: number;
      onExpire?: () => void;
    }
    ```
  - `CountdownBadge` tính `targetEndTime = Date.now() + initialRemainingMs`.
  - Bên trong `CountdownBadge`, `useEffect` chạy `setInterval` 1000ms để đếm lùi `secondsLeft`. Khi `secondsLeft <= 0`, hiển thị trạng thái "Hoạt động" hoặc gọi `onExpire`.
  - Bọc `CountdownBadge` bằng `React.memo`.
- **Lợi ích**: Khi đếm lùi, chỉ duy nhất text node số giây bên trong `CountdownBadge` re-render. Toàn bộ `KeyCardItem`, `QuotaPanel`, `ApiSettings`, và `App` đều đứng yên 100% (Zero Container Re-renders).

### 2.2. Quyết định 2: So Sánh Danh Sách ID Trước Khi Cập Nhật State Trong `useAIConfig`
- **Design**:
  ```typescript
  const handleRegisterDiscoveredModels = useCallback((models: ModelInfoItem[]) => {
    const updated = saveDiscoveredModels(models);
    setDiscoveredModels(prev => {
      if (
        prev.length === updated.length &&
        prev.every((item, idx) => item.id === updated[idx]?.id)
      ) {
        return prev; // Giữ nguyên state reference cũ -> React bails out, không re-render Context
      }
      return updated;
    });
  }, []);
  ```
- **Lợi ích**: Ngăn chặn hoàn toàn hiện tượng cascading re-render khi kiểm tra model đã biết.

### 2.3. Quyết định 3: Bóc Tách `KeyCardItem` & Memoize
- **Design**:
  - Tách giao diện 1 thẻ API key thành component `KeyCardItem` riêng biệt.
  - Bọc bằng `React.memo(KeyCardItem, (prev, next) => ...)`.
  - Các handler hành động (như `onInspect`, `onClearInspect`, `onSelectModel`) được bọc `useCallback`.
- **Lợi ích**: Thao tác mở rộng hoặc kiểm tra model trên 1 key cụ thể không làm re-render các thẻ key khác.

### 2.4. Quyết định 4: Cơ Chế Cache 30s TTL Cho `fetchQuotaStatus`
- **Design**:
  - Lưu trữ `lastFetchedTime` và `cachedData` trong module/ref.
  - Khi gọi `loadQuotaStatus(forceRefresh = false)`:
    - Nếu `!forceRefresh && Date.now() - lastFetchedTime < 30_000`, tái sử dụng dữ liệu đã cache.
    - Nếu `forceRefresh === true` hoặc quá 30 giây, gửi request mạng mới và cập nhật cache.
- **Lợi ích**: Chuyển đổi tab hiển thị tức thời, không bị khựng hoặc hiện lại spinner.
