# Quickstart & Verification Guide: Quota Panel Performance Optimization

**Feature**: `010-quota-panel-optimization`  
**Created**: 2026-08-19  

---

## 1. Automated Verification Commands

```bash
# 1. Type Safety Check
npm run lint

# 2. Complete Test Suites
npm test

# 3. Production Build
npm run build
```

---

## 2. Manual Performance Verification

### Scenario 1: Countdown Isolation
1. Trong môi trường test / dev, cấu hình key có trạng thái ngắt mạch (ví dụ `blacklistRemainingMs = 45000`).
2. Mở tab "Quota & Hạn mức", quan sát `CountdownBadge`.
3. Số giây đếm lùi nhảy đều đặn 45s -> 44s -> 43s...
4. Quan sát React DevTools Profiler: chỉ có `CountdownBadge` render, toàn bộ `QuotaPanel` và `ApiSettings` không bị re-render.

### Scenario 2: Context Deduplication
1. Bấm "Kiểm tra Model" ở một API key.
2. Bấm "Kiểm tra Model" lần thứ hai ở cùng key đó.
3. Xác nhận không có re-render lan truyền lên các component cấp cao (`App`, `TranslatorWorkspace`).

### Scenario 3: 30s Cache Switching
1. Mở tab "Quota & Hạn mức" (dữ liệu được tải).
2. Chuyển sang tab "Cấu hình AI" rồi quay lại tab "Quota & Hạn mức" ngay lập tức.
3. Xác nhận giao diện hiển thị ngay lập tức không có độ trễ hay vòng xoay tải dữ liệu.
4. Bấm nút "Làm mới" (Refresh icon) -> tải lại dữ liệu mới từ máy chủ.
