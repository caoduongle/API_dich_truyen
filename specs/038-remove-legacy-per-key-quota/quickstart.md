# Quickstart & Verification Guide: Loại bỏ Legacy Per-Key Quota Ownership & Chuẩn hóa Quota Group Authority

**Feature Branch**: `038-remove-legacy-per-key-quota`  
**Created**: 2026-08-20  
**Status**: Active  
**Spec Reference**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/038-remove-legacy-per-key-quota/spec.md)

---

## 1. Môi trường & Lệnh Kiểm định Chất lượng (Quality Gates)

Để đảm bảo tuân thủ nghiêm ngặt Hiến pháp dự án (`constitution.md`), toàn bộ các lệnh sau phải chạy thành công trước khi hoàn tất:

```bash
# 1. Kiểm tra Type Safety (TypeScript)
npm run lint

# 2. Chạy toàn bộ Test Suite (Vitest)
npm test

# 3. Kiểm tra Build Production (Vite + esbuild)
npm run build
```

---

## 2. Kịch bản Kiểm thử Tự động 6 Tình huống Bắt buộc

Tất cả 6 kịch bản bắt buộc được kiểm thử tự động trong `server/services/__tests__/quotaGroup.test.ts`:

### Scenario 1: Same project + 2 keys (Chia sẻ Quota Bucket chung)
- **Mô tả**: Hai key `Key A1` và `Key A2` thuộc cùng một QuotaGroup (15 RPM).
- **Thao tác**: Gửi 8 requests qua Key A1 và 7 requests qua Key A2 trong 60 giây.
- **Kỳ vọng**: QuotaGroup đạt 15 requests, chuyển sang trạng thái bão hòa RPM. Request thứ 16 bị hoãn theo nhịp độ pacing, tổng thông lượng không vượt quá 15 RPM.

### Scenario 2: Different projects (Cô lập Hạn ngạch giữa các Dự án)
- **Mô tả**: `Project Alpha` (15 RPM) và `Project Beta` (60 RPM) chạy song song.
- **Thao tác**: Gửi dồn 15 requests làm bão hòa `Project Alpha`.
- **Kỳ vọng**: `Project Alpha` bị từ chối/hoãn, trong khi `Project Beta` vẫn `isEligible: true` và được scheduler lựa chọn để thực thi bình thường.

### Scenario 3: Group quota exhaustion (Cạn kiệt Hạn mức RPD theo ngày)
- **Mô tả**: `Project Alpha` đạt giới hạn 1500 RPD trong ngày theo múi giờ PST.
- **Thao tác**: Ghi nhận 1500 lượt gọi cho nhóm $\to$ yêu cầu request mới.
- **Kỳ vọng**: Toàn bộ QuotaGroup chuyển sang `Exhausted`, không một key nào trong nhóm được bắn request cho đến khi bước sang ngày mới 00:00 PST.

### Scenario 4: One key auth failure (Cách ly Lỗi Xác thực 401/403)
- **Mô tả**: Nhóm có `Key A1` (bị lỗi 401 Unauthorized) và `Key A2` (hợp lệ).
- **Thao tác**: Kích hoạt lỗi `AUTH_FAILED` trên `Key A1`.
- **Kỳ vọng**: `Key A1` chuyển sang `AuthFailed` (`isAvailable: false`). QuotaGroup vẫn giữ `isEligible: true`, hàm `selectBestKeyInGroup` tự động chọn `Key A2`.

### Scenario 5: One key cooldown (Cách ly Cooldown 503 Overloaded)
- **Mô tả**: Nhóm có `Key A1` (gặp 503) và `Key A2` (khỏe mạnh).
- **Thao tác**: Ghi nhận lỗi 503 trên `Key A1` (tạm dừng 3s).
- **Kỳ vọng**: `Key A1` vào Cooldown, `Key A2` tiếp tục xử lý các yêu cầu ngay lập tức mà không cần chờ 3s.

### Scenario 6: Group still available (Duy trì Tính Khả dụng)
- **Mô tả**: Nhóm có 3 keys, trong đó 2 keys bị lỗi và 1 key khỏe mạnh.
- **Thao tác**: Đánh giá tính khả dụng của nhóm qua `evaluateQuotaGroups`.
- **Kỳ vọng**: QuotaGroup vẫn đạt trạng thái `Available` và phục vụ tốt nhờ key khỏe mạnh còn lại.

---

## 3. Lệnh Chạy Riêng Module Test Quota

```bash
# Chạy riêng các bài test liên quan đến Quota Group và Key Health
npx vitest run server/services/__tests__/quotaGroup.test.ts
npx vitest run server/services/__tests__/quotaAuthority.test.ts
npx vitest run server/services/__tests__/keyScheduler.test.ts
```
