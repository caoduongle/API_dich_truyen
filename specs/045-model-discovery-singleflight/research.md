# Phase 0 Research: SingleFlight In-Flight Promise Coalescing & Dual-Tier Cache

**Feature**: `045-model-discovery-singleflight`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Nghiên Cứu Mẫu Thiết Kế SingleFlight (Promise Coalescing Pattern)

### Vấn Đề (Thundering Herd Problem)
Khi nhiều clients / components yêu cầu danh sách models cùng một lúc (ví dụ khi người dùng mở nhiều tabs hoặc tải trang cấu hình API), nếu không có SingleFlight, 20 requests đồng thời khi cache miss sẽ tạo ra 20 kết nối HTTP độc lập tới Google API. Điều này gây lãng phí băng thông và dễ bị Google chặn 429.

### Giải Pháp SingleFlight Trong TypeScript
```
                   20 Concurrent Requests (Same Key)
                        │  │  │  │  │ ... │
                        ▼  ▼  ▼  ▼  ▼     ▼
                ┌───────────────────────────────────┐
                │   inFlightDiscovery.get(keyHash)  │
                └─────────────────┬─────────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
                 ▼ (Request đầu tiên)              ▼ (19 Requests còn lại)
      ┌─────────────────────────────┐   ┌─────────────────────────────┐
      │ Tạo mới in-flight Promise   │   │ Await chung in-flight       │
      │ Gửi 1 HTTP Call Upstream    │   │ Promise đang chạy           │
      └──────────────┬──────────────┘   └──────────────┬──────────────┘
                     │                                 │
                     └────────────────┬────────────────┘
                                      │
                                      ▼
                      1 Response duy nhất trả về
                      20 Requests đều nhận kết quả
```

---

## 2. Chiến Lược Dual-Tier Cache & Short Failure Cache

1. **Success Cache (TTL: 15 phút)**:
   - Lưu trữ danh sách models hợp lệ đã fetch thành công.
   - Hỗ trợ cơ chế Stale-While-Revalidate (SWR).
2. **Short Failure Cache (TTL: 30 giây)**:
   - Lưu trữ lỗi gần nhất khi upstream thất bại (401/403/500/Timeout).
   - Ngăn chặn việc gửi liên tục các request lỗi lên Google trong vòng 30s.
   - Tự động giải phóng sau 30s hoặc khi người dùng gọi `forceRefresh = true` để khôi phục (Self-Healing).

---

## 3. Kịch Bản Kiểm Thử Bắt Buộc

1. `single request`: 1 request $\to$ 1 upstream call, cache entry được tạo.
2. `20 concurrent cache miss`: 20 requests đồng thời $\to$ đúng 1 upstream call duy nhất, cả 20 requests nhận cùng kết quả.
3. `cache hit`: Request tiếp theo $\to$ 0 upstream call.
4. `failure`: Upstream lỗi $\to$ cả 20 requests nhận cùng lỗi, in-flight map được giải phóng.
5. `timeout`: Upstream treo quá 15s $\to$ ném lỗi timeout, in-flight map được giải phóng.
6. `recovery`: Sau khi lỗi và hết TTL 30s $\to$ request tiếp theo gửi thành công lên upstream.
