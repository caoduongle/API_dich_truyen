# Quickstart & Verification Guide: Sliding Window Token & Request Quota

**Feature**: `011-quota-sliding-window-tpm`  
**Created**: 2026-08-19  

---

## 1. Automated Verification Commands

```bash
# 1. Type Safety Check
npm run lint

# 2. Complete Test Suites (including Quota Service & Model Registry)
npm test

# 3. Production Build
npm run build
```

---

## 2. Real-Time Quota Verification Scenarios

### Scenario A: Sliding Window RPM & TPM
1. Gửi liên tiếp 3 request dịch thông qua `geminiService`.
2. Kiểm tra `quotaService.getSnapshot()`:
   - `requestsThisMinute === 3`
   - `tokensThisMinute === promptTokens + outputTokens` của 3 request.
3. Chờ 61 giây (hoặc dùng fake timer):
   - `requestsThisMinute === 0`
   - `tokensThisMinute === 0`
   - `requestsToday` và `tokensToday` không bị mất.

### Scenario B: PST Day Rollover
1. Ghi nhận 1 request lúc 23:59:59 PST ngày 2026-08-19.
2. Kiểm tra `tokensToday` và `requestsToday` có giá trị.
3. Tua thời gian sang 00:00:01 PST ngày 2026-08-20, gửi 1 request mới.
4. Xác nhận `tokensToday` và `requestsToday` chỉ tính request mới của ngày 2026-08-20, trong khi `tokensTotal` và `requestsTotal` cộng dồn cả 2 ngày.
