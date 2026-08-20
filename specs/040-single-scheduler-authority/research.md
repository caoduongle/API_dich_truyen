# Phase 0 Research: Single Scheduler Authority Architecture

**Feature**: `040-single-scheduler-authority`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Nghiên Cứu Vấn Đề Double-Throttling & Phân Tán State Hiện Tại

### Vấn Đề Cốt Lõi
- Trong kiến trúc cũ, việc kiểm soát thời điểm thực thi và nhịp độ (pacing) bị phân tán ở nhiều nơi:
  1. `geminiService.ts` duy trì biến cục bộ `overloadCooldownUntil` (để sleep khi gặp 503).
  2. `geminiService.ts` duy trì Map `nextAllowedTimeByKey` và `nextAllowedTimeByGroup` (để tính delay và sleep thêm một lần nữa).
  3. `quotaService.ts` cũng theo dõi `group.nextAllowedTimeMs`, `group.cooldownUntilMs`, và `keyStats.cooldownUntil`.
- **Hậu quả**:
  - Xảy ra hiện tượng **Double-Throttling / Double-Sleep**: Một yêu cầu có thể bị hoãn bởi `overloadCooldownUntil`, sau đó lại bị hoãn tiếp bởi `groupNextAllowed`, và trong các bài test lại có thể bị hoãn bởi `nextAllowedTimeByKey`.
  - Không có một cơ quan duy nhất chịu trách nhiệm phán quyết: *"Khi nào thì request này được phép chạy?"*.
  - Khó kiểm thử tập trung do trạng thái bị phân mảnh giữa 2 services.

---

## 2. Thiết Kế Kiến Trúc: Single Scheduler Authority

### Nguyên Tắc Thiết Kế (Single Responsibility & Clean Dispatch)
1. **Scheduler Authority Duy Nhất (`quotaService`)**:
   - Chịu trách nhiệm 100% về:
     - Đánh giá tính khả dụng của Quota Group (`Quota Group Eligibility`)
     - Phân bổ nhịp độ và đặt chỗ thời gian an toàn nguyên tử (`Pacing Delay & Atomic Lease Reservation`)
     - Chọn Key tối ưu trong Group (`LRU & Health Selection`)
     - Quản lý Cooldown toàn diện (Key Cooldown 503/Circuit Breaker & Group Cooldown 429).
2. **Chuẩn Hóa Tầng Chấp Hành (`geminiService`)**:
   - `geminiService` chỉ đóng vai trò là Client chấp hành (Executor):
     1. Chuẩn bị request (`Prepare Request`)
     2. Xin cấp quyền điều phối từ Scheduler: `const lease = quotaService.scheduleAttempt(rawKeys, model, estimatedTokens);`
     3. Nếu `lease.delayMs > 0`: Sleep đúng 1 lần duy nhất theo chỉ thị của lease.
     4. Thực thi gọi Google GenAI với `lease.selectedKey`.
     5. Báo cáo kết quả: `quotaService.recordGroupUsage(...)` hoặc `quotaService.recordCategorizedError(...)`.
   - **Xóa bỏ hoàn toàn**: `nextAllowedTimeByKey`, `nextAllowedTimeByGroup`, và các logic tính toán sleep phân tán trong `geminiService.ts`.

---

## 3. Cấu Trúc Hợp Đồng Cấp Phép `ScheduleLease`

```typescript
export interface ScheduleLease {
  leaseId: string;
  isEligible: boolean;
  selectedGroupId?: string;
  selectedKey?: string;
  delayMs: number;
  effectiveIntervalMs: number;
  rejectReason?: string;
  earliestAvailableInMs?: number;
}
```

---

## 4. Kịch Bản Kiểm Thử & Tiêu Chí Xác Thực

| Ca Kiểm Thử | Mục Tiêu & Kỳ Vọng |
|---|---|
| `group pacing` | Các request tuần tự trong nhóm nhận `delayMs` tăng lũy tiến chuẩn xác theo nhịp độ của nhóm. |
| `multiple keys same group` | 2 keys trong cùng 1 nhóm chia sẻ chung 1 đồng hồ pacing của nhóm; đổi key không bypass pacing. |
| `multiple groups` | 2 request gửi tới 2 nhóm độc lập (Project A và Project B) đều nhận `delayMs = 0` và chạy song song đồng thời. |
| `parallel requests` | 10 request đồng thời được cấp lịch nguyên tử không bị trùng mốc thời gian hay race-condition. |
| `no double sleep` | Chứng minh `geminiService` chỉ sleep đúng 1 lần duy nhất theo chỉ định của Scheduler Authority. |
