# Quickstart & Verification Guide: Phân Tách ProviderQuota Khỏi Fallback / Scheduling Hint

**Feature**: `039-isolate-provider-quota-fallback`  
**Date**: 2026-08-20  
**Status**: Active

---

## 1. Mục Đích & Điều Kiện Tiên Quyết

Tài liệu này hướng dẫn cách kiểm định 5 kịch bản kiểm thử bắt buộc chứng minh rằng `ProviderQuota` đã được tách bạch hoàn toàn khỏi nhịp độ fallback dự phòng và `SchedulingHint` mang đúng nguồn gốc (`source`).

### Điều Kiện Môi Trường
```bash
node -v # >= 18.0.0
npm test # vitest
```

---

## 2. 5 Kịch Bản Kiểm Thử Bắt Buộc (Mandatory Test Scenarios)

### Scenario 1: `provider quota unknown`
- **Mục tiêu**: Chứng minh một QuotaGroup mới khởi tạo không bao giờ mang giá trị phỏng đoán trong `providerQuota`.
- **Lệnh thực thi**: `npx vitest run server/services/__tests__/quotaGroup.test.ts -t "provider quota unknown"`
- **Kỳ vọng**: `group.providerQuota === undefined`.

### Scenario 2: `provider quota known`
- **Mục tiêu**: Chứng minh `providerQuota` khi được khởi tạo kèm dữ liệu xác minh sẽ mang đúng thông số và nhãn `source: "provider"`.
- **Lệnh thực thi**: `npx vitest run server/services/__tests__/quotaGroup.test.ts -t "provider quota known"`
- **Kỳ vọng**: `group.providerQuota.rpm === 60`, `group.providerQuota.source === "provider"`, `group.providerQuota.verifiedAt` được thiết lập.

### Scenario 3: `configured hint`
- **Mục tiêu**: Chứng minh khi người dùng đặt cấu hình tùy chỉnh, `schedulingHint.source` là `"configured"`.
- **Lệnh thực thi**: `npx vitest run server/services/__tests__/quotaGroup.test.ts -t "configured hint"`
- **Kỳ vọng**: `group.schedulingHint.source === "configured"`, `group.schedulingHint.effectiveIntervalMs` tính theo `configuredRpm`.

### Scenario 4: `fallback hint`
- **Mục tiêu**: Chứng minh khi chưa có cấu hình và chưa xác minh quota, `schedulingHint.source` là `"model-fallback"`.
- **Lệnh thực thi**: `npx vitest run server/services/__tests__/quotaGroup.test.ts -t "fallback hint"`
- **Kỳ vọng**: `group.schedulingHint.source === "model-fallback"`, `group.providerQuota === undefined`.

### Scenario 5: `verified quota update`
- **Mục tiêu**: Chứng minh việc cập nhật `providerQuota` khi xác minh thành công không ghi đè `configuredLimits` của người dùng.
- **Lệnh thực thi**: `npx vitest run server/services/__tests__/quotaGroup.test.ts -t "verified quota update"`
- **Kỳ vọng**: `group.providerQuota` được cập nhật 60 RPM, nhưng `schedulingHint` vẫn tôn trọng `configuredRpm: 10` của người dùng (`source: "configured"`).

---

## 3. Lệnh Chạy Toàn Bộ Quality Gates

```bash
npm run lint    # tsc --noEmit (Kiểm tra type safety sạch 100%)
npm test        # vitest run (Chạy toàn bộ 478+ unit tests)
npm run build   # vite build + esbuild server (Đóng gói production)
```
